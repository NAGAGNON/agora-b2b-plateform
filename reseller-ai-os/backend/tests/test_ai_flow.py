"""Boucle Claude réelle du SDK Anthropic, branchée sur un faux serveur HTTP (aucun appel réseau, aucun coût)."""
import json
import anthropic, httpx2 as httpx, pytest
from app.models import Conversation, ConversationMessage
from app.services import ai, chat, settings as S


def fake_client(script, seen):
    def handler(request: httpx.Request):
        body = json.loads(request.content)
        seen.append(body)
        return httpx.Response(200, json=script[len(seen) - 1])
    return anthropic.Anthropic(api_key="sk-ant-test", http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def msg(content, stop):
    return {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-sonnet-5-5", "content": content, "stop_reason": stop, "stop_sequence": None,
            "usage": {"input_tokens": 1200, "output_tokens": 300}}


def test_chat_tool_loop_persists_logs_and_never_exposes_forbidden_tools(db, monkeypatch):
    seen = []
    script = [msg([{"type": "tool_use", "id": "tu_1", "name": "get_dashboard", "input": {}}], "tool_use"),
              msg([{"type": "text", "text": "Votre CA du mois est de 0 €."}], "end_turn")]
    monkeypatch.setattr(ai, "_client", lambda db: fake_client(script, seen))
    c = Conversation(); db.add(c); db.flush()
    r = chat.send(db, c, "Quel est mon chiffre d'affaires ?")
    assert r["reply"].startswith("Votre CA") and r["actions"][0]["tool"] == "get_dashboard" and not r["actions"][0]["is_action"]
    # requête : modèle de raisonnement + liste blanche d'outils uniquement
    first = seen[0]
    assert first["model"] == "claude-sonnet-5-5"
    names = {t["name"] for t in first["tools"]}
    assert "get_dashboard" in names and not (names & {"validate_purchase", "pay", "delete_item", "update_settings"})
    # 2e requête : le résultat d'outil (données réelles) est renvoyé avec is_error False
    tr = seen[1]["messages"][-1]["content"][0]
    assert tr["type"] == "tool_result" and tr["tool_use_id"] == "tu_1" and "revenue_month" in tr["content"]
    # persistance + journal d'audit + usage IA enregistré
    db.refresh(c)
    assert [m.role for m in c.messages] == ["user", "assistant", "user", "assistant"]
    from app.models import ActivityLog, AiUsage
    assert db.query(ActivityLog).filter_by(actor="ai", action="ai_tool").count() == 1
    u = db.query(AiUsage).all()
    assert len(u) == 2 and sum(x.input_tokens for x in u) == 2400 and all(x.cost_eur > 0 for x in u)
    # 2e tour de conversation : l'historique est rejoué tel quel
    seen.clear()
    script[:] = [msg([{"type": "text", "text": "Rien de plus."}], "end_turn")]
    chat.send(db, c, "Merci")
    assert len(seen[0]["messages"]) == 5


def test_chat_action_tool_and_unknown_tool_error_are_returned_to_model(db, monkeypatch):
    seen = []
    script = [msg([{"type": "tool_use", "id": "tu_1", "name": "prepare_purchase_baskets", "input": {"count": 3}},
                   {"type": "tool_use", "id": "tu_2", "name": "validate_purchase", "input": {"id": 1}}], "tool_use"),
              msg([{"type": "text", "text": "Aucun panier éligible ; la validation m'est interdite."}], "end_turn")]
    monkeypatch.setattr(ai, "_client", lambda db: fake_client(script, seen))
    c = Conversation(); db.add(c); db.flush()
    r = chat.send(db, c, "Prépare les achats de mes cinq meilleurs produits")
    assert [a["is_action"] for a in r["actions"]] == [True, False] and r["actions"][1]["error"] is True
    results = {b["tool_use_id"]: b for b in seen[1]["messages"][-1]["content"]}
    assert results["tu_2"]["is_error"] is True and "non autorisé" in results["tu_2"]["content"]
    assert "orders_created" in results["tu_1"]["content"]


def test_chat_stops_when_budget_exhausted(db, monkeypatch):
    S.set_many(db, {"ai_budget_daily": 0.0000001})
    ai.record(db, "operations_manager", "x", "claude-sonnet-5-5", 10_000, 10_000)
    monkeypatch.setattr(ai, "_client", lambda db: pytest.fail("aucun appel réseau attendu"))
    c = Conversation(); db.add(c); db.flush()
    with pytest.raises(ai.AiBudgetExceeded):
        chat.send(db, c, "bonjour")


def test_enrichment_is_labelled_estimate_and_cached(db, monkeypatch):
    from app.models import Opportunity
    from app.services import analysis
    seen = []
    payload = json.dumps({"demand": "high", "competition": "medium", "risk": "low", "compliance": "ok", "compliance_notes": "", "resale_estimate_eur": 31, "reasoning": "Basique et demandé."})
    script = [msg([{"type": "text", "text": payload}], "end_turn")]
    monkeypatch.setattr(ai, "_client", lambda db: fake_client(script, seen))
    o = Opportunity(name="Robe", purchase_price=10); db.add(o); db.flush()
    r1 = analysis.ai_enrich(db, o)
    assert o.ai_resale_estimate == 31 and o.resale_price is None and o.score is None  # l'estimation IA n'entre JAMAIS dans le score
    assert o.demand == "high" and "warning" in o.score_detail["ai"] and r1["cached"] is False
    r2 = analysis.ai_enrich(db, o)
    assert r2["cached"] is True and len(seen) == 1
    assert seen[0]["model"] == "claude-sonnet-5-5"
