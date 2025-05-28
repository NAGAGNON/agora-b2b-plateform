import difflib

def matching_score(univ, pays, thematiques, taille):
    # Score sur 100
    score = 0
    if univ["Pays"] == pays:
        score += 40
    # Thématique : +30 si une correspond
    if any(theme in univ["Thematique"] for theme in thematiques):
        score += 30
    # Taille : plus c’est proche, plus c’est haut (max +20)
    score += max(0, 20 - abs(univ["Taille"] - taille)//1500)
    # Bonus si nom entré est similaire au nom
    return score

# ... dans ta partie Universités :

if tab == "Universités":
    st.markdown('<div class="nav"><label>Recherche intelligente de partenaires pour <b>Universités</b></label></div>', unsafe_allow_html=True)
    nom = st.text_input("Nom de la structure")
    taille = st.slider("Taille de la structure", 1000, 50000, 22000)
    pays = st.selectbox("Pays souhaité pour les partenaires", sorted({u["Pays"] for u in universites}))
    thematiques = st.multiselect("Thématiques recherchées", ["Généraliste", "Recherche", "Sciences", "Ingénierie", "Tech"])
    nb_partenaires = st.slider("Nombre de partenaires recherchés", 1, 5, 2)
    st.write("---")
    st.markdown("### Résultat de recherche :")

    # Matching intelligent
    scored = []
    for u in universites:
        s = matching_score(u, pays, thematiques, taille)
        scored.append((s, u))
    scored.sort(reverse=True, key=lambda x: x[0])
    results = [u for s, u in scored if s > 0][:nb_partenaires]
    if results:
        for i, res in enumerate(results):
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
        # Même si aucun n'a un score élevé, propose les plus proches !
        best_matches = scored[:nb_partenaires]
        st.warning("Aucune université ne correspond parfaitement, voici les plus proches :")
        for s, res in best_matches:
            st.markdown(
                f"""
                <div class="card">
                    <img src="{res['Image']}" alt="universite"/>
                    <div>
                        <span class="{statut_dot(res['Statut'])}"></span>
                        <span class="{score_color(res['Score'])}">{res['Score']}%</span> <b>{res['Nom']} ({res['Ville']}, {res['Pays']})</b><br>
                        <span class="tag">{res['Thematique']}</span><br>
                        <b>Statut :</b> {res['Statut']} | <b>Score de correspondance :</b> {s} / 100
                    </div>
                </div>
                """, unsafe_allow_html=True
            )
