# Demi-Cercle

Jeu de devinette à jouer entre amis, sur téléphone, dans la même pièce.

Un joueur reçoit un spectre (ex. *Chaud ↔ Froid*) et une palette de score
cachée sur un demi-cercle (5 zones de 9° : 2 | 3 | 4 | 3 | 2 points). Il
écrit un indice. Les joueurs placent ensuite à tour de rôle leur aiguille à
partir des indices écrits par les autres, pendant que le reste de la salle
— dont l'auteur de l'indice — voit l'aiguille du devineur bouger en direct
sur son propre téléphone. La palette est révélée à tous entre chaque tour
et l'équipe marque jusqu'à 4 points par manche (24 points max à 2 joueurs,
36 à 3, 48 à 4).

## Démarrer une partie

1. Ouvre le site sur ton téléphone (et idéalement ajoute-le à l'écran
   d'accueil : « Ajouter à l'écran d'accueil » dans le menu du navigateur).
2. Un joueur choisit un prénom et clique sur **Créer une partie** : un code
   à 4 lettres apparaît.
3. Les autres joueurs entrent ce code pour rejoindre la salle (2 à 4 joueurs).
4. L'hôte choisit un ou plusieurs packs de spectres (leurs spectres sont
   alors mélangés) puis démarre la partie.
5. Chacun écrit ses 3 indices (avec la possibilité de changer de spectre
   jusqu'à 3 fois par indice), puis les devinettes se jouent un tour à la
   fois : pendant qu'un joueur place son aiguille, les autres la voient
   bouger en direct, et la position réelle est révélée à la fin du tour.
6. Les scores s'affichent à la fin ; l'hôte peut relancer une nouvelle partie.

### Modes de jeu

À partir de 3 joueurs, le lobby affiche une carte **« Mode de jeu »** où
l'hôte choisit entre :

- **Solo** (par défaut) : comme décrit ci-dessus, un seul joueur devine à
  chaque tour.
- **Consensus** : tous les joueurs sauf l'auteur de l'indice voient la même
  aiguille et doivent se mettre d'accord sur sa position. Chacun peut la
  déplacer (ce qui réinitialise les accords déjà donnés) puis valider avec
  **« Je suis d'accord »** ; le tour n'est noté que lorsque tout le monde est
  d'accord.

### Personnaliser les spectres

Depuis l'écran d'accueil, **« Gérer mes packs de spectres »** permet de créer
un pack personnalisé (ex. des références internes à un groupe d'amis). Un
code à 6 caractères est généré : il suffit de le communiquer aux autres
joueurs pour qu'ils ajoutent le pack chez eux. Ce code est ensuite mémorisé
sur chaque téléphone, pas besoin de le ressaisir à chaque partie. Le bouton
**« Modifier »** permet à tout moment d'ajouter, retirer ou changer les
spectres d'un pack existant (le code reste le même, les autres joueurs
récupèrent la nouvelle version automatiquement).

## Stack technique

- **Frontend** : React + Vite, hébergé sur GitHub Pages
- **Synchronisation temps réel** : Firebase Realtime Database

## Configuration (Firebase)

Le jeu a besoin d'une base Firebase Realtime Database (gratuite) pour
synchroniser l'état des parties entre les téléphones.

1. Crée un projet sur la [console Firebase](https://console.firebase.google.com/).
2. Dans **Build > Realtime Database**, crée une base de données (mode test
   ou avec les règles ci-dessous).
3. Dans **Paramètres du projet > Vos applications**, ajoute une application
   web et copie la configuration SDK.
4. Pour le développement local : copie `.env.example` en `.env` et renseigne
   les valeurs.
5. Pour le déploiement : ajoute les mêmes valeurs comme **secrets** du dépôt
   GitHub (Settings > Secrets and variables > Actions), avec les noms
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`.

### Règles de la base de données

Usage privé entre amis : pas d'authentification, mais on limite la taille
des écritures pour éviter les abus.

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true
      }
    },
    "packs": {
      "$packCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> Si ta base existe déjà avec une ancienne règle `".write": "!data.exists()"`
> sur `packs`, mets-la à jour vers `".write": true` pour pouvoir éditer les
> packs personnalisés depuis l'app.

## Développement local

```bash
npm install
npm run dev
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` build et déploie automatiquement
sur GitHub Pages à chaque push sur `main`. Active GitHub Pages dans
**Settings > Pages > Source > GitHub Actions**.
