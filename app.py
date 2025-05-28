import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image
import requests
from io import BytesIO
import plotly.graph_objects as go

st.set_page_config(page_title="Agora B2B Pro", layout="wide")

@st.cache_data
def load_data():
    images = [
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb",  # Université UK
        "https://images.unsplash.com/photo-1464983953574-0892a716854b",  # Université JP
        "https://images.unsplash.com/photo-1503676382389-4809596d5290",  # Université KR
        "https://images.unsplash.com/photo-1465101046530-73398c7f28ca",  # Université DE
        "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2",  # Université AU
        "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61",  # Université CA
        "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a",  # Université US
        "https://images.unsplash.com/photo-1466301588502-22a4b0c3b2a7",  # Université FR
        "https://images.unsplash.com/photo-1496307653780-42ee777d4842",  # Université NL
        "https://images.unsplash.com/photo-1519125323398-675f0ddb6308"   # Université SG
    ]
    data = [
        {"Type": "Université", "Nom": "London Higher", "Ville": "Londres", "Pays": "Royaume-Uni", "Thématique": "Généraliste, Innovation", "Statut": "Actif", "Statut_color": "green", "Image": images[0]},
        {"Type": "Université", "Nom": "University of Tokyo", "Ville": "Tokyo", "Pays": "Japon", "Thématique": "Recherche, Sciences", "Statut": "Moyen", "Statut_color": "yellow", "Image": images[1]},
        {"Type": "Université", "Nom": "Seoul Metropolitan Office of Education", "Ville": "Séoul", "Pays": "Corée du Sud", "Thématique": "Management, Education", "Statut": "Inactif", "Statut_color": "red", "Image": images[2]},
        {"Type": "Université", "Nom": "LMU Munich", "Ville": "Munich", "Pays": "Allemagne", "Thématique": "Généraliste, Recherche", "Statut": "Actif", "Statut_color": "green", "Image": images[3]},
        {"Type": "Université", "Nom": "University of Melbourne", "Ville": "Melbourne", "Pays": "Australie", "Thématique": "Innovation, Sciences", "Statut": "Actif", "Statut_color": "green", "Image": images[4]},
        {"Type": "Université", "Nom": "Ministère de l'Enseignement supérieur du Québec", "Ville": "Montréal", "Pays": "Canada", "Thématique": "Politiques publiques, Education", "Statut": "Moyen", "Statut_color": "yellow", "Image": images[5]},
        {"Type": "Université", "Nom": "Massachusetts Dept. of Higher Education", "Ville": "Boston", "Pays": "États-Unis", "Thématique": "Politiques publiques, Sciences", "Statut": "Inactif", "Statut_color": "red", "Image": images[6]},
        {"Type": "Université", "Nom": "Ministère de l'Éducation nationale", "Ville": "Paris", "Pays": "France", "Thématique": "Education, Gouvernance", "Statut": "Actif", "Statut_color": "green", "Image": images[7]},
        {"Type": "Université", "Nom": "University of Amsterdam", "Ville": "Amsterdam", "Pays": "Pays-Bas", "Thématique": "Sciences, Recherche", "Statut": "Moyen", "Statut_color": "yellow", "Image": images[8]},
        {"Type": "Université", "Nom": "Ministry of Education Singapore", "Ville": "Singapour", "Pays": "Singapour", "Thématique": "Education, Management", "Statut": "Actif", "Statut_color": "green", "Image": images[9]},
        # Tu peux ajouter ici des entreprises dans le même style
        {"Type": "Entreprise", "Nom": "Capgemini", "Ville": "Paris", "Pays": "France", "Thématique": "Conseil, Tech", "Statut": "Moyen", "Statut_color": "yellow", "Image": images[7]},
        {"Type": "Entreprise", "Nom": "SAP", "Ville": "Walldorf", "Pays": "Allemagne", "Thématique": "Tech, Logiciel", "Statut": "Actif", "Statut_color": "green", "Image": images[3]},
        {"Type": "Entreprise", "Nom": "Tata Consultancy", "Ville": "Mumbai", "Pays": "Inde", "Thématique": "Tech, Conseil", "Statut": "Inactif", "Statut_color": "red", "Image": images[1]},
    ]
    return pd.DataFrame(data)

df = load_data()

# KPI simulés
np.random.seed(42)
nb_universites = df[df['Type'] == "Université"].shape[0]
nb_entreprises = df[df['Type'] == "Entreprise"].shape[0]
actifs = df[df['Statut'] == "Actif"].shape[0]
moyens = df[df['Statut'] == "Moyen"].shape[0]
inactifs = df[df['Statut'] == "Inactif"].shape[0]
collaborations = np.random.randint(30, 100)
taux_retention = round(np.random.uniform(0.70, 0.97), 2)
revenu_premium = np.random.randint(7000, 30000)
taux_satisfaction = round(np.random.uniform(0.75, 0.97), 2)

# ---- UI PRO ----
st.markdown(
    """
    <style>
    .main {
        background-image: url('https://images.unsplash.com/photo-1506744038136-46273834b3fb');
        background-size: cover;
        background-position: center;
    }
    .stApp {
        background-color: rgba(255,255,255,0.85) !important;
    }
    </style>
    """,
    unsafe_allow_html=True
)

col0, col1, col2 = st.columns([2,2,2])
with col1:
    st.image("https://upload.wikimedia.org/wikipedia/commons/1/1b/Agora-symbol.png", width=120)
st.markdown("<h1 style='text-align: center; color: #004080;'>Agora B2B Plateforme Pro</h1>", unsafe_allow_html=True)
st.markdown("<h3 style='text-align: center;'>Mise en relation Universités & Entreprises</h3>", unsafe_allow_html=True)

menu = st.radio("Je veux afficher :", ["Universités", "Entreprises", "Dashboard KPI"], horizontal=True)

# ---------- DASHBOARD KPI -----------
if menu == "Dashboard KPI":
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
    # Pie statut
    with c1:
        fig1 = go.Figure(data=[go.Pie(labels=["Actif", "Moyen", "Inactif"], values=[actifs, moyens, inactifs], hole=.4)])
        fig1.update_layout(title_text="Répartition statut")
        st.plotly_chart(fig1, use_container_width=True)
    # Collaboration et rétention
    with c2:
        st.metric("Collaborations initiées", collaborations)
        st.metric("Taux de rétention", f"{int(taux_retention*100)}%")
        st.metric("Taux de satisfaction", f"{int(taux_satisfaction*100)}%")
    # Evolution collaborateurs
    with c3:
        fig2 = go.Figure()
        x_vals = [f"M-{i}" for i in range(11, -1, -1)]
        y_vals = (np.cumsum(np.random.randint(2, 15, 12)) + 40).tolist()
        fig2.add_trace(go.Scatter(x=x_vals, y=y_vals, mode='lines+markers', name="Collaborations"))
        fig2.update_layout(title_text="Evolution collaborations")
        st.plotly_chart(fig2, use_container_width=True)
    st.success("Dashboard live : tous les KPI stratégiques pour piloter la plateforme en un coup d'œil.")

# --------- LISTE UNIVERSITÉS / ENTREPRISES -----------
else:
    type_sel = "Université" if menu == "Universités" else "Entreprise"
    st.markdown(f"<h2 style='color:#004080;'>Liste des {type_sel}s</h2>", unsafe_allow_html=True)
    pays = st.multiselect("Pays", sorted(df[df['Type'] == type_sel]['Pays'].unique()))
    statut = st.multiselect("Statut", ["Actif", "Moyen", "Inactif"], default=["Actif","Moyen","Inactif"])
    theme = st.multiselect("Thématique", sorted(set([t.strip() for x in df[df['Type'] == type_sel]['Thématique'].unique() for t in x.split(",")])))

    dff = df[(df['Type'] == type_sel)]
    if pays:
        dff = dff[dff['Pays'].isin(pays)]
    if statut:
        dff = dff[dff['Statut'].isin(statut)]
    if theme:
        dff = dff[dff['Thématique'].apply(lambda x: any(t in x for t in theme))]
    dff = dff.reset_index(drop=True)

    for idx, row in dff.iterrows():
        cc1, cc2 = st.columns([1,7])
        with cc1:
            st.markdown(f"<div style='margin-top: 40px;'><span style='color:{row['Statut_color']};font-size:38px;'>&#9679;</span></div>", unsafe_allow_html=True)
        with cc2:
            st.markdown(f"<h4>{row['Nom']} ({row['Ville']}, {row['Pays']})</h4>", unsafe_allow_html=True)
            try:
                response = requests.get(row["Image"])
                img = Image.open(BytesIO(response.content))
                st.image(img, width=280)
            except Exception:
                st.info("Image indisponible")
            st.markdown(f"<b>Thématique :</b> {row['Thématique']}", unsafe_allow_html=True)
            st.markdown(f"<b>Statut :</b> <span style='color:{row['Statut_color']}'>{row['Statut']}</span>", unsafe_allow_html=True)
            st.markdown("---")

st.caption("Prototype avancé Agora B2B Pro – UI moderne, KPI live, statuts colorés, images illustratives. Version personnalisable sur demande.")
