import io
from decimal import Decimal as D
import pytest
from PIL import Image
from fastapi.testclient import TestClient


def png(color=(200, 50, 50), size=(400, 300)):
    b = io.BytesIO(); Image.new("RGB", size, color).save(b, "PNG"); return b.getvalue()


def test_auth_required_and_login(client):
    from app.main import app
    anon = TestClient(app)
    assert anon.get("/api/dashboard").status_code == 401
    assert anon.post("/api/auth/login", json={"password": "nope"}).status_code == 401
    assert client.get("/api/dashboard").status_code == 200
    assert client.get("/api/auth/me").json()["authenticated"] is True


def test_dashboard_is_empty_not_fake(client):
    d = client.get("/api/dashboard").json()
    assert d["has_data"] is False and d["kpis"]["revenue_month"] == 0 and d["kpis"]["sales_count"] == 0
    assert len(d["series"]) == 12 and all(m["revenue"] == 0 for m in d["series"])
    assert d["alerts"] == [] and d["timeline"] == []


def test_csv_import_scoring_and_filters(client):
    sup = client.post("/api/suppliers", json={"name": "Grossiste A"}).json()
    src = client.post("/api/sources", json={"name": "Catalogue CSV", "kind": "csv_file", "supplier_id": sup["id"]}).json()
    csv = ("ref;nom;prix;marque;catégorie;stock;revente\n"
           "A1;Robe fleurie;12,00;Zara;Robes;oui;29\n"
           "A2;Pull laine;8,50;;Pulls;oui;\n"
           "A3;Sac;40;;Sacs;non;45\n"
           "A4;;5;;;;\n").encode()
    pv = client.post(f"/api/sources/{src['id']}/upload?preview=true", files={"file": ("c.csv", csv)}).json()
    assert pv["suggested_mapping"]["purchase_price"] == "prix" and pv["total_rows"] == 4
    r = client.post(f"/api/sources/{src['id']}/upload", files={"file": ("c.csv", csv)}).json()
    assert r["created"] == 3 and r["skipped"] == 1
    again = client.post(f"/api/sources/{src['id']}/upload", files={"file": ("c.csv", csv)}).json()
    assert again["created"] == 0 and again["updated"] == 3  # dédoublonnage
    client.post("/api/opportunities/analyze")
    items = {o["name"]: o for o in client.get("/api/opportunities").json()["items"]}
    assert items["Pull laine"]["score"] is None  # pas de prix de revente → pas de score inventé
    robe = items["Robe fleurie"]
    assert robe["resale_basis"] == "estimation manuelle" and robe["est_profit"] == pytest.approx(29 - 12 - 0.30)
    assert items["Sac"]["availability"] == "out_of_stock"
    assert client.get("/api/opportunities?min_margin=30").json()["total"] == 1
    assert client.get("/api/opportunities?min_profit=100").json()["total"] == 0
    alerts = client.get("/api/dashboard").json()["alerts"]
    assert any(a["kind"] == "stockout" for a in alerts)


def test_price_references_drive_resale_price(client):
    o = client.post("/api/opportunities", json={"name": "Veste", "purchase_price": 15, "manual_resale_price": 60}).json()
    for p in (30, 34, 38):
        o = client.post(f"/api/opportunities/{o['id']}/references", json={"price": p, "kind": "sold"}).json()
    assert o["resale_price"] == 34 and o["resale_basis"] == "ventes observées"  # médiane, pas l'estimation manuelle
    assert o["confidence"] > 60


def test_ssrf_blocked(client):
    r = client.post("/api/sources", json={"name": "x", "kind": "json_url", "url": "http://127.0.0.1:9/x"})
    assert r.status_code == 400 and "SSRF" in r.json()["detail"]
    r = client.post("/api/sources", json={"name": "x", "kind": "csv_url", "url": "http://169.254.169.254/latest"})
    assert r.status_code == 400


def test_full_flow_http(client):
    """Opportunité → commande → validation → réception → annonce → publication → vente → expédition → encaissement → finance."""
    client.put("/api/settings", json={"initial_capital": 200})
    sup = client.post("/api/suppliers", json={"name": "Fournisseur Z"}).json()
    opp = client.post("/api/opportunities", json={"name": "Robe fleurie", "purchase_price": 12, "supplier_id": sup["id"], "manual_resale_price": 29,
                                                   "category": "Robes", "brand": "Zara"}).json()
    po = client.post("/api/purchases/from-opportunities?quantity=1", json=[opp["id"]]).json()
    assert po["status"] == "to_study" and po["total"] == 12
    assert client.post(f"/api/purchases/{po['id']}/status", json={"status": "ordered"}).status_code == 409
    for st in ("awaiting_validation", "validated"):
        assert client.post(f"/api/purchases/{po['id']}/status", json={"status": st}).status_code == 200
    assert client.get("/api/expenses").json() == []
    client.post(f"/api/purchases/{po['id']}/status", json={"status": "ordered", "reference": "CMD-1"})
    exp = client.get("/api/expenses").json()
    assert len(exp) == 1 and exp[0]["amount"] == 12 and exp[0]["category"] == "achats_fournisseurs"
    stock = client.get("/api/inventory").json()["items"]
    assert stock[0]["status"] == "ordered" and stock[0]["in_stock"] is False
    client.post(f"/api/purchases/{po['id']}/status", json={"status": "received"})
    item = client.get("/api/inventory").json()["items"][0]
    assert item["in_stock"] is True
    assert client.post(f"/api/inventory/{item['id']}/listing").json()["status"] == "draft"
    lst = client.get("/api/listings").json()[0]
    assert lst["compliance"]["ok"] is False and any("photo" in e for e in lst["compliance"]["errors"])  # pas de photo réelle
    assert client.post(f"/api/listings/{lst['id']}/ready").status_code == 409
    up = client.post(f"/api/inventory/{item['id']}/photos", files={"file": ("a.png", png(), "image/png")})
    assert up.status_code == 200
    assert client.get(f"/api/photos/{up.json()['id']}/file").headers["content-type"] == "image/jpeg"
    assert client.post(f"/api/listings/{lst['id']}/ready").status_code == 200
    assert client.post(f"/api/listings/{lst['id']}/published", json={"url": "https://evil.example/items/1"}).status_code == 409
    ok = client.post(f"/api/listings/{lst['id']}/published", json={"url": "https://www.vinted.fr/items/123456-robe"})
    assert ok.status_code == 200 and ok.json()["status"] == "published"
    assert client.get(f"/api/inventory/{item['id']}").json()["status"] == "published"
    sale = client.post("/api/sales", json={"item_id": item["id"], "sale_price": 29, "payment_confirmed": True, "packaging_cost": 0.3}).json()
    assert sale["status"] == "to_ship" and sale["profit"] == pytest.approx(16.7)
    d = client.get("/api/dashboard").json()["kpis"]
    assert d["revenue_month"] == 29 and d["net_profit_month"] == pytest.approx(16.7) and d["items_in_stock"] == 0
    assert client.get("/api/dashboard").json()["kpis"]["orders_in_progress"]["sales_to_ship"] == 1
    sh = client.get("/api/shipments").json()[0]
    client.put(f"/api/shipments/{sh['id']}", json={"carrier": "Colissimo", "tracking_number": "6A123"})
    for st in ("shipped", "delivered"):
        assert client.post(f"/api/sales/{sale['id']}/status", json={"status": st}).status_code == 200
    assert client.post(f"/api/sales/{sale['id']}/payout", json={}).status_code == 200
    assert client.post(f"/api/sales/{sale['id']}/status", json={"status": "completed"}).status_code == 200
    c = client.get("/api/finance/overview").json()
    assert c["cash"]["cash_available"] == pytest.approx(200 - 12 - 0.3 + 29)
    assert c["cash"]["pending_payouts"] == 0 and c["pnl"]["month"]["net_profit"] == pytest.approx(16.7)
    kinds = {n["kind"] for n in client.get("/api/notifications").json()["items"]}
    assert {"purchase_ordered", "item_received", "listing_published", "sale_made", "payout"} <= kinds
    acts = {a["action"] for a in client.get("/api/activity?limit=200").json()}
    assert {"purchase_validated", "listing_published", "sale_detected"} <= acts


def test_compliance_rules(client):
    item = client.post("/api/inventory", json={"name": "Sac réplique Vuitton", "purchase_price": 10, "brand": "X"}).json()
    client.post(f"/api/inventory/{item['id']}/photos", files={"file": ("a.png", png(), "image/png")})
    lid = client.post(f"/api/inventory/{item['id']}/listing").json()["id"]
    chk = client.get(f"/api/listings/{lid}").json()["compliance"]
    assert not chk["ok"] and any("réplique" in e for e in chk["errors"])
    r = client.put(f"/api/listings/{lid}", json={"title": "Sac cuir", "description": "Contactez-moi sur whatsapp 06 12 34 56 78", "price": 20})
    assert any("Coordonnées" in e for e in r.json()["compliance"]["errors"])


def test_photo_tools_and_presentation_is_never_real(client):
    item = client.post("/api/inventory", json={"name": "Pull", "purchase_price": 5}).json()
    p = client.post(f"/api/inventory/{item['id']}/photos", files={"file": ("a.png", png(), "image/png")}).json()
    e = client.post(f"/api/photos/{p['id']}/edit", json={"brightness": 1.2, "crop": [0, 0, 0.5, 0.5], "rotate": 90}).json()
    assert e["kind"] == "edited" and e["is_real_photo"] is True
    pres = client.post(f"/api/photos/{p['id']}/presentation", json={}).json()
    assert pres["kind"] == "presentation" and pres["is_real_photo"] is False
    assert client.post(f"/api/photos/{p['id']}/edit", json={"brightness": 9}).status_code == 400
    assert client.post(f"/api/inventory/{item['id']}/photos", files={"file": ("a.png", b"not an image")}).status_code == 400
    det = client.get(f"/api/inventory/{item['id']}").json()
    assert det["photo_capabilities"]["background_removal"] is False
    ids = [x["id"] for x in det["photos"]]
    assert client.post(f"/api/inventory/{item['id']}/photos/reorder", json=list(reversed(ids))).status_code == 200
    assert client.get(f"/api/inventory/{item['id']}/photos.zip").headers["content-type"] == "application/zip"


def test_vinted_api_not_pretended(client):
    st = client.get("/api/vinted").json()["connector"]
    assert st["available"] is False and st["effective_mode"] == "assisted"
    assert client.post("/api/vinted/api/sync").status_code == 409


def test_ai_unavailable_without_key_and_secrets_never_exposed(client):
    r = client.post("/api/chat", json={"message": "Combien ai-je dépensé ?"})
    assert r.status_code == 503 and "Clé API" in r.json()["detail"]
    client.put("/api/secrets/anthropic_api_key", json={"value": "sk-ant-test-1234567890abcd"})
    s = [x for x in client.get("/api/secrets").json() if x["name"] == "anthropic_api_key"][0]
    assert s["configured"] and s["last4"] == "abcd" and "value" not in s and "ciphertext" not in s
    from app.db import SessionLocal
    from app.models import Secret
    db = SessionLocal(); raw = db.get(Secret, "anthropic_api_key").ciphertext; db.close()
    assert b"sk-ant" not in raw


def test_ai_budget_cache_and_tool_whitelist(db, monkeypatch):
    from app.services import ai, chat, settings as S
    calls = []

    class R:
        stop_reason = "end_turn"
        class usage: input_tokens = 1000; output_tokens = 500
        content = [type("B", (), {"type": "text", "text": "ok"})()]

    class Fake:
        class messages:
            @staticmethod
            def create(**kw): calls.append(kw); return R()
    monkeypatch.setattr(ai, "_client", lambda db: Fake)
    a = ai.complete(db, agent_key="listing_creator", purpose="t", system="s", prompt="p")
    b = ai.complete(db, agent_key="listing_creator", purpose="t", system="s", prompt="p")
    assert a["cached"] is False and b["cached"] is True and len(calls) == 1  # cache = pas de second appel
    assert calls[0]["model"] == "claude-haiku-5-5"  # modèle économique par défaut
    S.set_many(db, {"ai_budget_daily": 0.0000001})
    with pytest.raises(ai.AiBudgetExceeded):
        ai.complete(db, agent_key="listing_creator", purpose="t", system="s", prompt="other")
    out, err = chat.run_tool(db, "validate_purchase", {"id": 1})
    assert err and "non autorisé" in out
    assert {t[0] for t in chat.TOOLS}.isdisjoint({"validate_purchase", "pay", "delete", "set_settings"})


def test_agent_bus_dedupes_and_reports_errors(db):
    from app.services import agents
    from app.models import AgentMessage, Agent
    agents.HANDLERS[("sales_manager", "boom")] = lambda db, p: 1 / 0
    m1 = agents.publish(db, "market_analyst", "sales_manager", "boom", {}, dedupe_key="k1")
    m2 = agents.publish(db, "market_analyst", "sales_manager", "boom", {}, dedupe_key="k1")
    assert m1.status == "error" and "ZeroDivision" in m1.error and m2 is None
    t = agents.run_task(db, "inventory_manager", "t", lambda d: 1 / 0)
    assert t.status == "error" and db.get(Agent, "inventory_manager").status == "error"
    res = agents.operations_check(db)
    assert any("inventory" in p.lower() or "Inventory" in p for p in res["problems"])
    del agents.HANDLERS[("sales_manager", "boom")]


def test_unprofitable_opportunity_is_handed_to_profit_manager(client):
    o = client.post("/api/opportunities", json={"name": "Perte", "purchase_price": 30, "manual_resale_price": 20}).json()
    assert o["status"] == "rejected"
    acts = client.get("/api/activity?actor=profit_manager").json()
    assert any(a["action"] == "opportunity_rejected" for a in acts)


def test_prepare_baskets_never_pays_and_respects_budget(client):
    client.put("/api/settings", json={"budget_monthly": 100, "min_margin_pct": 20, "min_profit": 5})
    sup = client.post("/api/suppliers", json={"name": "S"}).json()
    for i in range(3):
        client.post("/api/opportunities", json={"name": f"P{i}", "purchase_price": 20, "supplier_id": sup["id"], "manual_resale_price": 60,
                                                 "demand": "high", "competition": "low", "risk": "low", "compliance": "ok"})
    r = client.post("/api/purchases/prepare-baskets?limit=5").json()
    assert len(r["orders_created"]) == 1
    po = client.get(f"/api/purchases/{r['orders_created'][0]}").json()
    assert po["status"] == "awaiting_validation" and po["auto_prepared"] and client.get("/api/expenses").json() == []
    assert client.post("/api/purchases/prepare-baskets?limit=5").json()["orders_created"] == []  # pas de doublon


def test_document_import_requires_confirmation(client):
    txt = b"Facture N: FAC-2026-0042\nDate 12/11/2026\nTotal TTC : 1 234,50 EUR\n"
    d = client.post("/api/documents/analyze", files={"file": ("f.txt", txt)}).json()
    assert d["parsed"]["fields"]["reference"] == "FAC-2026-0042" and d["parsed"]["fields"]["total"] == "1234.50"
    assert client.get("/api/expenses").json() == []  # rien d'enregistré avant confirmation
    r = client.post(f"/api/documents/{d['id']}/confirm", json={"action": "expense", "amount": 1234.5, "category": "abonnement"})
    assert r.status_code == 200 and len(client.get("/api/expenses").json()) == 1
    csv = "nom,prix,quantité\nRobe,10,2\nPull,5,1\n".encode()
    d2 = client.post("/api/documents/analyze", files={"file": ("cmd.csv", csv)}).json()
    assert len(d2["parsed"]["lines"]) == 2
    po = client.post(f"/api/documents/{d2['id']}/confirm", json={"action": "order", "shipping_cost": 3}).json()
    assert po["status"] == "ordered" and po["total"] == 28


def test_calendar_and_job_frequency(client):
    cal = client.get("/api/automation/calendar?days=3").json()
    assert any(u["job"] == "hunter_sync" for u in cal["upcoming"])
    r = client.put("/api/automation/jobs/hunter_sync", json={"hour": 6, "minute": 30})
    assert r.json()["hour"] == 6
    assert client.put("/api/automation/jobs/hunter_sync", json={"days": "xyz"}).status_code == 400
    run = client.post("/api/automation/jobs/market_analyze/run").json()
    assert run["status"] == "done"


def test_settings_validation(client):
    assert client.put("/api/settings", json={"nope": 1}).status_code == 400
    assert client.put("/api/settings", json={"min_margin_pct": 35}).json()["min_margin_pct"] == 35


def test_searched_categories_filter_automatic_baskets(client):
    client.put("/api/settings", json={"categories": ["Robes"], "min_margin_pct": 10, "min_profit": 1})
    sup = client.post("/api/suppliers", json={"name": "S2"}).json()
    for name, cat in (("Robe A", "Robes"), ("Sac B", "Sacs")):
        client.post("/api/opportunities", json={"name": name, "category": cat, "purchase_price": 10, "supplier_id": sup["id"], "manual_resale_price": 40,
                                                 "demand": "high", "competition": "low", "risk": "low", "compliance": "ok"})
    r = client.post("/api/purchases/prepare-baskets").json()
    po = client.get(f"/api/purchases/{r['orders_created'][0]}").json()
    assert [l["name"] for l in po["lines"]] == ["Robe A"]


def test_disabled_notification_kind_is_not_created(client):
    client.put("/api/settings", json={"notify_kinds_disabled": ["sale_made"]})
    client.post("/api/inventory", json={"name": "X", "purchase_price": 5, "planned_price": 20})
    item = client.get("/api/inventory").json()["items"][0]
    client.post("/api/sales", json={"item_id": item["id"], "sale_price": 20})
    kinds = {n["kind"] for n in client.get("/api/notifications").json()["items"]}
    assert "sale_made" not in kinds and "ship_due" in kinds
