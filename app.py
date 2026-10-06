import streamlit as st
import pandas as pd
from PIL import Image
import requests
from io import BytesIO
import numpy as np
import plotly.graph_objects as go
import os
import hmac
from pathlib import Path

st.set_page_config(page_title="Agora B2B Pro", layout="wide")

FALLBACK_IMG = "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg"

DATA_DIR = Path(__file__).parent / "data"
ORG_FILE = DATA_DIR / "organisations.csv"
INSCR_FILE = DATA_DIR / "inscriptions.csv"
STATUT_COLORS = {"Actif": "green", "Moyen": "yellow", "Inactif": "red"}

def load_data():
    frames = [pd.read_csv(ORG_FILE).fillna("")]
    if INSCR_FILE.exists():
        frames.append(pd.read_csv(INSCR_FILE).fillna(""))
    return pd.concat(frames, ignore_index=True)

def save_inscription(record):
    DATA_DIR.mkdir(exist_ok=True)
    new = pd.DataFrame([record])
    new.to_csv(INSCR_FILE, mode="a", header=not INSCR_FILE.exists(), index=False)

def check_password():
    """Mot de passe via la variable AGORA_PASSWORD ou st.secrets ; si absent, mode démo ouvert."""
    expected = os.environ.get("AGORA_PASSWORD")
    if not expected:
        try:
            expected = st.secrets.get("AGORA_PASSWORD")
        except Exception:
            expected = None
    if not expected or st.session_state.get("auth_ok"):
        return True
    with st.form("login"):
        pwd = st.text_input("Mot de passe", type="password")
        if st.form_submit_button("Se connecter"):
            if hmac.compare_digest(pwd, expected):
                st.session_state["auth_ok"] = True
                st.rerun()
            else:
                st.error("Mot de passe incorrect.")
    return False

df = load_data()

@st.cache_data(show_spinner=False)
def fetch_image(url):
    if not url:
        return None
    try:
        response = requests.get(url, timeout=4)
        response.raise_for_status()
        return Image.open(BytesIO(response.content))
    except Exception:
        return None

def show_image(url, width, container=st):
    img = fetch_image(url)
    if img is not None:
        container.image(img, width=width)
    else:
        container.image(FALLBACK_IMG, width=width)

st.markdown("""
<style>
.main-title {font-size: 2.7em; color: #d32f2f; font-weight: 900; text-align: center;}
.sub-title {font-size: 1.3em; color: #004080; text-align: center; margin-bottom: 1em;}
.form-zone {background: #f8f9fa; padding: 1.2em 2em 0.7em 2em; border-radius: 16px; margin-bottom: 1.5em; box-shadow: 0 4px 16px rgba(200,40,40,0.08);}
.card {background: #fff; border-radius: 15px; box-shadow: 0 2px 18px rgba(0,0,0,0.10); margin-bottom: 20px; padding: 16px;}
.card img {border-radius: 12px; border: 1px solid #f3f3f3; margin-bottom: 12px;}
.score-box {font-size: 2em; font-weight: 800; color: #004080; margin-right: 12px;}
.score-green {color: #388e3c;}
.score-orange {color: #fbc02d;}
.score-red {color: #d32f2f;}
.cta-btn {background: #d32f2f; color: #fff; border-radius: 7px; padding: 10px 28px; border: none; font-size: 1.12em;}
.cta-btn:hover {background: #a82727;}
a.contact-link {color: #004080; font-weight:bold; text-decoration:underline;}
</style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-title">Agora B2B Plateforme Pro</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Mise en relation Universités & Entreprises dans le monde</div>', unsafe_allow_html=True)

if not check_password():
    st.stop()

menu = st.radio("Navigation :", ["Universités", "Entreprises", "Annuaire", "Inscription", "Dashboard KPI"], horizontal=True)

def match_score(row, type_sel, pays, taille, theme):
    score = 0
    score += 40 if row["Pays"] == pays else 0
    delta = abs(row["Taille"] - taille)
    score += max(0, 30 - int(delta / 2000))
    th_row = [x.strip() for x in row["Thématique"].split(",")]
    nb_common = len(set(th_row).intersection(set(theme)))
    score += 60 if nb_common > 1 else (30 if nb_common == 1 else 0)
    if row["Statut"] == "Actif":
        score += 10
    elif row["Statut"] == "Moyen":
        score -= 5
    elif row["Statut"] == "Inactif":
        score -= 10
    return max(0, min(100, score))

def show_matching_score(type_sel):
    with st.container():
        st.markdown('<div class="form-zone">', unsafe_allow_html=True)
        st.markdown(f"#### Critères de recherche pour une {type_sel.lower()}")
        taille = st.slider("Taille de la structure", 1000, 500000, 30000, 1000)
        pays = st.selectbox("Pays souhaité pour les partenaires", sorted(df['Pays'].unique()))
        theme_opts = sorted(set([t.strip() for x in df['Thématique'].unique() for t in x.split(",")]))
        theme = st.multiselect("Thématiques recherchées", theme_opts)
        nb_part = st.slider("Nombre de partenaires recherchés", 1, 5, 3)
        submit = st.button("Trouver les partenaires adaptés", key=type_sel)
        st.markdown('</div>', unsafe_allow_html=True)

    state_key = f"results_{type_sel}"
    if submit:
        candidates = df[df['Type'] != type_sel].copy()
        candidates["Score"] = candidates.apply(
            lambda row: match_score(row, type_sel, pays, taille, theme), axis=1
        )
        st.session_state[state_key] = candidates.sort_values("Score", ascending=False).head(nb_part)
        st.session_state.pop('contact', None)

    candidates = st.session_state.get(state_key)
    if candidates is None:
        return

    st.markdown("<br><b>Résultat de votre recherche</b> :", unsafe_allow_html=True)
    for idx, row in candidates.iterrows():
        score_color = "score-green" if row["Score"] >= 80 else "score-orange" if row["Score"] >= 60 else "score-red"
        with st.container(border=True):
            cols = st.columns([1, 6])
            with cols[0]:
                st.markdown(f'<span class="score-box {score_color}">{row["Score"]}%</span>', unsafe_allow_html=True)
            with cols[1]:
                st.markdown(f"<h4 style='display:inline'>{row['Nom']} <span style='font-size: 0.8em;'>({row['Ville']}, {row['Pays']})</span></h4>", unsafe_allow_html=True)
                show_image(row["Image"], 160)
                st.markdown(f"<b>Thématique :</b> {row['Thématique']}<br><b>Statut :</b> <span style='color:{row['Statut_color']}'>{row['Statut']}</span>", unsafe_allow_html=True)
                if st.button("Voir la fiche contact", key=f"{type_sel}_{row['Nom']}_btn"):
                    st.session_state['contact'] = row['Nom']
    if candidates["Score"].max() < 60:
        st.warning("Aucun partenaire parfaitement adapté, mais voici les plus proches selon vos critères.")

    export = candidates.drop(columns=["Image", "Statut_color"]).to_csv(index=False).encode("utf-8")
    st.download_button("Exporter les résultats (CSV)", export, file_name="partenaires.csv", mime="text/csv", key=f"export_{type_sel}")

    # Fiche contact (latérale)
    selected_name = st.session_state.get('contact')
    match = candidates[candidates['Nom'] == selected_name]
    if not match.empty:
        selected = match.iloc[0]
        st.sidebar.markdown(f"### Fiche Contact – {selected['Nom']}")
        show_image(selected["Image"], 140, st.sidebar)
        st.sidebar.markdown(f"- *Adresse* : {selected['Adresse']}")
        st.sidebar.markdown(f"- *Téléphone* : {selected['Tel']}")
        st.sidebar.markdown(f"- *Email* : [{selected['Email']}](mailto:{selected['Email']})")
        st.sidebar.markdown(f"- *Site web* : [Site officiel]({selected['Site']})")
        st.sidebar.markdown("---")
        st.sidebar.button("Fermer la fiche", on_click=lambda: st.session_state.pop('contact', None))

def show_directory():
    st.markdown("<h2 style='color:#004080;'>📚 Annuaire</h2>", unsafe_allow_html=True)
    c1, c2, c3, c4 = st.columns(4)
    types = c1.multiselect("Type", sorted(df["Type"].unique()))
    pays = c2.multiselect("Pays", sorted(df["Pays"].unique()))
    statuts = c3.multiselect("Statut", list(STATUT_COLORS))
    q = c4.text_input("Recherche (nom, ville)")
    res = df
    if types: res = res[res["Type"].isin(types)]
    if pays: res = res[res["Pays"].isin(pays)]
    if statuts: res = res[res["Statut"].isin(statuts)]
    if q:
        mask = res["Nom"].str.contains(q, case=False) | res["Ville"].str.contains(q, case=False)
        res = res[mask]
    st.caption(f"{len(res)} organisation(s)")
    st.dataframe(res[["Type", "Nom", "Ville", "Pays", "Thématique", "Taille", "Statut", "Email", "Site"]],
                 hide_index=True, width="stretch")

def show_registration():
    st.markdown("<h2 style='color:#004080;'>📝 Inscrire une organisation</h2>", unsafe_allow_html=True)
    with st.form("inscription", clear_on_submit=True):
        c1, c2 = st.columns(2)
        type_ = c1.selectbox("Type", ["Université", "Entreprise"])
        nom = c2.text_input("Nom *")
        ville = c1.text_input("Ville *")
        pays = c2.text_input("Pays *")
        theme_opts = sorted(set(t.strip() for x in df["Thématique"] for t in x.split(",") if t.strip()))
        themes = st.multiselect("Thématiques *", theme_opts)
        taille = st.number_input("Taille (étudiants / employés)", 1, 1_000_000, 1000, 100)
        email = st.text_input("Email *")
        site = st.text_input("Site web")
        tel = st.text_input("Téléphone")
        adresse = st.text_input("Adresse")
        ok = st.form_submit_button("Envoyer l'inscription")
    if ok:
        errors = []
        if not all([nom.strip(), ville.strip(), pays.strip(), themes, email.strip()]):
            errors.append("Merci de remplir tous les champs obligatoires (*).")
        if email and ("@" not in email or "." not in email.split("@")[-1]):
            errors.append("Adresse email invalide.")
        if nom.strip().lower() in df["Nom"].str.lower().values:
            errors.append("Cette organisation existe déjà.")
        if errors:
            for e in errors:
                st.error(e)
            return
        save_inscription({"Type": type_, "Nom": nom.strip(), "Ville": ville.strip(), "Pays": pays.strip(),
                          "Thématique": ", ".join(themes), "Taille": int(taille), "Statut": "Moyen",
                          "Statut_color": STATUT_COLORS["Moyen"], "Email": email.strip(), "Site": site.strip(),
                          "Tel": tel.strip(), "Adresse": adresse.strip(), "Image": ""})
        st.success(f"{nom} a été inscrite. Elle apparaît dès maintenant dans l'annuaire et le matching.")

def show_dashboard():
    nb_universites = df[df['Type'] == "Université"].shape[0]
    nb_entreprises = df[df['Type'] == "Entreprise"].shape[0]
    actifs = df[df['Statut'] == "Actif"].shape[0]
    moyens = df[df['Statut'] == "Moyen"].shape[0]
    inactifs = df[df['Statut'] == "Inactif"].shape[0]
    rng = np.random.default_rng(42)  # données de démo stables entre les rafraîchissements
    collaborations = int(rng.integers(30, 100))
    revenu_premium = int(rng.integers(7000, 30000))
    taux_retention = round(rng.uniform(0.70, 0.97), 2)
    taux_satisfaction = round(rng.uniform(0.75, 0.97), 2)
    st.markdown("<h2 style='color:#004080;'>📊 Dashboard KPI (live)</h2>", unsafe_allow_html=True)
    kpi1, kpi2, kpi3, kpi4, kpi5, kpi6 = st.columns(6)
    kpi1.metric("Universités", nb_universites)
    kpi2.metric("Entreprises", nb_entreprises)
    kpi3.metric("Actifs", actifs)
    kpi4.metric("Moyens", moyens)
    kpi5.metric("Inactifs", inactifs)
    kpi6.metric("Revenus premium (€)", revenu_premium)
    st.markdown("---")
    c1, c2, c3 = st.columns(3)
    with c1:
        fig1 = go.Figure(data=[go.Pie(labels=["Actif", "Moyen", "Inactif"], values=[actifs, moyens, inactifs], hole=.4)])
        fig1.update_layout(title_text="Répartition statut")
        st.plotly_chart(fig1, width="stretch")
    with c2:
        st.metric("Collaborations initiées", collaborations)
        st.metric("Taux de rétention", f"{int(taux_retention*100)}%")
        st.metric("Taux de satisfaction", f"{int(taux_satisfaction*100)}%")
    with c3:
        fig2 = go.Figure()
        x_vals = [f"M-{i}" for i in range(11, -1, -1)]
        y_vals = (np.cumsum(rng.integers(2, 15, 12)) + 40).tolist()
        fig2.add_trace(go.Scatter(x=x_vals, y=y_vals, mode='lines+markers', name="Collaborations"))
        fig2.update_layout(title_text="Evolution collaborations")
        st.plotly_chart(fig2, width="stretch")
    st.success("Dashboard live : tous les KPI stratégiques pour piloter la plateforme en un coup d'œil.")

if menu == "Annuaire":
    show_directory()
elif menu == "Inscription":
    show_registration()
elif menu == "Dashboard KPI":
    show_dashboard()
elif menu == "Universités":
    st.markdown('<div style="margin-top:18px;margin-bottom:6px;"><b>Recherche intelligente de partenaires pour Universités</b></div>', unsafe_allow_html=True)
    show_matching_score("Université")
elif menu == "Entreprises":
    st.markdown('<div style="margin-top:18px;margin-bottom:6px;"><b>Recherche intelligente de partenaires pour Entreprises</b></div>', unsafe_allow_html=True)
    show_matching_score("Entreprise")

st.caption("Prototype avancé Agora B2B Pro – Matching dynamique, scoring, statuts, dashboard. Version personnalisable.")
