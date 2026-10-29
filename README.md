# INSTA-FORUM

Forum de questions-réponses pour les étudiants, enseignants et le personnel du département de génie informatique de l’INSTA.

On y pose ses questions, on répond à celles des autres, on vote pour les meilleures réponses et l’auteur d’une question choisit celle qui a résolu son problème.

## Fonctionnalités

- **Comptes** : inscription (prénom, nom, profil étudiant / enseignant / personnel, niveau), connexion avec le nom d’utilisateur **ou** l’email, option « Se souvenir de moi », déconnexion.
- **Questions** : publication avec catégorie et tags, recherche, onglets *Récentes*, *Populaires*, *Sans réponse*, *Résolues*.
- **Réponses** : page de détail d’une question, réponses, compteur de vues (une vue par membre).
- **Modifier / supprimer** : chacun peut corriger ou supprimer ses propres questions et réponses (mention « modifiée »).
- **Profil des membres** : cliquer sur un nom ouvre son profil (questions, réponses, statistiques, rang au classement). Sur son propre profil, l’onglet « Paramètres » permet de modifier ses informations et son mot de passe.
- **Mot de passe oublié** : lien envoyé par email (valable 1 heure, utilisable une seule fois) pour choisir un nouveau mot de passe.
- **Notifications** (🔔) : prévient quand quelqu’un répond à votre question ou accepte votre réponse ; pastille rouge, vérification toutes les 30 s, « Tout marquer comme lu ».
- **Captures d’écran** : jusqu’à 5 images par question (5 Mo max). Elles sont redimensionnées (1600 px) et converties en WebP à l’envoi, avec une miniature de 400 px affichée sur les cartes de l’accueil.
- **Code mis en forme** : le code entouré de ``` s’affiche en couleur (Python, Java, C, C++, C#, JavaScript, TypeScript, PHP, SQL, HTML, CSS, JSON, terminal), avec un bouton « Copier » ; `code` dans une phrase est aussi mis en valeur. Le bouton « </> Code » des formulaires insère le bloc.
- **Réponse acceptée** : l’auteur de la question choisit la bonne réponse, la question passe en *Résolue*.
- **Votes** : pour (▲) ou contre (▼) une question ou une réponse ; impossible de voter pour soi-même.
- **Menu** : *Accueil*, *Questions* (filtre par catégorie), *Catégories*, *Mes questions*, *Favoris* (☆), *Classement*.
- **Classement** des membres par points (voir [Barème](#barème-du-classement)).
- **Administration** Django pour gérer les utilisateurs, catégories, questions et réponses.

## Technologies

| Partie | Outils |
|---|---|
| Frontend | React 18, Vite 5, highlight.js (coloration du code) |
| Backend | Django 6.1, Django REST Framework, django-cors-headers |
| Base de données | SQLite (fichier `backend/db.sqlite3`, créé automatiquement) |
| Authentification | Jeton (`Authorization: Token <jeton>`) |

## Structure du projet

```
.
├── backend/                 API Django
│   ├── config/              réglages (settings.py) et adresses principales (urls.py)
│   ├── comptes/             utilisateurs : inscription, connexion, déconnexion
│   ├── forum/               catégories, questions, réponses, votes, favoris, classement
│   ├── manage.py
│   └── requirements.txt     dépendances Python
├── frontend/                application React
│   ├── src/
│   │   ├── api.js           tous les appels vers l’API Django
│   │   ├── commun.jsx       outils partagés (avatars, dates « il y a… »)
│   │   ├── App.jsx          navigation entre les pages
│   │   └── pages/           Connexion, Inscription, Accueil, Poser une question, Détail
│   └── package.json
└── *.pdf                    maquettes des pages
```

## Prérequis

- **Python 3.12 ou plus récent** (Django 6.1 l’exige) : vérifier avec `python --version` (Windows) ou `python3 --version` (macOS / Linux)
- **Node.js 18 ou plus récent** : vérifier avec `node --version`
- **Git**

## Installation

### 1. Récupérer le projet

```bash
git clone https://github.com/sidicksino/Adam-Chaibo-Project-INSTA-forum.git
cd Adam-Chaibo-Project-INSTA-forum
```

### 2. Backend (Django)

Dans un premier terminal, depuis la racine du projet :

**macOS / Linux**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
```

**Windows (PowerShell)**

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
```

> Sous Windows, si PowerShell refuse d’exécuter `Activate.ps1`, lancez d’abord :
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

`migrate` crée la base de données et les cinq catégories de départ (Programmation, Réseaux, Bases de données, Systèmes & Linux, Génie logiciel).

Optionnel, pour remplir le forum avec des **données de démonstration** (10 membres, 14 questions avec du code, réponses, votes, favoris, notifications) :

```bash
python manage.py peupler
```

Tous les membres de démonstration ont le mot de passe `Forum-Insta-2026` (par exemple `hawa.brahim`, `abdelkerim.saleh`). Leurs adresses se terminent par `@insta-forum.example`, un domaine réservé aux exemples. Pour les retirer : `python manage.py peupler --supprimer` (les vrais comptes ne sont jamais touchés).

Optionnel, pour accéder à l’administration Django :

```bash
python manage.py createsuperuser
```

### 3. Frontend (React)

Dans un second terminal, depuis la racine du projet :

```bash
cd frontend
npm install
```

## Lancer le projet

Il faut **deux terminaux ouverts en même temps** : un pour le backend, un pour le frontend.

**Terminal 1 – backend** (le `venv` doit être activé, voir plus haut) :

```bash
cd backend
python manage.py runserver
```

**Terminal 2 – frontend** :

```bash
cd frontend
npm run dev
```

Ouvrez ensuite **http://localhost:5173** dans votre navigateur et créez un compte.

| Adresse | Contenu |
|---|---|
| http://localhost:5173 | le site |
| http://127.0.0.1:8000/api/ | l’API (navigable dans le navigateur) |
| http://127.0.0.1:8000/admin/ | l’administration Django |

## Configuration

### Envoi des emails (mot de passe oublié)

Sans réglage, les emails ne partent pas : ils s’affichent dans le **terminal du backend** (`runserver`), et vous pouvez copier le lien depuis là. Pour les envoyer vraiment avec Gmail :

1. Activez la **validation en deux étapes** sur le compte Google qui enverra les emails.
2. Créez un **mot de passe d’application** : https://myaccount.google.com/apppasswords (16 lettres). N’utilisez jamais votre mot de passe Gmail normal.
3. Dans `backend`, copiez `.env.exemple` sous le nom `.env` et remplissez :

   ```
   EMAIL_UTILISATEUR=votre.adresse@gmail.com
   EMAIL_MOT_DE_PASSE=abcdefghijklmnop
   ```

4. Redémarrez `python manage.py runserver`.

Le fichier `.env` est dans `.gitignore` : il n’est **jamais envoyé sur GitHub**. Chaque membre de l’équipe crée le sien.

### Adresse de l’API

Le frontend appelle par défaut l’API sur `http://127.0.0.1:8000/api`. Pour changer cette adresse, créez un fichier `frontend/.env` :

```
VITE_API_URL=http://mon-serveur:8000/api
```

Si le frontend tourne sur une autre adresse que `localhost:5173`, ajoutez-la à `CORS_ALLOWED_ORIGINS` dans `backend/config/settings.py`.

## API

Toutes les adresses commencent par `/api/`. 🔒 = connexion obligatoire (en-tête `Authorization: Token <jeton>`).

### Comptes

| Méthode | Adresse | Rôle |
|---|---|---|
| POST | `/comptes/inscription/` | créer un compte |
| POST | `/comptes/connexion/` | se connecter (`identifier` = nom d’utilisateur ou email) → renvoie le jeton |
| POST | `/comptes/deconnexion/` 🔒 | supprimer le jeton |
| GET | `/comptes/moi/` 🔒 | utilisateur connecté |
| PATCH | `/comptes/moi/` 🔒 | modifier son prénom, nom, profil ou niveau |
| POST | `/comptes/mot-de-passe/` 🔒 | changer son mot de passe (`ancien`, `nouveau`) → nouveau jeton |
| POST | `/comptes/mot-de-passe-oublie/` | envoie le lien par email (`{"email": …}`) |
| POST | `/comptes/reinitialiser/verifier/` | le lien (`uid`, `token`) est-il encore valable ? |
| POST | `/comptes/reinitialiser/` | nouveau mot de passe (`uid`, `token`, `password`) |

### Forum

| Méthode | Adresse | Rôle |
|---|---|---|
| GET | `/questions/` | toutes les questions |
| POST | `/questions/` 🔒 | publier une question |
| GET | `/questions/<id>/` | une question (une vue par membre, l’auteur n’est pas compté) |
| PATCH | `/questions/<id>/` 🔒 | modifier sa question (auteur uniquement) |
| DELETE | `/questions/<id>/` 🔒 | supprimer sa question et ses réponses (auteur uniquement) |
| GET | `/questions/<id>/reponses/` | réponses d’une question |
| POST | `/questions/<id>/reponses/` 🔒 | répondre |
| POST | `/questions/<id>/voter/` 🔒 | voter : `{"valeur": 1}` ou `{"valeur": -1}` |
| POST | `/questions/<id>/favori/` 🔒 | ajouter ou retirer des favoris |
| PATCH | `/reponses/<id>/` 🔒 | modifier sa réponse (auteur uniquement) |
| DELETE | `/reponses/<id>/` 🔒 | supprimer sa réponse (auteur uniquement) |
| POST | `/reponses/<id>/voter/` 🔒 | voter pour une réponse |
| POST | `/reponses/<id>/accepter/` 🔒 | accepter une réponse (auteur de la question uniquement) |
| GET | `/notifications/` 🔒 | 30 dernières notifications et nombre de non lues |
| POST | `/notifications/lire/` 🔒 | tout marquer comme lu, ou une seule avec `{"id": 12}` |
| POST | `/questions/<id>/captures/` 🔒 | ajouter des captures (`images`, multipart ; auteur uniquement) |
| DELETE | `/captures/<id>/` 🔒 | supprimer une capture (auteur de la question) |
| GET | `/categories/` | catégories et nombre de questions |
| GET | `/statistiques/` | chiffres de la page d’accueil |
| GET | `/classement/` | classement des membres |
| GET | `/membres/<nom d’utilisateur>/` | profil public d’un membre (l’email n’est visible que par lui-même) |

Revoter la même valeur, ou cliquer de nouveau sur « favori » ou « accepter », **annule** l’action.

## Tests automatisés

55 tests vérifient les règles du forum : inscription et connexion, mot de passe oublié, une vue par membre (l’auteur n’est pas compté), pas de vote pour soi-même, une seule réponse acceptée, seul l’auteur modifie ou supprime, favoris, notifications, classement, tri des questions et données de démonstration.

```bash
cd backend
python manage.py test
```

Django crée une base de données temporaire pour les tests : **vos vraies données ne sont jamais touchées**. Lancez-les avant chaque `git push` : si un test échoue, son nom indique la règle qui ne fonctionne plus.

## Barème du classement

| Action | Points |
|---|---|
| Question publiée | 2 |
| Réponse publiée | 5 |
| Réponse acceptée | +15 (en plus des 5) |
| Vote reçu | +1 ou −1 |

Le barème se modifie dans `backend/forum/views.py` (constantes `POINTS_…`).

## Problèmes fréquents

**L’email « mot de passe oublié » n’arrive pas**
Sans fichier `backend/.env`, c’est normal : l’email est affiché dans le terminal du backend. Avec Gmail : vérifiez le mot de passe d’application (pas le mot de passe normal), regardez dans les spams, et lisez l’erreur dans le terminal du backend.

**`vite: Permission denied` ou `'vite' n’est pas reconnu`**
Le dossier `node_modules` vient d’un autre ordinateur. Supprimez-le puis réinstallez :

```bash
cd frontend
rm -rf node_modules        # Windows : rmdir /s /q node_modules
npm install
```

**« Impossible de joindre le serveur. Vérifiez que le backend est démarré. »**
Le backend n’est pas lancé : démarrez `python manage.py runserver` dans le dossier `backend`.

**`Error: That port is already in use.`**
Un autre serveur Django tourne déjà sur le port 8000. Fermez-le, ou lancez celui-ci sur un autre port (`python manage.py runserver 8001`) et adaptez `VITE_API_URL`.

**`ModuleNotFoundError: No module named 'django'`**
L’environnement virtuel n’est pas activé : relancez `source venv/bin/activate` (macOS / Linux) ou `venv\Scripts\Activate.ps1` (Windows).

**Après un `git pull`, une erreur parle d’une table ou d’une colonne manquante**
De nouvelles migrations sont arrivées : lancez `python manage.py migrate`.

## Reste à faire

- [x] Modifier et supprimer ses propres questions et réponses
- [x] Adresses de pages (`#/questions/12`) : l’actualisation et le bouton Retour du navigateur fonctionnent
- [x] Mise en forme du code dans les questions et réponses (blocs entre trois accents graves)
- [x] « Mot de passe oublié » (réinitialisation par email)
- [x] Notifications (cloche)
- [x] Page de profil
- [x] Tests automatisés (backend)
- [ ] Réglages de production avant la mise en ligne : `SECRET_KEY` hors du code, `DEBUG = False`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`
- [ ] Pagination des questions

## Équipe

Projet du groupe 5 – INSTA, département de génie informatique.
