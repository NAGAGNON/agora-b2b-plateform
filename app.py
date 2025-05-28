import streamlit as st
import pandas as pd
import requests
from PIL import Image
from io import BytesIO

# Custom CSS pour un vrai style pro
st.markdown("""
    <style>
    .main { background-color: #f4f7fa; }
    .big-title {
        font-size:3rem; 
        font-weight:700; 
        text-align:center; 
        color:#183153;
        margin-bottom:0;
        margin-top:0.7em;
    }
    .subtitle {
        font-size:1.4rem; 
        color:#1c3a52;
        text-align:center;
        margin-bottom:2em;
        margin-top:0.3em;
    }
    .univ-card {
        background:white;
        border-radius:18px;
        box-shadow:0 8px 28px 0 rgba(41,60,110,.08);
        padding:1.6em 2em 2em 2em;
        margin-bottom:2.2em;
        max-width:620px;
        margin-left:auto;
        margin-right:auto;
    }
    .score {
        font-size:2rem;
        font-weight:700;
        margin-bottom:0.8em;
    }
    .statut-dot {
        height:18px;
        width:18px;
        border-radius:50%;
        display:inline-block;
        margin-right:0.8em;
        border:1.5px solid #bbb;
    }
    .shadow-img {
        box-shadow:0 4px 15px rgba(50,60,70,0.12);
        border-radius:14px;
        margin-bottom:1.2em;
        width:92%;
        display:block;
        margin-left:auto;
        margin-right:auto;
        object-fit:cover;
        min-height:120px;
        max-height:180px;
    }
    </style>
""", unsafe_allow_html=True)

# Header façon Globalborn
st.markdown('<div class="big-title">Agora B2B Plateforme Pro</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Mise en relation Universités & Entreprises dans le monde</div>', unsafe_allow_html=True)

# Exemple d'universités avec images réelles (liens à adapter si tu veux plus de vrais logos)
universites = [
    {
        "nom": "University of Oxford",
        "ville": "Oxford",
        "pays": "Royaume-Uni",
        "image": "https://upload.wikimedia.org/wikipedia/commons/4/4a/Bodleian_Library_%28Oxford%29.JPG",
        "statut": "Actif",
        "score": 97,
        "thematique": "Généraliste, Recherche"
    },
    {
        "nom": "Massachusetts Institute of Technology (MIT)",
        "ville": "Cambridge",
        "pays": "États-Unis",
        "image": "https://upload.wikimedia.org/wikipedia/commons/0/0c/MIT_Building_10_and_the_Great_Dome%2C_Cambridge_MA.jpg",
        "statut": "Moyen",
        "score": 85,
        "thematique": "Tech, Innovation"
    },
    {
        "nom": "Sorbonne Université",
        "ville": "Paris",
        "pays": "France",
        "image": "https://upload.wikimedia.org/wikipedia/commons/5/53/Paris_Sorbonne_University_Main_building.jpg",
        "statut": "Inactif",
        "score": 52,
        "thematique": "Sciences, Lettres"
    }
]

def color_score(score):
    if score > 90:
        return "#10c469"  # vert
    elif score > 65:
        return "#ffcc00"  # jaune
    else:
        return "#f44336"  # rouge

def color_statut(statut):
    return {"Actif": "#10c469", "Moyen": "#ffcc00", "Inactif": "#f44336"}.get(statut, "#ccc")

st.write("")
st.markdown("#### Résultat de recherche :")

for u in universites:
    st.markdown(f"""
    <div class="univ-card">
        <span class="score" style="color:{color_score(u['score'])};">{u['score']}%</span>
        <span class="statut-dot" style="background:{color_statut(u['statut'])};"></span>
        <b>{u['nom']}</b> <span style="color:#666;">({u['ville']}, {u['pays']})</span><br>
        <img src="{u['image']}" class="shadow-img" />
        <span style="font-size:1.09em;"><b>Thématique :</b> {u['thematique']}</span><br>
        <span style="color:#333;"><b>Statut :</b> {u['statut']}</span>
    </div>
    """, unsafe_allow_html=True)

# Tu peux ensuite compléter avec la recherche dynamique ou la partie dashboard comme tu veux !
