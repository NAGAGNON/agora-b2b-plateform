import streamlit as st

# ------ DESIGN Streamlit ------
st.set_page_config(page_title="Agora B2B Plateforme Pro", layout="wide")
st.markdown("""
    <style>
    .big-title { font-size: 3em; color: #073763; font-weight: bold; text-align: center; margin-bottom: 0.2em; }
    .subtitle { font-size: 1.3em; color: #274e13; text-align: center; margin-bottom: 1.5em; }
    .result-title { color: #38761d; font-size: 1.2em; font-weight: bold; margin-top: 1em; }
    .partner-card { background: white; border-radius: 15px; box-shadow: 0 4px 24px rgba(100,100,150,0.12); padding: 1.2em; margin-bottom: 2em; transition: 0.3s;}
    .score { font-size: 1.5em; font-weight: bold;}
    </style>
""", unsafe_allow_html=True)

# ------ HEADER ------
st.markdown('<div class="big-title">Agora B2B Plateforme Pro</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Mise en relation Universités & Entreprises dans le monde 🌍</div>', unsafe_allow_html=True)

# ------ NAVIGATION ------
tab = st.radio("Navigation :", ["Universités", "Entreprises", "Dashboard KPI"], horizontal=True)

# ------ DATA FAKE -------
universites = [
    {
        "nom": "University of Oxford", "ville": "Oxford", "pays": "Royaume-Uni",
        "taille": 24000, "thematique": ["Généraliste", "Recherche"], "statut": "Actif",
        "score": 97, "image": "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
    },
    {
        "nom": "Harvard University", "ville": "Cambridge", "pays": "USA",
        "taille": 20000, "thematique": ["Management", "Recherche"], "statut": "Moyen",
        "score": 88, "image": "https://images.unsplash.com/photo-1464983953574-0892a716854b"
    },
    {
        "nom": "Université de Montréal", "ville": "Montréal", "pays": "Canada",
        "taille": 15000, "thematique": ["Tech", "Recherche"], "statut": "Inactif",
        "score": 71, "image": "https://images.unsplash.com/photo-1503676382389-4809596d5290"
    }
]

entreprises = [
    {
        "nom": "SAP", "ville": "Walldorf", "pays": "Allemagne", "taille": 100000,
        "domaine": ["Tech", "Logiciel"], "statut": "Actif", "score": 91,
        "image": "https://images.unsplash.com/photo-1454023492550-5696f8ff10e1"
    },
    {
        "nom": "Tata Consultancy", "ville": "Mumbai", "pays": "Inde", "taille": 400000,
        "domaine": ["Tech", "Conseil"], "statut": "Moyen", "score": 77,
        "image": "https://images.unsplash.com/photo-1482062364825-616fd23b8fc1"
    }
]

# ------ UNIVERSITÉS ------
if tab == "Universités":
    st.header("🔎 Recherche intelligente de partenaires pour Universités")
    with st.form("universite_form"):
        nom = st.text_input("Nom de la structure")
        taille = st.slider("Taille de la structure", 1000, 100000, 35000, step=500)
        pays_cible = st.selectbox("Pays souhaité pour les partenaires", ["France", "Allemagne", "Royaume-Uni", "USA", "Canada"])
        thematiques = st.multiselect("Thématiques recherchées", ["Généraliste", "Management", "Tech", "Recherche"])
        nb_partenaires = st.slider("Nombre de partenaires recherchés", 1, 10, 3)
        submit_uni = st.form_submit_button("Trouver mes partenaires idéaux")
    
    if submit_uni:
        # Système simple de recommandation par score
        results = []
        for u in universites:
            score = u['score']
            # Bonus si le pays matche
            if u["pays"] == pays_cible:
                score += 7
            # Bonus si une thématique matche
            score += 5 * len(set(u["thematique"]).intersection(thematiques))
            results.append({**u, "score": min(100, score)})
        results = sorted(results, key=lambda
