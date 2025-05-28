import streamlit as st
import pandas as pd
st.set_page_config(page_title="Agora B2B - Partenariats Universités", layout="wide")
@st.cache_data
def load_data():
    data = [
        {"Ville": "Londres", "Pays": "Royaume-Uni", "Université": "London Higher", "Nom": "Jolanta Edwards", "Poste": "Directrice de la stratégie", "Email": "enquiry@londonhigher.ac.uk", "Téléphone": "+44 207 419 5650", "Site": "https://www.londonhigher.ac.uk/contact/", "Thématique": "Généraliste, Innovation", "Taille": 80000},
        {"Ville": "Tokyo", "Pays": "Japon", "Université": "University of Tokyo", "Nom": "Kenji Kobayashi", "Poste": "Professeur, Faculty of Agriculture", "Email": "daigakuin.s@gs.mail.u-tokyo.ac.jp", "Téléphone": "+81 3 5841 6009", "Site": "https://www.u-tokyo.ac.jp/en/general/contact.html", "Thématique": "Recherche, Sciences", "Taille": 30000},
        {"Ville": "Séoul", "Pays": "Corée du Sud", "Université": "Seoul Metropolitan Office of Education", "Nom": "Non précisé", "Poste": "Affaires internationales", "Email": "intaffairs@sen.go.kr", "Téléphone": "+82 2 3999 395", "Site": "https://english.sen.go.kr/english/about/contact.jsp", "Thématique": "Management, Education", "Taille": 45000},
        {"Ville": "Munich", "Pays": "Allemagne", "Université": "LMU Munich", "Nom": "Non précisé", "Poste": "International Office", "Email": "international@lmu.de", "Téléphone": "+49 89 2180 2823", "Site": "https://www.lmu.de/en/study/important-contacts/international-office/", "Thématique": "Généraliste, Recherche", "Taille": 52000},
        {"Ville": "Melbourne", "Pays": "Australie", "Université": "University of Melbourne", "Nom": "Non précisé", "Poste": "Media Enquiries", "Email": "media-enquiries@unimelb.edu.au", "Téléphone": "+61 3 9035 5511", "Site": "https://www.unimelb.edu.au/contact", "Thématique": "Innovation, Sciences", "Taille": 47000},
        {"Ville": "Montréal", "Pays": "Canada", "Université": "Ministère de l'Enseignement supérieur du Québec", "Nom": "Non précisé", "Poste": "Relations médias", "Email": "relationsmedias@education.gouv.qc.ca", "Téléphone": "+1 418 643 7095", "Site": "https://www.quebec.ca/gouvernement/ministeres-organismes/enseignement-superieur/coordonnees-structure/generales", "Thématique": "Politiques publiques, Education", "Taille": 40000},
        {"Ville": "Boston", "Pays": "États-Unis", "Université": "Massachusetts Dept. of Higher Education", "Nom": "Non précisé", "Poste": "General Contact", "Email": "osfa@osfa.mass.edu", "Téléphone": "+1 617 994 6950", "Site": "https://www.mass.edu/about/contactus.asp", "Thématique": "Politiques publiques, Sciences", "Taille": 36000},
        {"Ville": "Paris", "Pays": "France", "Université": "Ministère de l'Éducation nationale", "Nom": "Alain Bouhours", "Poste": "Chef de bureau", "Email": "alain.bouhours@education.gouv.fr", "Téléphone": "+33 1 55 55 10 10", "Site": "https://www.european-agency.org/country-information/france/ministry-of-education-and-relevant-departments", "Thématique": "Education, Gouvernance", "Taille": 85000},
        {"Ville": "Amsterdam", "Pays": "Pays-Bas", "Université": "University of Amsterdam", "Nom": "Non précisé", "Poste": "Faculty of Science", "Email": "info-science@uva.nl", "Téléphone": "+31 20 525 7678", "Site": "https://www.uva.nl/en/about-the-uva/contact/contact.html", "Thématique": "Sciences, Recherche", "Taille": 37000},
        {"Ville": "Singapour", "Pays": "Singapour", "Université": "Ministry of Education Singapore", "Nom": "Liew Wei Li", "Poste": "Director-General of Education", "Email": "contact@moe.gov.sg", "Téléphone": "+65 6872 2220", "Site": "https://www.moe.gov.sg/contact-us", "Thématique": "Education, Management", "Taille": 41000}
    ]
    return pd.DataFrame(data)

df = load_data()

st.set_page_config(page_title="Agora B2B - Partenariats Universités", layout="wide")
st.title("🌍 Agora B2B Global Born – Mise en relation universitaire")

mode = st.radio("Comment souhaitez-vous utiliser la plateforme ?", ["Connexion en invité", "Créer/Accéder à mon compte (simulation)"])

if mode == "Connexion en invité":
    st.success("Vous êtes connecté en mode invité. Vos recherches ne seront pas sauvegardées.")
    user_profile = {}
else:
    st.info("Simulation : Remplissez votre profil université (aucun stockage réel)")
    user_profile = {
        "university_name": st.text_input("Nom de votre université"),
        "email": st.text_input("Email professionnel"),
        "country": st.selectbox("Pays", sorted(df["Pays"].unique())),
        "taille": st.slider("Taille de votre université (étudiants)", 1000, 100000, 20000, 500),
        "thématique": st.multiselect("Domaines/thématiques recherchées", sorted(set(",".join(df["Thématique"].unique()).split(",")))),
        "partenaires_désirés": st.slider("Nombre de partenaires recherchés", 1, 10, 3)
    }

st.header("Définissez vos critères de partenariat")
col1, col2 = st.columns(2)
with col1:
    pays_cibles = st.multiselect("Pays cibles des partenaires", sorted(df["Pays"].unique()))
with col2:
    thématique_cible = st.multiselect("Thématique de recherche/partenariat", sorted(set(",".join(df["Thématique"].unique()).split(","))))
    
taille_min = st.slider("Taille minimale de l’université partenaire", 1000, 100000, 10000, 1000)
taille_max = st.slider("Taille maximale de l’université partenaire", 1000, 100000, 90000, 1000)

def compute_score(row):
    score = 0
    if pays_cibles and row["Pays"] in pays_cibles: score += 2
    if thématique_cible and any(t in row["Thématique"].split(",") for t in thématique_cible): score += 2
    if taille_min <= row["Taille"] <= taille_max: score += 1
    return score

df["Score de compatibilité"] = df.apply(compute_score, axis=1)
df_res = df[df["Score de compatibilité"] > 0].sort_values("Score de compatibilité", ascending=False)

st.subheader("🎯 Universités partenaires recommandées :")
if len(df_res) == 0:
    st.warning("Aucune université ne correspond parfaitement à vos critères. Essayez d’élargir les filtres.")
else:
    for idx, row in df_res.iterrows():
        with st.expander(f"{row['Université']} ({row['Pays']}) – Score : {row['Score de compatibilité']}"):
            st.write(f"**Ville** : {row['Ville']}")
            st.write(f"**Thématique(s)** : {row['Thématique']}")
            st.write(f"**Taille** : {row['Taille']} étudiants")
            st.write(f"**Responsable** : {row['Nom']} / {row['Poste']}")
            st.write(f"**Téléphone** : {row['Téléphone']}")
            st.write(f"**Email** : [{row['Email']}](mailto:{row['Email']})")
            st.write(f"**Site** : [Lien]({row['Site']})")

st.caption("Prototype développé avec Streamlit • Données testées, scoring automatique selon critères.")
