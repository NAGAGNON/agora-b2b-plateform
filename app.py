import streamlit as st

# ------ DESIGN ------
st.set_page_config(page_title="Agora B2B Plateforme Pro", layout="wide")
st.markdown("""
    <style>
    .big-title { font-size: 3em; color: #073763; font-weight: bold; text-align: center; margin-bottom: 0.2em; }
    .subtitle { font-size: 1.3em; color: #274e13; text-align: center; margin-bottom: 1.5em; }
    .result-title { color: #38761d; font-size: 1.2em; font-weight: bold; margin-top: 1em; }
    .partner-card { background: white; border-radius: 15px; box-shadow: 0 4px 24px rgba(100,100,150,0.11); padding: 1.2em; margin-bottom: 2em; transition: 0.3s;}
    .score { font-size: 1.5em; font-weight: bold;}
    </style>
""", unsafe_allow_html=True)

# ------ HEADER ------
st.markdown('<div class="big-title">Agora B2B Plateforme Pro</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Mise en relation Universités & Entreprises dans le monde 🌍</div>', unsafe_allow_html=True)

# ------ NAVIGATION ------
tab = st.radio("Navigation :", ["Universités", "Entreprises", "Dashboard KPI"], horizontal=True)

# ------ DATA ------
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
        # Système de matching
        results = []
        for u in universites:
            score = u['score']
            if u["pays"] == pays_cible:
                score += 7
            score += 5 * len(set(u["thematique"]).intersection(thematiques))
            results.append({**u, "score": min(100, score)})
        results = sorted(results, key=lambda x: -x["score"])[:nb_partenaires]
        st.markdown('<div class="result-title">Résultat de recherche :</div>', unsafe_allow_html=True)
        if results:
            for res in results:
                statut_color = {"Actif": "#5cb85c", "Moyen": "#f0ad4e", "Inactif": "#d9534f"}[res["statut"]]
                st.markdown(
                    f"""
                    <div class="partner-card">
                    <span style='color:{statut_color};font-size:1.5em;'>●</span>
                    <b style="font-size:1.2em">{res['nom']} ({res['ville']}, {res['pays']})</b>
                    <br>
                    <img src="{res['image']}" width="240" style="border-radius:12px;margin:10px 0;" />
                    <br>
                    <span class="score" style="color:#2670bd;"><b>{res['score']}%</b></span> 
                    <br>
                    <b>Thématique</b> : {', '.join(res['thematique'])}<br>
                    <b>Statut</b> : <span style='color:{statut_color};font-weight:bold;'>{res['statut']}</span>
                    </div>
                    """, unsafe_allow_html=True
                )
        else:
            st.warning("Aucune université ne correspond à vos critères.")

# ------ ENTREPRISES ------
elif tab == "Entreprises":
    st.header("🔎 Recherche intelligente de partenaires pour Entreprises")
    with st.form("entreprise_form"):
        nom_ent = st.text_input("Nom de l'entreprise")
        taille_ent = st.slider("Taille de l'entreprise (employés)", 10, 500000, 300, step=10)
        pays_cible_ent = st.selectbox("Pays cible", ["France", "Allemagne", "USA", "Canada", "Inde"])
        domaines = st.multiselect("Domaines recherchés", ["Tech", "Logiciel", "RH", "R&D", "Conseil"])
        nb_partenaires_ent = st.slider("Nombre de partenaires recherchés", 1, 5, 2)
        submit_ent = st.form_submit_button("Trouver mes partenaires idéaux")
    
    if submit_ent:
        results = []
        for e in entreprises:
            score = e['score']
            if e["pays"] == pays_cible_ent:
                score += 7
            score += 5 * len(set(e["domaine"]).intersection(domaines))
            results.append({**e, "score": min(100, score)})
        results = sorted(results, key=lambda x: -x["score"])[:nb_partenaires_ent]
        st.markdown('<div class="result-title">Résultat de recherche :</div>', unsafe_allow_html=True)
        if results:
            for res in results:
                statut_color = {"Actif": "#5cb85c", "Moyen": "#f0ad4e", "Inactif": "#d9534f"}[res["statut"]]
                st.markdown(
                    f"""
                    <div class="partner-card">
                    <span style='color:{statut_color};font-size:1.5em;'>●</span>
                    <b style="font-size:1.2em">{res['nom']} ({res['ville']}, {res['pays']})</b>
                    <br>
                    <img src="{res['image']}" width="240" style="border-radius:12px;margin:10px 0;" />
                    <br>
                    <span class="score" style="color:#2670bd;"><b>{res['score']}%</b></span>
                    <br>
                    <b>Domaine</b> : {', '.join(res['domaine'])}<br>
                    <b>Statut</b> : <span style='color:{statut_color};font-weight:bold;'>{res['statut']}</span>
                    </div>
                    """, unsafe_allow_html=True
                )
        else:
            st.warning("Aucune entreprise ne correspond à vos critères.")

# ------ DASHBOARD KPI ------
elif tab == "Dashboard KPI":
    st.header("📊 Dashboard KPI (version démo)")
    st.info("Visualisation et suivi des indicateurs clés à venir… (bientôt disponible)")

# --- FOOTER ---
st.markdown("""
    <hr style="border-top:1px solid #ddd;">
    <div style="text-align:center;color:#888;">© 2025 Agora B2B Plateforme Pro | Powered by Streamlit</div>
""", unsafe_allow_html=True)
