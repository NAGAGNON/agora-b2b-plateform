import streamlit as st
import pandas as pd

# Mise en page globale dès la première ligne
st.set_page_config(page_title="Agora B2B Plateforme Pro", page_icon=":globe_with_meridians:", layout="wide")

# DATA EXEMPLE
def load_data():
    # Ajoute ici tes vraies données ou importe-les d'un Excel si tu veux
    data = [
        {"Nom": "London Higher", "Pays": "Royaume-Uni", "Taille": 80000, "Thématique": "Généraliste", "Statut": "Actif", "Score": 92},
        {"Nom": "University of Tokyo", "Pays": "Japon", "Taille": 60000, "Thématique": "Généraliste", "Statut": "Moyen", "Score": 84},
        {"Nom": "LMU Munich", "Pays": "Allemagne", "Taille": 45000, "Thématique": "Management", "Statut": "Inactif", "Score": 73},
        {"Nom": "University of Melbourne", "Pays": "Australie", "Taille": 52000, "Thématique": "Sciences", "Statut": "Actif", "Score": 91},
        {"Nom": "Université de Montréal", "Pays": "Canada", "Taille": 70000, "Thématique": "Généraliste", "Statut": "Moyen", "Score": 78},
    ]
    return pd.DataFrame(data)

df = load_data()

# HEADER / STYLE PRO
st.markdown("""
    <style>
    .big-title {font-size: 2.8em; color: #223A5E; font-weight: 900; text-align:center; margin-bottom: 0.3em;}
    .subtitle {font-size: 1.3em; color: #EC2027; text-align:center; margin-bottom: 1.5em;}
    .crit {background: #f4f7fa; padding:1.5em; border-radius:16px; box-shadow:0 3px 8px #00000018; margin-bottom:1.5em;}
    .score {font-weight:bold; color:#008C48;}
    .tag-actif {background:#6fda44;padding:0.1em 0.7em;border-radius:9px;color:white;}
    .tag-moyen {background:#ffc107;padding:0.1em 0.7em;border-radius:9px;color:white;}
    .tag-inactif {background:#ec2027;padding:0.1em 0.7em;border-radius:9px;color:white;}
    </style>
""", unsafe_allow_html=True)

st.markdown('<div class="big-title">Agora B2B Plateforme Pro</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Mise en relation Universités & Entreprises</div>', unsafe_allow_html=True)

# Choix du mode
mode = st.radio("👤 Sélectionne ton type de structure :", ("Université", "Entreprise", "Dashboard KPI"), horizontal=True)

if mode == "Université":
    st.markdown('<div class="crit"><b>Critères de recherche pour une université</b></div>', unsafe_allow_html=True)
    nom_univ = st.text_input("Nom de la structure")
    taille = st.slider("Taille de la structure", 1000, 100000, 20000)
    pays = st.selectbox("Pays souhaité pour les partenaires", df["Pays"].unique())
    thematiques = st.multiselect("Thématiques recherchées", df["Thématique"].unique())
    statut = st.selectbox("Niveau d’activité minimum du partenaire", ["Actif", "Moyen", "Inactif"])
    n_part = st.slider("Nombre de partenaires recherchés", 1, 5, 2)
    
    # Recommandation intelligente avec un score
    if st.button("Trouver mes partenaires idéaux"):
        results = df[
            (df["Pays"] == pays) &
            (df["Taille"] >= taille-15000) &
            (df["Taille"] <= taille+15000) &
            (df["Thématique"].isin(thematiques) if thematiques else True) &
            (df["Statut"].isin([statut, "Actif"])) # "Actif" inclut les statuts plus élevés si besoin
        ].sort_values("Score", ascending=False).head(n_part)
        
        if results.empty:
            st.warning("Aucune université ne correspond à vos critères.")
        else:
            for idx, row in results.iterrows():
                tag = {
                    "Actif": "tag-actif",
                    "Moyen": "tag-moyen",
                    "Inactif": "tag-inactif"
                }[row.Statut]
                st.markdown(
                    f"""<div style="padding:1em 0;">
                    <span class="{tag}">{row.Statut}</span>
                    <b style="font-size:1.1em;margin-left:0.5em;">{row.Nom}</b>
                    <span style="margin-left:1em;">({row.Pays} - {row.Thématique})</span>
                    <span class="score" style="margin-left:1em;">Score : {row.Score}</span>
                    </div>""",
                    unsafe_allow_html=True
                )
elif mode == "Entreprise":
    st.markdown('<div class="crit"><b>Critères de recherche pour une entreprise</b></div>', unsafe_allow_html=True)
    nom_entr = st.text_input("Nom de la société")
    secteur = st.selectbox("Secteur d'activité", ["Tech", "Industrie", "Finance", "Santé", "Autre"])
    pays = st.selectbox("Pays cible", df["Pays"].unique())
    n_part = st.slider("Nombre de partenaires universitaires recherchés", 1, 5, 2)
    if st.button("Trouver des universités partenaires"):
        # Simuler la recherche
        results = df[df["Pays"] == pays].sort_values("Score", ascending=False).head(n_part)
        if results.empty:
            st.warning("Aucune université trouvée pour ce pays.")
        else:
            for idx, row in results.iterrows():
                tag = {
                    "Actif": "tag-actif",
                    "Moyen": "tag-moyen",
                    "Inactif": "tag-inactif"
                }[row.Statut]
                st.markdown(
                    f"""<div style="padding:1em 0;">
                    <span class="{tag}">{row.Statut}</span>
                    <b style="font-size:1.1em;margin-left:0.5em;">{row.Nom}</b>
                    <span style="margin-left:1em;">({row.Pays} - {row.Thématique})</span>
                    <span class="score" style="margin-left:1em;">Score : {row.Score}</span>
                    </div>""",
                    unsafe_allow_html=True
                )

else: # Dashboard KPI
    st.markdown('<div class="crit"><b>Dashboard KPI (Version Pro)</b></div>', unsafe_allow_html=True)
    col1, col2, col3 = st.columns(3)
    col1.metric("Universités Actives", df[df["Statut"]=="Actif"].shape[0])
    col2.metric("Universités Moyen", df[df["Statut"]=="Moyen"].shape[0])
    col3.metric("Universités Inactives", df[df["Statut"]=="Inactif"].shape[0])
    st.bar_chart(df.set_index("Nom")["Score"])

# Bas de page
st.markdown("---")
st.markdown('<div style="text-align:center;color:#888;">© 2024 Agora B2B Plateforme — Prototype UI & Data Demo</div>', unsafe_allow_html=True)
