import streamlit as st
import pandas as pd
from PIL import Image
import requests
from io import BytesIO
import numpy as np
import plotly.graph_objects as go

st.set_page_config(page_title="Agora B2B Pro", layout="wide")

FALLBACK_IMG = "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg"

@st.cache_data
def load_data():
    data = [
        # Universités (images logos réels ou photos de campus, liens OK)
        {"Type": "Université", "Nom": "University of Oxford", "Ville": "Oxford", "Pays": "Royaume-Uni",
         "Thématique": "Généraliste, Recherche", "Taille": 24000, "Statut": "Actif", "Statut_color": "green",
         "Image": "https://upload.wikimedia.org/wikipedia/commons/7/74/Radcliffe_Camera%2C_Oxford_-_Oct_2006.jpg",
         "Email": "contact@ox.ac.uk", "Site": "https://www.ox.ac.uk/", "Tel": "+44 1865 270000", "Adresse": "University of Oxford, Oxford, Royaume-Uni"},
        {"Type": "Université", "Nom": "Sorbonne Université", "Ville": "Paris", "Pays": "France",
         "Thématique": "Généraliste", "Taille": 53000, "Statut": "Moyen", "Statut_color": "yellow",
         "Image": "https://www.sorbonne-universite.fr/themes/custom/su_theme/images/logo_sorbonne_universite.svg",
         "Email": "info@sorbonne-universite.fr", "Site": "https://www.sorbonne-universite.fr/", "Tel": "+33 1 44 27 44 27", "Adresse": "21 Rue de l'École de Médecine, 75006 Paris, France"},
        {"Type": "Université", "Nom": "MIT", "Ville": "Cambridge", "Pays": "États-Unis",
         "Thématique": "Tech, Recherche", "Taille": 12000, "Statut": "Actif", "Statut_color": "green",
         "Image": "https://upload.wikimedia.org/wikipedia/commons/0/0c/MIT_logo.svg",
         "Email": "admissions@mit.edu", "Site": "http://web.mit.edu/", "Tel": "+1 617-253-1000", "Adresse": "77 Massachusetts Ave, Cambridge, MA 02139, USA"},
        # Entreprises
        {"Type": "Entreprise", "Nom": "SAP", "Ville": "Walldorf", "Pays": "Allemagne",
         "Thématique": "Logiciel, Tech", "Taille": 105000, "Statut": "Actif", "Statut_color": "green",
         "Image": "https://upload.wikimedia.org/wikipedia/commons/5/59/SAP_2011_logo.svg",
         "Email": "contact@sap.com", "Site": "https://www.sap.com/", "Tel": "+49 6227 747474", "Adresse": "Dietmar-Hopp-Allee 16, 69190 Walldorf, Germany"},
        {"Type": "Entreprise", "Nom": "Tata Consultancy", "Ville": "Mumbai", "Pays": "Inde",
         "Thématique": "Tech, Conseil", "Taille": 400000, "Statut": "Inactif", "Statut_color": "red",
         "Image": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Consultancy_Services_Logo.svg",
         "Email": "contact.tcs@tcs.com", "Site": "https://www.tcs.com/", "Tel": "+91 22 6778 9999", "Adresse": "TCS House, Mumbai, Inde"},
        {"Type": "Entreprise", "Nom": "Capgemini", "Ville": "Paris", "Pays": "France",
         "Thématique": "Conseil, Tech", "Taille": 40000, "Statut": "Moyen", "Statut_color": "yellow",
         "Image": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Logo_Capgemini.png",
         "Email": "contact.fr@capgemini.com", "Site": "https://www.capgemini.com/fr-fr/", "Tel": "+33 1 47 54 50 00", "Adresse": "11 rue de Tilsitt, 75017 Paris, France"},
    ]
    return pd.DataFrame(data)

df = load_data()

st.markdown("""
<style>
.main-title {font-size: 2.7em; color: #d32f2f; font-weight: 900; text-align: center;}
.sub-title {font-size: 1.3em; color: #004080; text-align: center; margin-bottom: 1em;}
.form-zone {background: #f8f9fa; padding: 1.2em 2em 0.7em 2em; border-radius: 16px; margin-bottom: 1.5em; box-shadow: 0 4px 16px rgba(200,40,40,0.08);}
.card {background: #fff; border-radius: 15px; box-shadow: 0 2px 18px rgba(0,0,0,0.10); margin-bottom: 20px; padding: 16px;}
.card img {border-radius: 12px; border: 1px solid #f3f3f3; margin-bottom: 12px;}
.score-box {font-size: 2em; font-weight: 800; color: #004080; margin-right: 12px;}
.score-green {color: #388e3c;}
.score-orange {color: #fbc02d;}
.score-red {color: #d32f2f;}
.cta-btn {background: #d32f2f; color: #fff; border-radius: 7px; padding: 10px 28px; border: none; font-size: 1.12em;}
.cta-btn:hover {background: #a82727;}
a.contact-link {color: #004080; font-weight:bold; text-decoration:underline;}
</style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-title">Agora B2B Plateforme Pro</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Mise en relation Universités & Entreprises dans le monde</div>', unsafe_allow_html=True)

menu = st.radio("Navigation :", ["Universités", "Entreprises", "Dashboard KPI"], horizontal=True)

def match_score(row, type_sel, pays, taille, theme):
    score = 0
    score += 40 if row["Pays"] == pays else 0
    delta = abs(row["Taille"] - taille)
    score += max(0, 30 - int(delta / 2000))
    th_row = [x.strip() for x in row["Thématique"].split(",")]
    nb_common = len(set(th_row).intersection(set(theme)))
    score += 60 if nb_common > 1 else (30 if nb_common == 1 else 0)
    if row["Statut"] == "Actif":
        score += 10
    elif row["Statut"] == "Moyen":
        score -= 5
    elif row["Statut"] == "Inactif":
        score -= 10
    return max(0, min(100, score))

def show_matching_score(type_sel):
    with st.container():
        st.markdown('<div class="form-zone">', unsafe_allow_html=True)
        st.markdown(f"#### Critères de recherche pour une {type_sel.lower()}")
        taille = st.slider("Taille de la structure", 1000, 500000, 30000, 1000)
        pays = st.selectbox("Pays souhaité pour les partenaires", sorted(df['Pays'].unique()))
        theme_opts = sorted(set([t.strip() for x in df['Thématique'].unique() for t in x.split(",")]))
        theme = st.multiselect("Thématiques recherchées", theme_opts)
        nb_part = st.slider("Nombre de partenaires recherchés", 1, 5, 3)
        submit = st.button("Trouver les partenaires adaptés", key=type_sel)
        st.markdown('</div>', unsafe_allow_html=True)

    # Fonctionnalité : affichage "fiche contact"
    if submit:
        candidates = df[df['Type'] != type_sel].copy()
        candidates["Score"] = candidates.apply(
            lambda row: match_score(row, type_sel, pays, taille, theme), axis=1
        )
        candidates = candidates.sort_values("Score", ascending=False).head(nb_part)
        st.markdown("<br><b>Résultat de votre recherche</b> :", unsafe_allow_html=True)
        for idx, row in candidates.iterrows():
            score_color = "score-green" if row["Score"] >= 80 else "score-orange" if row["Score"] >= 60 else "score-red"
            st.markdown(f'<div class="card">', unsafe_allow_html=True)
            cols = st.columns([1,6])
            with cols[0]:
                st.markdown(f'<span class="score-box {score_color}">{row["Score"]}%</span>', unsafe_allow_html=True)
            with cols[1]:
                # Clique sur le nom ouvre la fiche contact
                if st.button(row['Nom'], key=row['Nom'] + "_btn"):
                    st.session_state['contact'] = row['Nom']
                st.markdown(f"<h4 style='display:inline'>{row['Nom']} <span style='font-size: 0.8em;'>({row['Ville']}, {row['Pays']})</span></h4>", unsafe_allow_html=True)
                try:
                    response = requests.get(row["Image"], timeout=4)
                    img = Image.open(BytesIO(response.content))
                    st.image(img, width=160)
                except Exception:
                    st.image(FALLBACK_IMG, width=120)
                st.markdown(f"<b>Thématique :</b> {row['Thématique']}<br><b>Statut :</b> <span style='color:{row['Statut_color']}'>{row['Statut']}</span>", unsafe_allow_html=True)
            st.markdown('</div>', unsafe_allow_html=True)
        if len(candidates) == 0 or candidates["Score"].max() < 60:
            st.warning("Aucun partenaire parfaitement adapté, mais voici les plus proches selon vos critères.")

        # Pop-up fiche contact (latérale)
        if 'contact' in st.session_state:
            selected = candidates[candidates['Nom'] == st.session_state['contact']].iloc[0]
            st.sidebar.markdown(f"### Fiche Contact – {selected['Nom']}")
            st.sidebar.image(selected["Image"], width=140)
            st.sidebar.markdown(f"- *Adresse* : {selected['Adresse']}")
            st.sidebar.markdown(f"- *Téléphone* : {selected['Tel']}")
            st.sidebar.markdown(f"- *Email* : [{selected['Email']}](mailto:{selected['Email']})")
            st.sidebar.markdown(f"- *Site web* : [Site officiel]({selected['Site']})")
            st.sidebar.markdown("---")
            st.sidebar.button("Fermer la fiche", on_click=lambda: st.session_state.pop('contact'))

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

if menu == "Dashboard KPI":
    show_dashboard()
elif menu == "Universités":
    st.markdown('<div style="margin-top:18px;margin-bottom:6px;"><b>Recherche intelligente de partenaires pour Universités</b></div>', unsafe_allow_html=True)
    show_matching_score("Université")
elif menu == "Entreprises":
    st.markdown('<div style="margin-top:18px;margin-bottom:6px;"><b>Recherche intelligente de partenaires pour Entreprises</b></div>', unsafe_allow_html=True)
    show_matching_score("Entreprise")

st.caption("Prototype avancé Agora B2B Pro – Matching dynamique, scoring, statuts, dashboard. Version personnalisable.")
