import streamlit as st
import pandas as pd

# -------- CSS DESIGN --------
st.markdown("""
    <style>
    .main {background: #F7F9FB;}
    .big-title {font-size:2.6rem; font-weight:800; color:#173E6C; letter-spacing:2px;}
    .subtitle {font-size:1.2rem; color:#2479C6; margin-bottom:28px;}
    .nav {background:#173E6C; border-radius:18px; margin-bottom:36px; padding:14px 36px;}
    .nav label {color:#FFF; font-weight:700; font-size:1.18rem;}
    .card {display:flex; align-items:center; background:white; border-radius:18px; margin-bottom:26px; box-shadow:0 1px 8px #0001; padding:22px;}
    .card img {width:128px; height:78px; border-radius:12px; object-fit:cover; border:1px solid #ddd; margin-right:26px;}
    .score {font-weight:800; font-size:1.6rem;}
    .score.green {color:#1BC47D;}
    .score.orange {color:#FFC300;}
    .score.red {color:#D8334A;}
    .dot {height:13px; width:13px; border-radius:50%; display:inline-block; margin-right:7px;}
    .dot.green {background:#1BC47D;}
    .dot.orange {background:#FFC300;}
    .dot.red {background:#D8334A;}
    .tag {display:inline-block; background:#e9f4ff; color:#2479C6; border-radius:6px; padding:2px 10px; font-size:1rem; margin:0 6px 2px 0;}
    </style>
""", unsafe_allow_html=True)

# -------- DATA (Exemples - à remplacer par tes datas réelles) --------
universites = [
    {
        "Nom": "University of Oxford",
        "Ville": "Oxford",
        "Pays": "Royaume-Uni",
        "Thematique": "Généraliste, Recherche",
        "Taille": 25000,
        "Statut": "Actif",
        "Score": 97,
        "Image": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?fit=crop&w=400&q=80"
    },
    {
        "Nom": "Université Paris-Saclay",
        "Ville": "Paris",
        "Pays": "France",
        "Thematique": "Sciences, Ingénierie",
        "Taille": 30000,
        "Statut": "Moyen",
        "Score": 81,
        "Image": "https://images.unsplash.com/photo-1464983953574-0892a716854b?fit=crop&w=400&q=80"
    },
    {
        "Nom": "University of Tokyo",
        "Ville": "Tokyo",
        "Pays": "Japon",
        "Thematique": "Tech, Recherche",
        "Taille": 27000,
        "Statut": "Inactif",
        "Score": 64,
        "Image": "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?fit=crop&w=400&q=80"
    }
]

entreprises = [
    {
        "Nom": "SAP",
        "Ville": "Walldorf",
        "Pays": "Allemagne",
        "Thematique": "Logiciel, Tech",
        "Taille": 100000,
        "Statut": "Actif",
        "Score": 94,
        "Image": "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?fit=crop&w=400&q=80"
    },
    {
        "Nom": "Tata Consultancy",
        "Ville": "Mumbai",
        "Pays": "Inde",
        "Thematique": "Conseil, IT",
        "Taille": 60000,
        "Statut": "Moyen",
        "Score": 76,
        "Image": "https://images.unsplash.com/photo-1466018885580-22a4b0c3b2a7?fit=crop&w=400&q=80"
    },
    {
        "Nom": "Accenture",
        "Ville": "Paris",
        "Pays": "France",
        "Thematique": "Conseil, Stratégie",
        "Taille": 40000,
        "Statut": "Inactif",
        "Score": 53,
        "Image": "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?fit=crop&w=400&q=80"
    }
]

def statut_dot(stat):
    if stat == "Actif": return "dot green"
    if stat == "Moyen": return "dot orange"
    return "dot red"

def score_color(score):
    if score > 85: return "score green"
    if score > 65: return "score orange"
    return "score red"

# -------- NAVIGATION --------
tab = st.radio("", ["Universités", "Entreprises", "Dashboard KPI"], key="main_nav", horizontal=True)

st.markdown('<div class="big-title">Agora B2B Plateforme Pro</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Mise en relation Universités & Entreprises dans le monde</div>', unsafe_allow_html=True)

if tab == "Universités":
    st.markdown('<div class="nav"><label>Recherche intelligente de partenaires pour <b>Universités</b></label></div>', unsafe_allow_html=True)
    nom = st.text_input("Nom de la structure")
    taille = st.slider("Taille de la structure", 1000, 50000, 22000)
    pays = st.selectbox("Pays souhaité pour les partenaires", sorted({u["Pays"] for u in universites}))
    thematiques = st.multiselect("Thématiques recherchées", ["Généraliste", "Recherche", "Sciences", "Ingénierie", "Tech"])
    nb_partenaires = st.slider("Nombre de partenaires recherchés", 1, 5, 2)
    st.write("---")
    st.markdown("### Résultat de recherche :")
    results = [u for u in universites if u["Pays"] == pays][:nb_partenaires]
    if results:
        for res in results:
            st.markdown(
                f"""
                <div class="card">
                    <img src="{res['Image']}" alt="universite"/>
                    <div>
                        <span class="{statut_dot(res['Statut'])}"></span>
                        <span class="{score_color(res['Score'])}">{res['Score']}%</span> <b>{res['Nom']} ({res['Ville']}, {res['Pays']})</b><br>
                        <span class="tag">{res['Thematique']}</span><br>
                        <b>Statut :</b> {res['Statut']}
                    </div>
                </div>
                """, unsafe_allow_html=True
            )
    else:
        st.info("Aucun partenaire correspondant. Essayez un autre pays ou critère.")

elif tab == "Entreprises":
    st.markdown('<div class="nav"><label>Recherche intelligente de partenaires pour <b>Entreprises</b></label></div>', unsafe_allow_html=True)
    nom = st.text_input("Nom de l\'entreprise")
    taille = st.slider("Taille de l\'entreprise", 50, 120000, 2000)
    pays = st.selectbox("Pays souhaité pour les partenaires", sorted({e["Pays"] for e in entreprises}))
    thematiques = st.multiselect("Thématiques recherchées", ["Tech", "Logiciel", "Conseil", "IT", "Stratégie"])
    nb_partenaires = st.slider("Nombre de partenaires recherchés", 1, 5, 2)
    st.write("---")
    st.markdown("### Résultat de recherche :")
    results = [e for e in entreprises if e["Pays"] == pays][:nb_partenaires]
    if results:
        for res in results:
            st.markdown(
                f"""
                <div class="card">
                    <img src="{res['Image']}" alt="entreprise"/>
                    <div>
                        <span class="{statut_dot(res['Statut'])}"></span>
                        <span class="{score_color(res['Score'])}">{res['Score']}%</span> <b>{res['Nom']} ({res['Ville']}, {res['Pays']})</b><br>
                        <span class="tag">{res['Thematique']}</span><br>
                        <b>Statut :</b> {res['Statut']}
                    </div>
                </div>
                """, unsafe_allow_html=True
            )
    else:
        st.info("Aucun partenaire correspondant. Essayez un autre pays ou critère.")

elif tab == "Dashboard KPI":
    st.markdown('<div class="nav"><label>Dashboard KPI (démo)</label></div>', unsafe_allow_html=True)
    st.markdown("""
        <div class="card" style="background:#f7f8fa">
            <div>
                <span class="score green">38</span> <b>Partenariats actifs</b><br>
                <span class="score orange">93%</span> <b>Taux de satisfaction</b><br>
                <span class="score red">12</span> <b>Universités connectées</b>
            </div>
        </div>
    """, unsafe_allow_html=True)

st.markdown("""
    <hr>
    <div style="text-align:center;color:#aaa;font-size:14px;padding-bottom:20px">
    © 2024 Agora B2B - Plateforme. <a href='#' style='color:#2479C6;'>Contact</a>
    </div>
""", unsafe_allow_html=True)
