# Envoi des e-mails par SMTP (sans API d'envoi payante)

## 1. Analyse de l'infrastructure actuelle

| Élément | Constat | Conséquence |
| --- | --- | --- |
| Hébergement de l'application | **Vercel**, fonctions sans serveur (pas de machine permanente, pas d'adresse IP fixe, pas de DNS inverse contrôlable) | L'application ne peut **pas** être elle-même un serveur de messagerie. |
| Port 25 sortant | **Bloqué** sur les fonctions Vercel (comme chez la plupart des hébergeurs cloud, contre le spam) | Remise **directe** aux serveurs des destinataires impossible depuis Vercel. |
| Ports 587 / 465 sortants | Autorisés | L'application peut **soumettre** ses e-mails à un serveur SMTP authentifié. |
| Base de données (Supabase) | Pas de serveur d'envoi | Sert de file d'attente et de source de vérité des envois. |
| Domaine `linkprob2b.com` | Enregistrements DNS gérés chez le bureau d'enregistrement du domaine | SPF / DKIM / DMARC à configurer là où le domaine est géré. |
| Envoi avant cette mise à jour | Resend (API HTTP) | Remplacé par le SMTP dès que celui-ci est configuré. |

**Conclusion :** l'architecture gratuite qui fonctionne avec notre hébergement est :

```
Application (Vercel) ──SMTP authentifié, port 587 STARTTLS ou 465 TLS──▶ serveur SMTP de la messagerie du domaine ──▶ destinataire
```

Aucun coût par e-mail : on utilise la boîte e-mail du domaine (souvent incluse avec le nom de domaine ou l'hébergement
déjà payé). Le serveur SMTP de cette messagerie gère EHLO, le DNS inverse et la remise ; nous gérons SPF / DKIM / DMARC
du domaine, la file, les limites et le suivi.

### Ce qu'il faudrait pour envoyer depuis « notre propre serveur » (remise directe, port 25)

Un serveur que nous contrôlons (machine virtuelle avec Postfix ou équivalent) avec : port 25 sortant ouvert par
l'hébergeur, adresse IP fixe avec DNS inverse (PTR) au nom du domaine, nom EHLO cohérent, IP propre (hors listes
noires), surveillance des rebonds. **Ce n'est pas possible sur Vercel** et cela demande une machine louée à part
(coût mensuel fixe, pas par e-mail) : non mis en place sans accord explicite.

## 2. Configuration (variables d'environnement Vercel, côté serveur uniquement)

| Variable | Exemple | Rôle |
| --- | --- | --- |
| `SMTP_HOST` | `ssl0.ovh.net`, `smtp.ionos.fr`, `smtp.hostinger.com`… | Serveur SMTP de la messagerie du domaine |
| `SMTP_PORT` | `587` (STARTTLS) ou `465` (TLS) | |
| `SMTP_USER` | `notifications@linkprob2b.com` | Boîte e-mail du domaine |
| `SMTP_PASSWORD` | mot de passe de cette boîte | **Jamais** dans le code ni le navigateur |
| `SMTP_HELO_NAME` | (facultatif) | Nom annoncé en EHLO |
| `OUTREACH_EMAIL_FROM` | (facultatif) | Expéditeur de la prospection ; par défaut l'adresse des e-mails d'inscription |

L'expéditeur doit être une adresse **autorisée par ce compte SMTP** (en général la boîte elle-même).
Dès que `SMTP_HOST`, `SMTP_USER` et `SMTP_PASSWORD` sont présents, **tous** les e-mails (inscriptions, alertes,
prospection) passent par le SMTP ; `RESEND_API_KEY` peut alors être supprimée.
Test : Outreach → Paramètres → « Tester la connexion SMTP » (aucun e-mail envoyé).

## 3. DNS du domaine (délivrabilité)

À faire chez le gestionnaire DNS du domaine (valeurs exactes données par la messagerie) :

- **SPF** (TXT sur `linkprob2b.com`) : un seul enregistrement, incluant le serveur de la messagerie, ex.
  `v=spf1 include:<domaine-spf-de-la-messagerie> ~all` (retirer l'`include` de Resend une fois Resend abandonné).
- **DKIM** : activer la signature DKIM dans l'interface de la messagerie et publier la clé indiquée (TXT ou CNAME
  `<sélecteur>._domainkey`).
- **DMARC** (TXT sur `_dmarc.linkprob2b.com`) : commencer par `v=DMARC1; p=none; rua=mailto:<adresse-de-rapports>`,
  puis passer à `p=quarantine` quand SPF et DKIM sont alignés depuis quelques semaines.
- **DNS inverse / EHLO** : gérés par le serveur SMTP de la messagerie (pas de remise directe depuis Vercel).
- **Reply-To** : Outreach → Paramètres → « Adresse de réponse ».

## 4. File d'attente et envoi progressif

```
prospect → destinataire PENDING (file) → worker (tâches planifiées + lancement manuel) → SMTP → SENT
```

- Un e-mail à la fois, intervalle réglable entre deux envois (6 s par défaut), jamais d'envoi simultané.
- Limites (Outreach → Paramètres → « Envoi progressif ») : **50 par jour toutes campagnes** et **20 par heure** au
  départ, limite propre à la campagne automatique, 3 tentatives maximum. Augmenter par paliers si les rebonds et
  plaintes restent faibles ; ne jamais dépasser la limite d'envoi de la messagerie.
- Avant **chaque** envoi : liste d'opposition (adresse, domaine, SIREN), entreprise « Ne plus contacter », pas déjà
  reçu dans cette campagne, nombre de tentatives.
- Réservation de chaque e-mail avant l'envoi (statut `SENDING`) : pas de double envoi si deux tâches tournent en même
  temps ; un envoi interrompu n'est jamais renvoyé automatiquement.

## 5. Suivi local (source de vérité : `outreach_recipients`, `outreach_events`)

Adresse, destinataire, campagne, statut, date d'envoi, tentatives (`attempts`, `last_attempt_at`), réponse du serveur
SMTP (`smtp_response`), transport, erreur. Rebond **définitif** signalé par le serveur (adresse inexistante) : statut
`FAILED` et adresse ajoutée à la liste d'opposition (motif `BOUNCE`). Erreur temporaire : nouvelle tentative au passage
suivant. Les rebonds reçus plus tard dans la boîte de l'expéditeur (non signalés pendant l'envoi) sont à reporter dans
Outreach → Exclusions.
