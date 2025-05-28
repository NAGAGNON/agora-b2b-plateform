import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image
import requests
from io import BytesIO
import plotly.graph_objects as go

st.set_page_config(page_title="Agora B2B Pro", layout="wide")

FALLBACK_IMG = "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg"

@st.cache_data
def load_data():
    images = [
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
        "https://images.unsplash.com/photo-1464983953574-0892a716854b",
        "https://images.unsplash.com/photo-1503676382389-4809596d5290",
        "https://images.unsplash.com/photo-1465101046530-73398c7f28ca",
        "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2",
        "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61",
        "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a",
        "https://images.unsplash.com/photo-1466301588502-22a4b0c3b2a7",
        "https://images.unsplash.com/photo-1496307653780-42ee777d4842",
        "https://images.unsplash.com/photo-1519125323398-675f0ddb6308"
    ]
    data = [
        {"Type": "Université", "Nom": "London Higher", "Ville": "Londres", "Pays": "Royaume-Uni", "Thématique": "Généraliste, Innovation", "Taille": 60000, "Statut": "Actif", "Statut_color": "green", "Image": images[0]},
        {"Type": "Université", "Nom": "University of Tokyo", "Ville": "Tokyo", "Pays": "Japon", "Thématique": "Recherche, Sciences", "Taille": 80000, "Statut": "Moyen", "Statut_color": "yellow", "Image": images[1]},
        {"Type": "Université", "Nom": "Seoul Metropolitan Office of Education", "Ville": "Séoul", "Pays": "Corée du Sud", "Thématique": "Management, Education", "Taille": 30000, "Statut": "Inactif", "Statut_color": "red", "Image": images[2]},
        {"Type": "Université", "Nom": "LMU Munich", "Ville": "Munich", "Pays": "Allemagne", "Thématique": "Généraliste, Recherche", "Taille": 45000, "Statut": "Actif", "Statut_color": "green", "Image": images[3]},
        {"Type": "Université", "Nom": "University of Melbourne", "Ville": "Melbourne", "Pays": "Australie", "Thématique": "Innovation, Sciences", "Taille": 52000, "Statut": "Actif", "Statut_color": "green", "Image": images[4]},
        {"Type": "Université", "Nom": "Ministère de l'Enseignement supérieur du Québec", "Ville": "Montréal", "Pays": "Canada", "Thématique": "Politiques publiques, Education", "Taille": 25000, "Statut": "Moyen", "Statut_color": "yellow", "Image": images[5]},
        {"Type": "Université", "Nom": "Massachusetts Dept. of Higher Education", "Ville": "Boston", "Pays": "États-Unis", "Thématique": "Politiques publiques, Sciences", "Taille": 67000, "Statut": "Inactif", "Statut_color": "red", "Image": images[6]},
        {"Type": "Université", "Nom": "Ministère de l'Éducation nationale", "Ville": "Paris", "Pays": "France", "Thématique": "Education, Gouvernance", "Taille": 50000, "Statut": "Actif", "Statut_color": "green", "Image": images[7]},
        {"Type": "Université", "Nom": "University of Amsterdam", "Ville": "Amsterdam", "Pays": "Pays-Bas", "Thématique": "Sciences, Recherche", "Taille": 42000, "Statut": "Moyen", "Statut_color": "yellow", "Image": images[8]},
        {"Type": "Université", "Nom": "Ministry of Education Singapore", "Ville": "Singapour", "Pays": "Singapour", "Thématique": "Education, Management", "Taille": 51000, "Statut": "Actif", "Statut_color": "green", "Image": images[9]},
        # Entreprises
        {"Type": "Entreprise", "Nom": "Capgemini", "Ville": "Paris", "Pays": "France", "Thématique": "Conseil, Tech", "Taille": 40000, "Statut": "Moyen", "Statut_color": "yellow", "Image": images[7]},
        {"Type": "Entreprise", "Nom": "SAP", "Ville": "Walldorf", "Pays": "Allemagne", "Thématique": "Tech, Logiciel", "Taille": 85000, "Statut": "Actif", "Statut_color": "green", "Image": images[3]},
        {"Type": "Entreprise", "Nom": "Tata Consultancy", "Ville": "Mumbai", "Pays": "Inde", "Thématique": "Tech, Conseil", "Taille": 85000, "Statut": "Inactif", "Statut_color": "red", "Image": images[1]},
    ]
    return pd.DataFrame(data)

df = load_data()

# --- UI HEADER (plus d'image, tout centré pro) ---
st.markdown("<h1 style='text-align: center; color: #004080;'>Agora B2B Plateforme Pro</h1>", unsafe_allow_html=True)
st.markdown("<h3 style='text-align: center;'>Mise en relation Universités & Entreprises</h3>", unsafe_allow_html=True)
st.write("")  # espace

menu = st.radio("Navigation :", ["Universités", "Entreprises", "Dashboard KPI"], horizontal=True)

# --- MATCHING SCORING ---
def match_score(row, type_sel, pays, taille, theme, statut_ref="Actif"):
    score = 0
    # Pays exact = 40 pts, sinon 0
    score += 40 if row["Pays"] == pays else 0
    # Taille : score linéaire, max 30 pts si delta 0, min 0 pts si delta > 50k
    delta = abs(row["Taille"] - taille)
    score += max(0, 30 - int(delta / 2000))  # perte de 1 pt par 2000 étudiants d'écart
    # Thématique : +30 pts si 1 thématique commune, +60 pts si 2+, 0 sinon
    th_row = [x.strip() for x in row["Thématique"].split(",")]
    nb_common = len(set(th_row).intersection(set(theme)))
    score += 60 if nb_common > 1 else (30 if nb_common == 1 else 0)
    # Statut bonus/malus
    if row["Statut"] == "Actif":
        score += 10
    elif row["Statut"] == "Moyen":
        score -= 5
    elif row["Statut"] == "Inactif":
        score -= 10
    return max(0, min(100, score))  # normalisation

def show_matching_score(type_sel):
    st.markdown(f"### Critères de recherche pour une {type_sel.lower()}")
    nom = st.text_input("Nom de la structure")
    taille = st.slider("Taille de la structure", 1000, 100000, 30000, 1000)
    pays = st.selectbox("Pays souhaité pour les partenaires", sorted(df['Pays'].unique()))
    theme_opts = sorted(set([t.strip() for x in df['Thématique'].unique() for t in x.split(",")]))
    theme = st.multiselect("Thématiques recherchées", theme_opts)
    nb_part = st.slider("Nombre de partenaires recherchés", 1, 10, 3)

    if st.button("Trouver les partenaires adaptés"):
        # On sélectionne tous les autres (entreprise/université opposé)
        candidates = df[df['Type'] != type_sel].copy()
        candidates["Score"] = candidates.apply(
            lambda row: match_score(row, type_sel, pays, taille, theme), axis=1
        )
        candidates = candidates.sort_values("Score", ascending=False).head(nb_part)
        st.markdown("#### Résultat de votre recherche (score de correspondance : 100 = partenaire parfait)")
        for idx, row in candidates.iterrows():
            score_color = "green" if row["Score"] >= 80 else "orange" if row["Score"] >= 60 else "red"
            cc1, cc2 = st.columns([1,7])
            with cc1:
                st.markdown(f"<div style='margin-top: 38px;'><span style='color:{row['Statut_color']};font-size:36px;'>&#9679;</span></div>", unsafe_allow_html=True)
                st.markdown(f"<b style='color:{score_color};font-size:24px;'>{row['Score']}%</b>", unsafe_allow_html=True)
            with cc2:
                st.markdown(f"<h4>{row['Nom']} ({row['Ville']}, {row['Pays']})</h4>", unsafe_allow_html=True)
                try:
                    response = requests.get(row["Image"], timeout=3)
                    img = Image.open(BytesIO(response.content))
                    st.image(img, width=220)
                except Exception:
                    st.image(FALLBACK_IMG, width=120)
                st.markdown(f"<b>Thématique :</b> {row['Thématique']}", unsafe_allow_html=True)
                st.markdown(f"<b>Statut :</b> <span style='color:{row['Statut_color']}'>{row['Statut']}</span>", unsafe_allow_html=True)
                st.markdown("---")
        if len(candidates) == 0 or candidates["Score"].max() < 60:
            st.warning("Aucun partenaire parfaitement adapté, mais voici les plus proches selon vos critères.")

# ---------- DASHBOARD KPI ----------
def show_dashboard():
    nb_universites = df[df['Type'] == "Université"].shape[0]
    nb_entreprises = df[df['Type'] == "Entreprise"].shape[0]
    actifs = df[df['Statut'] == "Actif"].shape[0]
    moyens = df[df['Statut'] == "Moyen"].shape[0]
    inactifs = df[df['Statut'] == "Inactif"].shape[0]
    collaborations = np.random.randint(30, 100)
    revenu_premium = np.random.randint(7000, 30000)
    taux_retention = round(np.random.uniform(0.70, 0.97), 2)
    taux_satisfaction = round(np.random.uniform(0.75, 0.97), 2)
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
        st.plotly_chart(fig1, use_container_width=True)
    with c2:
        st.metric("Collaborations initiées", collaborations)
        st.metric("Taux de rétention", f"{int(taux_retention*100)}%")
        st.metric("Taux de satisfaction", f"{int(taux_satisfaction*100)}%")
    with c3:
        fig2 = go.Figure()
        x_vals = [f"M-{i}" for i in range(11, -1, -1)]
        y_vals = (np.cumsum(np.random.randint(2, 15, 12)) + 40).tolist()
        fig2.add_trace(go.Scatter(x=x_vals, y=y_vals, mode='lines+markers', name="Collaborations"))
        fig2.update_layout(title_text="Evolution collaborations")
        st.plotly_chart(fig2, use_container_width=True)
    st.success("Dashboard live : tous les KPI stratégiques pour piloter la plateforme en un coup d'œil.")

# ----------- ROUTER -----------
if menu == "Dashboard KPI":
    show_dashboard()
elif menu == "Universités":
    st.markdown("#### Recherche intelligente de partenaires pour Universités")
    show_matching_score("Université")
elif menu == "Entreprises":
    st.markdown("#### Recherche intelligente de partenaires pour Entreprises")
    show_matching_score("Entreprise")

st.caption("Prototype avancé Agora B2B Pro – Matching dynamique, scoring, statuts, dashboard. Version personnalisable.")
