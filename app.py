import streamlit as st

# --------- DESIGN ---------
st.set_page_config(page_title="Agora B2B Plateforme Pro", layout="wide")
st.markdown("""
<style>
.big-title { font-size: 3em; color: #073763; font-weight: bold; text-align: center; margin-bottom: 0.2em; }
.subtitle { font-size: 1.3em; color: #274e13; text-align: center; margin-bottom: 1.5em; }
.result-title { color: #38761d; font-size: 1.2em; font-weight: bold; margin-top: 1em; }
.partner-card { background: white; border-radius: 15px; box-shadow: 0 4px 24px rgba(100,100,150,0.11); padding: 1.2em; margin-bottom: 1em; }
.score { font-size: 1.6em; font-weight: bold;}
img.univ-img {border-radius: 12px; border: 1px solid #eee; margin-bottom: 8px;}
.red { color: #d32f2f;}
.green { color: #388e3c;}
.yellow { color: #fbc02d;}
</style>
""", unsafe_allow_html=True)

# --------- HEADER ---------
st.markdown('<div class="big-title">Agora B2B Plateforme Pro</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Mise en relation Universités & Entreprises dans le monde</div>', unsafe_allow_html=True)

# --------- NAVIGATION ---------
tab = st.radio("Navigation :", ["Universités", "Entreprises", "Dashboard KPI"], horizontal=True)

# --------- EXEMPLE DE BASE DE DONNÉES SIMULÉE ---------
universites = [
    {
        "nom": "University of Oxford", "ville": "Oxford", "pays": "Royaume-Uni",
        "thematique": "Recherche", "taille": 24000, "score": 97,
        "statut": "Actif", "img": "https://images.unsplash.com/photo-1503676382389-4809596d5290?fit=crop&w=500&q=80"
    },
    {
        "nom": "Sorbonne Université", "ville": "Paris", "pays": "France",
        "thematique": "Généraliste", "taille": 53000, "score": 89,
        "statut": "Moyen", "img": "https://images.unsplash.com/photo-1464983953574-0892a716854b?fit=crop&w=500&q=80"
    },
    {
        "nom": "MIT", "ville": "Cambridge", "pays": "États-Unis",
        "thematique": "Tech", "taille": 12000, "score": 92,
        "statut": "Actif", "img": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?fit=crop&w=500&q=80"
    }
]
entreprises = [
    {
        "nom": "SAP", "ville": "Walldorf", "pays": "Allemagne",
        "thematique": "Logiciel", "taille": 105000, "score": 79,
        "statut": "Actif", "img": "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?fit=crop&w=500&q=80"
    },
    {
        "nom": "Tata Consultancy", "ville": "Mumbai", "pays": "Inde",
        "thematique": "Tech", "taille": 400000, "score": 67,
        "statut": "Inactif", "img": "https://images.unsplash.com/photo-1465808023454-15153b1cdb99?fit=crop&w=500&q=80"
    }
]

# --------- UNIVERSITÉS ---------
if tab == "Universités":
    st.header("Recherche intelligente de partenaires pour Universités")
    with st.form("univ_form"):
        nom_rech = st.text_input("Nom de la structure (université)")
        taille_rech = st.slider("Taille de la structure", min_value=1000, max_value=60000, value=25000)
        pays_rech = st.selectbox("Pays souhaité", ["Tous", "France", "Royaume-Uni", "États-Unis"])
        thematique_rech = st.selectbox("Thématique recherchée", ["Toutes", "Recherche", "Généraliste", "Tech"])
        n_part = st.slider("Nombre de partenaires recherchés", 1, 5, 1)
        submit = st.form_submit_button("Trouver mes partenaires idéaux")

    if submit:
        results = []
        for univ in universites:
            score = 100
            if pays_rech != "Tous" and univ["pays"] != pays_rech:
                score -= 30
            if thematique_rech != "Toutes" and univ["thematique"] != thematique_rech:
                score -= 25
            score -= int(abs(univ["taille"] - taille_rech) / 10000) * 10
            results.append({**univ, "score": score})
        results = sorted(results, key=lambda x: x["score"], reverse=True)[:n_part]

        if results:
            st.markdown('<div class="result-title">Résultat de recherche :</div>', unsafe_allow_html=True)
            for r in results:
                color = "green" if r["statut"] == "Actif" else "yellow" if r["statut"] == "Moyen" else "red"
                st.markdown(f"""
                <div class="partner-card">
                  <span class="score {color}">{r['score']}%</span>
                  <b>{r['nom']}</b> ({r['ville']}, {r['pays']})<br>
                  <img src="{r['img']}" class="univ-img" width="300"><br>
                  <b>Thématique :</b> {r['thematique']}<br>
                  <b>Statut :</b> <span class="{color}">{r['statut']}</span>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.warning("Aucune université ne correspond à vos critères.")

# --------- ENTREPRISES ---------
elif tab == "Entreprises":
    st.header("Recherche intelligente de partenaires pour Entreprises")
    with st.form("ent_form"):
        nom_rech = st.text_input("Nom de l'entreprise")
        taille_rech = st.slider("Taille de la structure", min_value=1000, max_value=500000, value=50000)
        pays_rech = st.selectbox("Pays souhaité", ["Tous", "France", "Allemagne", "Inde"])
        thematique_rech = st.selectbox("Thématique recherchée", ["Toutes", "Logiciel", "Tech"])
        n_part = st.slider("Nombre de partenaires recherchés", 1, 5, 1)
        submit = st.form_submit_button("Trouver mes partenaires idéaux")

    if submit:
        results = []
        for ent in entreprises:
            score = 100
            if pays_rech != "Tous" and ent["pays"] != pays_rech:
                score -= 30
            if thematique_rech != "Toutes" and ent["thematique"] != thematique_rech:
                score -= 25
            score -= int(abs(ent["taille"] - taille_rech) / 100000) * 10
            results.append({**ent, "score": score})
        results = sorted(results, key=lambda x: x["score"], reverse=True)[:n_part]

        if results:
            st.markdown('<div class="result-title">Résultat de recherche :</div>', unsafe_allow_html=True)
            for r in results:
                color = "green" if r["statut"] == "Actif" else "yellow" if r["statut"] == "Moyen" else "red"
                st.markdown(f"""
                <div class="partner-card">
                  <span class="score {color}">{r['score']}%</span>
                  <b>{r['nom']}</b> ({r['ville']}, {r['pays']})<br>
                  <img src="{r['img']}" class="univ-img" width="300"><br>
                  <b>Thématique :</b> {r['thematique']}<br>
                  <b>Statut :</b> <span class="{color}">{r['statut']}</span>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.warning("Aucune entreprise ne correspond à vos critères.")

# --------- DASHBOARD KPI ---------
elif tab == "Dashboard KPI":
    st.header("Dashboard KPI (Simulé)")
    st.write("Affiche ici tes indicateurs de performance (KPI), graphiques, taux d'activité, etc.")
    st.markdown("""
    <ul>
      <li>Nombre total de partenaires : <b>12</b></li>
      <li>Universités actives : <b>2</b></li>
      <li>Entreprises actives : <b>1</b></li>
      <li>Taux d'activité moyen : <b>76%</b></li>
    </ul>
    """, unsafe_allow_html=True)
    st.image("https://images.unsplash.com/photo-1519125323398-675f0ddb6308?fit=crop&w=800&q=80", caption="Exemple de dashboard", use_column_width=True)
