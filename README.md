# Agora B2B Plateforme Pro

Plateforme de mise en relation Universités ↔ Entreprises (Streamlit).

## Lancer
```
pip install -r requirements.txt
streamlit run app.py
```

## Fonctionnalités
- **Matching** Universités / Entreprises avec score, fiche contact, export CSV
- **Annuaire** filtrable (type, pays, statut, recherche)
- **Inscription** d'une organisation (enregistrée dans `data/inscriptions.csv`, ignoré par git)
- **Dashboard KPI** : comptages réels ; collaborations, revenus, rétention et satisfaction sont des valeurs de démo (pas encore de suivi réel)
- **Authentification** : définir `AGORA_PASSWORD` (variable d'environnement ou `st.secrets`) ; sans elle, l'app reste ouverte (mode démo)

## Données
`data/organisations.csv` : base de référence (colonnes Type, Nom, Ville, Pays, Thématique, Taille, Statut, Statut_color, Email, Site, Tel, Adresse, Image).
