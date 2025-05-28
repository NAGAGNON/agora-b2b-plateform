import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image
import requests
from io import BytesIO

# ---------- STYLE GLOBAL ----------
st.set_page_config(page_title="Agora B2B Plateforme Pro", layout="wide")

st.markdown("""
    <style>
        body, .stApp {
            background: #f4f6fa;
        }
        .main-header {
            background: linear-gradient(90deg, #222831 0%, #C1272D 100%);
            padding: 30px 0 20px 0;
            text-align: center;
            border-radius: 0 0 24px 24px;
            margin-bottom: 32px;
        }
        .main-header h1 {
            color: #fff;
            font-size: 2.8rem;
            margin: 0;
            letter-spacing: 2px;
        }
        .main-header h3 {
            color: #fff;
            font-weight: 400;
            margin: 10px 0 0 0;
        }
        .stButton button {
            background: #C1272D;
            color: white;
            border-radius: 25px;
            padding: 8px 24px;
            border: none;
            font-weight: bold;
            font-size: 1.1em;
            box-shadow: 0 2px 6px rgba(0,0,0,.08);
            transition: 0.3s;
        }
        .stButton button:hover {
            background: #a51d23;
            box-shadow: 0 4px 18px #c1272d33;
        }
        .stSlider > div[data-baseweb='slider'] > div {
            background: linear-gradient(90deg, #C1272D, #00B5E2);
        }
        .stSelectbox > div, .stMultiSelect > div { border-radius:16px; }
    </style>
""", unsafe_allow_html=True)

# ---------- HEADER ----------
st.markdown("""
    <div class="main-header">
        <h1>Agora B2B Plateforme Pro</h1>
        <h3>Mise en relation Universités & Entreprises</h3>
    </div>
""", unsafe_allow_html=True)

# ---------- DONNÉES DE DÉMO ----------
@st.cache_data
def load_data():
    # Statut: "Actif", "Moyen", "Inactif"
    # Couleur statut: vert, orange, rouge
    # Score = score de matching aléatoire pour démo
    images = [
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1503676382389-4809596d5290?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1455105040324-73398c7f28ca?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1466018188580-224b0bc3b2a7?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1496307653780-42ee777d4842?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80"
    ]
    data = [
        {"Type": "Université", "Nom": "London Higher", "Ville": "Londres", "Pays": "Royaume-Uni", "Taille": 80000, "Thématique": "Généraliste", "Statut": "Actif", "Image": images[0], "Score": np.random.randint(75,99)},
        {"Type": "Université", "Nom": "University of Tokyo", "Ville": "Tokyo", "Pays": "Japon", "Taille": 60000, "Thématique": "Recherche", "Statut": "Moyen", "Image": images[1], "Score": np.random.randint(60,87)},
        {"Type": "Université", "Nom": "Seoul Metropolitan Office", "Ville": "Séoul", "Pays": "Corée du Sud", "Taille": 40000, "Thématique": "Sciences", "Statut": "Actif", "Image": images[2], "Score": np.random.randint(78,99)},
        {"Type": "Université", "Nom": "LMU Munich", "Ville": "Munich", "Pays": "Allemagne", "Taille": 45000, "Thématique": "Management", "Statut": "Actif", "Image": images[3], "Score": np.random.randint(82,99)},
        {"Type": "Université", "Nom": "University of Melbourne", "Ville": "Melbourne", "Pays": "Australie", "Taille": 52000, "Thématique": "Recherche", "Statut": "Moyen", "Image": images[4], "Score": np.random.randint(68,92)},
        {"Type": "Université", "Nom": "Ministère du Québec", "Ville": "Montréal", "Pays": "Canada", "Taille": 20000, "Thématique": "Généraliste", "Statut": "Inactif", "Image": images[5], "Score": np.random.randint(45,78)},
        {"Type": "Université", "Nom": "MIT", "Ville": "Boston", "Pays": "États-Unis", "Taille": 31000, "Thématique": "Tech", "Statut": "Actif", "Image": images[6], "Score": np.random.randint(90,99)},
        {"Type": "Université", "Nom": "Université de Paris", "Ville": "Paris", "Pays": "France", "Taille": 69000, "Thématique": "Généraliste", "Statut": "Moyen", "Image": images[7], "Score": np.random.randint(70,89)},
    ]
    df = pd.DataFrame(data)
    color_map = {"Actif":"#24C248", "Moyen":"#FF8000", "Inactif":"#C1272D"}
    df["Statut_color"] = df["Statut"].map(color_map)
    return df

df = load_data()

# ---------- KPI DASHBOARD ----------
def show_kpi(label, value, color):
    st.markdown(f"""
        <div style='display:inline-block; background:#fff; border-radius:16px; margin:10px 18px 16px 0; box-shadow:0 2px 14px #22283112;
        padding:18px 30px; text-align:center; border-top:4px solid {color}; min-width:120px;'>
            <div style='font-size:2.1rem; color:{color}; font-weight:800;'>{value}</div>
            <div style='font-size:1.1rem; color:#222831;'>{label}</div>
        </div>
        """, unsafe_allow_html=True)

# ---------- CARD DISPLAY ----------
def show_card(row):
    st.markdown(f"""
    <div style='
        background:#F3F6F9; border-radius:18px; margin:18px 0 12px 0; padding:24px; box-shadow:0 2px 14px #22283118;
        border-left:8px solid {row['Statut_color']}; display:flex; align-items:center;'>
        <img src="{row['Image']}" width="110" style='border-radius:15px; margin-right:24px; border:2px solid #FFF; box-shadow:0 1px 8px #8882;'/>
        <div style='flex:1;'>
            <h2 style='margin:0 0 6px 0; color:#222831;'>{row['Nom']}</h2>
            <p style='margin:0 0 4px 0; color:#C1272D;'><b>{row['Ville']} ({row['Pays']})</b></p>
            <span style='color:{row['Statut_color']};font-weight:600;'>Statut: {row['Statut']}</span><br>
            <span style='color:#222831;'>Thématique: <b>{row['Thématique']}</b></span><br>
            <span style='color:#00B5E2; font-size:1.1em;'><b>Score matching: {row['Score']}%</b></span>
        </div>
    </div>
    """, unsafe_allow_html=True)

# ---------- MENU ----------
menu = st.radio("Navigation", ["Universités", "Entreprises", "Dashboard KPI"], horizontal=True)

# ---------- PAGE UNIVERSITÉS ----------
if menu == "Universités":
    st.header("🔎 Recherche intelligente de partenaires pour Universités")
    with st.form("search_uni"):
        nom_uni = st.text_input("Nom de la structure", "")
        taille_uni = st.slider("Taille de la structure", 1000, 90000, 35000, step=1000)
        pays_part = st.selectbox("Pays souhaité pour les partenaires", sorted(df["Pays"].unique()))
        theme_part = st.multiselect("Thématiques recherchées", sorted(df["Thématique"].unique()))
        n_part = st.slider("Nombre de partenaires recherchés", 1, 5, 3)
        submitted = st.form_submit_button("Rechercher 🚀")

    if submitted:
        with st.spinner("Recherche des partenaires idéaux..."):
            # Matching scoring (simple démo : plus la taille, le pays, le thème sont proches, mieux c'est)
            result = df.copy()
            result["Matching"] = 0
            result["Matching"] += (result["Pays"] == pays_part) * 40
            result["Matching"] += (result["Taille"].apply(lambda x: 1 - abs(x-taille_uni)/90000) * 30).astype(int)
            result["Matching"] += (result["Thématique"].isin(theme_part)) * 30
            result = result.sort_values("Matching", ascending=False).head(n_part)
            for _, row in result.iterrows():
                show_card(row)
            if len(result)==0:
                st.warning("Aucun partenaire correspondant trouvé.")

# ---------- PAGE ENTREPRISES ----------
elif menu == "Entreprises":
    st.header("🔎 Recherche intelligente de partenaires pour Entreprises")
    with st.form("search_ent"):
        nom_ent = st.text_input("Nom de l'entreprise", "")
        pays_cible = st.selectbox("Pays cible", sorted(df["Pays"].unique()))
        secteur = st.multiselect("Secteur / Thématique recherchée", sorted(df["Thématique"].unique()))
        taille_min = st.slider("Taille minimale de l'université partenaire", 1000, 90000, 20000, step=1000)
        taille_max = st.slider("Taille maximale de l'université partenaire", 1000, 90000, 80000, step=1000)
        n_part = st.slider("Nombre de partenaires recherchés", 1, 5, 3)
        submitted2 = st.form_submit_button("Rechercher 🚀")

    if submitted2:
        with st.spinner("Recherche des partenaires idéaux..."):
            # Filtrage par taille/pays/secteur
            result = df[
                (df["Pays"] == pays_cible) &
                (df["Taille"] >= taille_min) & (df["Taille"] <= taille_max) &
                (df["Thématique"].isin(secteur))
            ].head(n_part)
            for _, row in result.iterrows():
                show_card(row)
            if len(result)==0:
                st.warning("Aucun partenaire correspondant trouvé.")

# ---------- PAGE DASHBOARD KPI ----------
elif menu == "Dashboard KPI":
    st.header("📊 Dashboard KPI (version live)")
    kpi_col1, kpi_col2, kpi_col3 = st.columns(3)
    with kpi_col1:
        show_kpi("Universités actives", df[df["Statut"]=="Actif"].shape[0], "#24C248")
        show_kpi("Universités inactives", df[df["Statut"]=="Inactif"].shape[0], "#C1272D")
    with kpi_col2:
        show_kpi("Moyenne score matching", f"{int(df['Score'].mean())}%", "#00B5E2")
        show_kpi("Nombre total", df.shape[0], "#222831")
    with kpi_col3:
        show_kpi("Pays couverts", df["Pays"].nunique(), "#FF8000")
        show_kpi("Thématiques", df["Thématique"].nunique(), "#C1272D")
    st.info("KPIs dynamiques – Personnalise selon tes vraies données !")

st.markdown("<br><br><center><small style='color:#C1272D;'>v1.0 – Design premium réalisé avec ❤️ par ChatGPT pour Global Born / Agora</small></center>", unsafe_allow_html=True)

