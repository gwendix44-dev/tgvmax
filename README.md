# TGV MAX – Planificateur (PWA)

Appli web installable : destinations depuis Nantes, alertes sur un créneau, correspondances partout en France, allers-retours dans la journée (ou avec nuits), trains de nuit, assistant de recherche. Aucun compte, alertes et favoris enregistrés sur le téléphone.

## Mise en ligne (une seule fois)

1. Copier tout le contenu de ce dossier à la racine du dépôt GitHub, branche `main`, puis commit + push.
2. Dépôt → **Settings → Pages → Source : GitHub Actions**.
3. Dépôt → **Settings → Secrets and variables → Actions** : créer `VAPID_PRIVATE_KEY` (fichier fourni à part). Le secret `SYNC_SECRET` se crée à l'étape 6.
4. Dépôt → **Actions → « Mise à jour des données et alertes » → Run workflow**. L'appli est alors en ligne à `https://<compte>.github.io/<dépôt>/`.
5. Sur le téléphone, ouvrir cette adresse puis **Ajouter à l'écran d'accueil** (iPhone : iOS 16.4 minimum, les notifications ne marchent que depuis l'appli installée).
6. Dans l'appli : **Plus → Notifications** → *Activer*, puis *Générer* le code de chiffrement et le copier dans le secret `SYNC_SECRET`. Créer sur GitHub un jeton « fine-grained » limité à ce dépôt (permission *Contents : Read and write*), le coller dans l'appli, puis *Synchroniser maintenant*.

La tâche planifiée relit le jeu de données SNCF plusieurs fois chaque matin (il est mis à jour une fois par jour), envoie une notification complète pour chaque nouvelle place dans le créneau exact d'une alerte (bouton « Réserver » → SNCF Connect), puis redéploie le site avec les données du jour.

## Limites assumées

- Données SNCF mises à jour une fois par jour : pas de temps réel.
- La gare parisienne de chaque train est déduite de la ligne (le jeu de données les regroupe sous « Paris ») ; les temps pour rejoindre une gare proche sont des estimations.
- L'assistant comprend les demandes en français (dates, nombre de destinations, A/R, nuit, direct…) et interroge les données ; il n'utilise pas de modèle d'IA externe.
- SNCF Connect n'offre pas de lien direct vers un trajet : le bouton ouvre le site, « Copier » donne les horaires.

## Développement

```
npm install
npm run data     # télécharge et compacte le jeu de données → data/max.json
npm test         # tests du moteur
python3 -m http.server 8000
```

## Fraîcheur des données
Le jeu de données ouvert SNCF « tgvmax » liste les trains MAX JEUNE / MAX SENIOR et il est publié **une fois par jour, en début de matinée** (≈ 05h25 UTC). Le Max Planner de SNCF Connect est en temps réel : des places y sont ajoutées ou prises toute la journée, et les OUIGO n'existent pas dans le jeu ouvert. L'appli affiche donc la date des données SNCF et renvoie vers le Max Planner pour vérifier avant de réserver. L'API du Max Planner est protégée par un système anti-robot : elle n'est pas utilisée.
