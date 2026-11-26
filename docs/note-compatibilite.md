# Note de correspondance entreprise / appel d'offres

Affichée sur la fiche d'un appel d'offres externe, juste avant « En savoir plus ». Code : `src/lib/compatibility.ts` (calcul), `src/components/opportunities/compatibility-card.tsx` (affichage), tests : `tests/unit/compatibility.test.ts`.

## Ce que la note est, et n'est pas
- **Est** : un indicateur de correspondance entre ce que l'entreprise a déclaré (fiche, réponses) et ce que demande l'avis (d'après son résumé « En bref »).
- **N'est pas** : une probabilité de gagner, ni une garantie d'éligibilité. Le règlement de la consultation fait toujours foi. Cette mention figure sur chaque carte.

## Critères et points
| Critère | Points | Compté quand | Source |
|---|---|---|---|
| Métier | 45 | métier de l'offre et métiers de la fiche connus (savoir-faire cité dans l'offre : 75 %) | fiche (déclaré) |
| Zone | 30 | lieu de l'offre et localisation de la fiche connus (même région : 70 %) | fiche (déclaré) + distance calculée |
| Certifications exigées | 25 | résumé de l'avis disponible ; part des certifications détenues | avis + fiche ou réponse (déclaré) |
| Autres conditions de participation | 15 | seulement pour les conditions auxquelles le membre a répondu | avis + réponse (déclaré) |

Note = points obtenus / points des critères connus × 100. **Une information inconnue n'enlève aucun point** mais reste affichée « à vérifier ».
Pas de note si le métier est inconnu ou si moins de 69 points de critères sont connus.

## Conditions obligatoires (éliminatoires)
Les certifications et conditions de participation écrites dans l'avis sont marquées **Obligatoire**.
- Une condition obligatoire **non remplie** (réponse « Je ne l'ai pas ») : note plafonnée à **45**, niveau « Condition obligatoire manquante », alerte rouge.
- Une condition obligatoire **non vérifiée** (absente de la fiche et sans réponse, ou résumé de l'avis indisponible) : note plafonnée à **70**, niveau « … sous réserve », alerte.
- Une note élevée ne peut donc jamais masquer une condition éliminatoire. L'alerte reste visible en Gratuit (seul le détail est flouté).

## Vérifié ou déclaré
Chaque ligne porte sa source : « Avis », « Votre fiche · déclaré », « Votre réponse · déclaré », « Calculé ». LinkProB2B ne vérifie pas les certifications auprès des organismes : tout ce qui vient de l'entreprise est déclaré.

## Niveaux
≥ 80 très bonne · ≥ 60 bonne · ≥ 35 partielle · < 35 faible (avant libellés « sous réserve » / « condition manquante »).
