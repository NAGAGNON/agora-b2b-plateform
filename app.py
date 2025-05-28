import streamlit as st
import pandas as pd
from PIL import Image
import requests
from io import BytesIO

# ------- DESIGN : CSS POUR TOUT LE STYLE -------
st.markdown("""
    <style>
    body {background: #f7f8fa;}
    .main {background-color: #f7f8fa;}
    header {visibility: hidden;}
    .block-container {
        padding-top: 1rem !important;
        padding-bottom: 1rem !important;
    }
    .navbar {
        background: linear-gradient(90deg, #02142b 60%, #2479C6 100%);
        color: white;
        padding: 15px 30px 15px 40px;
        font-size: 1.2rem;
        margin-bottom: 40px;
        border-radius: 0 0 25px 25px;
        display: flex; align-items: center;
        justify-content: space-between;
    }
    .navbar-title {
        font-family: 'Segoe UI', sans-serif; font-weight:700;
        font-size: 2rem;
        letter-spacing: .5px;
    }
    .navbar-link {
        color: white;
        margin-left: 2rem;
        text-decoration: none;
        font-weight: bold;
        font-size: 1.1rem;
        transition: color 0.2s;
    }
    .navbar-link:hover {
        color: #F9E79F;
    }
    .kpi-box {
        background: #e9f4ff; border-radius:18px; padding: 24px; margin-bottom:30px;
        box-shadow: 0 1px 6px #02142b15;
    }
    .result-card {
        background: white; border-radius: 18px; margin-bottom: 30px;
        box-shadow: 0 2px 16px #02142b10;
        padding: 28px 22px;
        display: flex; align-items: center;
    }
    .img-card {
        border-radius: 15px; margin-right: 26px;
        border: 1px solid #eee; width: 160px; height: 90px; object-fit: cover;
    }
    .score {
        font-weight: 900; font-size: 2rem; color: #1BC47D; margin-bottom: 7px;
    }
    .dot {
        height: 15px; width: 15px; border-radius:50%; display:inline-block;
        margin-right: 6px; vertical-align: middle;
    }
    .dot-actif {background: #1BC47D;}
    .dot-moyen {background: #F7CA18;}
    .dot-inactif {background: #D8334A;}
    .tag {
        display: inline-block;
        background: #e0e7ff;
        color: #02142b;
        font-size: 1rem;
        border-radius: 8px;
        padding: 2px 10px;
        margin-right: 5px;
    }
    </style>
""", unsafe_allow_html=True)

# -------- BARRE DE NAVIGATION ---------
st.markdown("""
<div class="navbar">
    <span class="navbar-title">Agora B2B Plateforme Pro</span>
    <span>
        <a class="navbar-link" href="#universite">Universités</a>
        <a class="navbar-link" href="#entreprise">Entreprises</a>
        <a class="navbar-link" href="#kpi">Dashboard KPI</a>
    </span>
</div>
""", unsafe_allow_html=True)

# -------- DATA D'EXEMPLE ---------
universites = [
    {
        "Nom": "University of Oxford",
        "Ville": "Oxford",
        "Pays": "Royaume-Uni",
        "Thématique": "Généraliste, Recherche",
        "Taille": 25000,
        "Statut": "Actif",
        "Score": 97,
        "Image": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?fit=crop&w=500&q=80"  # campus UK
    },
    {
        "Nom": "Harvard University",
        "Ville": "Cambridge",
        "Pays": "États-Unis",
        "Thématique": "Sciences, Ingénierie",
        "Taille": 33000,
        "Statut": "Moyen",
        "Score": 83,
        "Image": "https://images.unsplash.com/photo-1464983953574-0892a716854b?fit=crop&w=500&q=80" # campus US
    },
    {
        "Nom": "Université de Tokyo",
        "Ville": "Tokyo",
        "Pays": "Japon",
        "Thématique": "Tech, Recherche",
        "Taille": 27000,
        "Statut": "Inactif",
        "Score": 69,
        "Image": "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?fit=crop&w=500&q=80" # campus Asie
    },
]

entreprises = [
    {
        "Nom": "SAP",
        "Ville": "Walldorf",
        "Pays": "Allemagne",
        "Thématique": "Logiciel, Tech",
        "Taille": 100000,
        "Statut": "Actif",
        "Score": 92,
        "Image": "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?fit=crop&w=500&q=80" # bureaux modernes
    },
    {
        "Nom": "Tata Consultancy",
        "Ville": "Mumbai",
        "Pays": "Inde",
        "Thématique": "Conseil, IT",
        "Taille": 60000,
        "Statut": "Moyen",
        "Score": 74,
        "Image": "https://images.unsplash.com/photo-1466018885580-22a4b0c3b2a7?fit=crop&w=500&q=80"
    },
    {
        "Nom": "Accenture",
        "Ville": "Paris",
        "Pays": "France",
        "Thématique": "Conseil, Stratégie",
        "Taille": 40000,
        "Statut": "Inactif",
        "Score": 63,
        "Image": "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?fit=crop&w=500&q=80"
    }
]

def statut_color(stat):
    if stat == "Actif": return "dot dot-actif"
    elif stat == "Moyen": return "dot dot-moyen"
    else: return "dot dot-inactif"

# ----------- TABS -----------

tab = st.radio("Navigation :", ["Universités", "Entreprises", "Dashboard KPI"], horizontal=True)

if tab == "Universités":
    st.markdown("<h2 id='universite'>Recherche intelligente de partenaires pour Universités</h2>", unsafe_allow_html=True)
    nom = st.text_input("Nom de la structure")
    taille = st.slider("Taille de la structure", 1000, 50000, 22000)
    pays = st.selectbox("Pays souhaité pour les partenaires", sorted({u["Pays"] for u in universites}))
    thematiques = st.multiselect("Thématiques recherchées", ["Généraliste", "Recherche", "Sciences", "Ingénierie", "Tech"])
    nb_partenaires = st.slider("Nombre de partenaires recherchés", 1, 5, 3)
    st.write("---")
    st.markdown("### Résultat de recherche :")
    # Simule le matching en triant par score et pays
    results = [u for u in universites if u["Pays"] == pays][:nb_partenaires]
    if results:
        for res in results:
            st.markdown(
                f"""
                <div class="result-card">
                    <img class="img-card" src="{res['Image']}" alt="campus"/>
                    <div>
                        <span class="{statut_color(res['Statut'])}"></span>
                        <span class="score">{res['Score']}%</span>
                        <b>{res['Nom']} ({res['Ville']}, {res['Pays']})</b><br>
                        <span class="tag">{res['Thématique']}</span>
                        <br>
                        <b>Statut :</b> {res['Statut']}
                    </div>
                </div>
                """, unsafe_allow_html=True
            )
    else:
        st.info("Aucun partenaire correspondant. Essayez un autre pays ou critère.")

elif tab == "Entreprises":
    st.markdown("<h2 id='entreprise'>Recherche intelligente de partenaires pour Entreprises</h2>", unsafe_allow_html=True)
    nom = st.text_input("Nom de l'entreprise")
    taille = st.slider("Taille de l'entreprise", 50, 120000, 2000)
    pays = st.selectbox("Pays souhaité pour les partenaires", sorted({e["Pays"] for e in entreprises}))
    thematiques = st.multiselect("Thématiques recherchées", ["Tech", "Logiciel", "Conseil", "IT", "Stratégie"])
    nb_partenaires = st.slider("Nombre de partenaires recherchés", 1, 5, 2)
    st.write("---")
    st.markdown("### Résultat de recherche :")
    # Simule le matching en triant par score et pays
    results = [e for e in entreprises if e["Pays"] == pays][:nb_partenaires]
    if results:
        for res in results:
            st.markdown(
                f"""
                <div class="result-card">
                    <img class="img-card" src="{res['Image']}" alt="entreprise"/>
                    <div>
                        <span class="{statut_color(res['Statut'])}"></span>
                        <span class="score">{res['Score']}%</span>
                        <b>{res['Nom']} ({res['Ville']}, {res['Pays']})</b><br>
                        <span class="tag">{res['Thématique']}</span>
                        <br>
                        <b>Statut :</b> {res['Statut']}
                    </div>
                </div>
                """, unsafe_allow_html=True
            )
    else:
        st.info("Aucun partenaire correspondant. Essayez un autre pays ou critère.")

elif tab == "Dashboard KPI":
    st.markdown("<h2 id='kpi'>Dashboard KPI (démo)</h2>", unsafe_allow_html=True)
    st.markdown("""
        <div class="kpi-box">
            <b>Nombre de partenariats actifs :</b> <span style="font-size:2rem; color:#1BC47D;">38</span><br>
            <b>Taux de satisfaction :</b> <span style="font-size:2rem; color:#2479C6;">93%</span><br>
            <b>Universités connectées :</b> <span style="font-size:2rem; color:#D8334A;">12</span>
        </div>
    """, unsafe_allow_html=True)
    st.info("Ce dashboard peut intégrer vos KPI dynamiquement (Graphiques, historiques, etc).")

# --------- FOOTER ---------
st.markdown("""
    <hr style="margin-top:45px;">
    <div style="text-align:center;color:#aaa;font-size:14px;padding-bottom:22px">
    © 2024 Agora B2B - Plateforme de mise en relation Universités & Entreprises. <br>
    <a href='#' style='color:#2479C6;'>Contact</a> | <a href='#' style='color:#2479C6;'>Mentions légales</a>
    </div>
""", unsafe_allow_html=True)
