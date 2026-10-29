"""
Remplit la base avec des données de démonstration réalistes.

    python manage.py peupler              ajoute les membres, questions, réponses, votes…
    python manage.py peupler --supprimer  retire toutes les données de démonstration

Les comptes de démonstration ont une adresse en @insta-forum.example (domaine réservé
aux exemples : aucun email ne peut partir vers une vraie personne). Les vrais comptes
ne sont jamais modifiés.
"""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from comptes.models import Utilisateur
from forum.models import (
    Categorie, Favori, Notification, Question, Reponse, Tag, VoteQuestion, VoteReponse, VueQuestion,
)

DOMAINE = "insta-forum.example"
MOT_DE_PASSE = "Forum-Insta-2026"

# (identifiant, prénom, nom, profil, niveau)
MEMBRES = [
    ("mahamat.abakar", "Mahamat", "Abakar", "etudiant", "L3"),
    ("fatime.zakaria", "Fatimé", "Zakaria", "etudiant", "L2"),
    ("hawa.brahim", "Hawa", "Brahim", "etudiant", "M1"),
    ("ousmane.djibrine", "Ousmane", "Djibrine", "etudiant", "L1"),
    ("achta.moussa", "Achta", "Moussa", "etudiant", "L3"),
    ("brahim.issa", "Brahim", "Issa", "etudiant", "M2"),
    ("zara.adoum", "Zara", "Adoum", "etudiant", "L2"),
    ("abdelkerim.saleh", "Abdelkerim", "Saleh", "enseignant", ""),
    ("khadidja.hassan", "Khadidja", "Hassan", "enseignant", ""),
    ("idriss.ali", "Idriss", "Ali", "personnel", ""),
]

# Chaque question : auteur, catégorie, tags, il y a combien de jours, titre, description,
# puis ses réponses : (auteur, contenu, acceptée ?)
QUESTIONS = [
    {
        "auteur": "ousmane.djibrine", "categorie": "Programmation", "tags": ["Python", "Boucles"], "jours": 19,
        "titre": "Pourquoi ma boucle while ne s'arrête jamais ?",
        "description": (
            "Bonjour, je débute en Python. Ma fonction doit afficher les nombres de 0 à n, "
            "mais le programme tourne à l'infini et je dois l'arrêter avec Ctrl+C :\n\n"
            "```python\ndef compter(n):\n    i = 0\n    while i < n:\n        print(i)\n    return \"fini\"\n\n"
            "compter(5)\n```\n\nQu'est-ce qui ne va pas ?"
        ),
        "reponses": [
            ("hawa.brahim",
             "Tu n'augmentes jamais `i` dans la boucle : la condition `i < n` reste toujours vraie. "
             "Ajoute l'incrémentation à la fin de la boucle :\n\n"
             "```python\ndef compter(n):\n    i = 0\n    while i < n:\n        print(i)\n        i += 1\n    return \"fini\"\n```",
             True),
            ("brahim.issa",
             "En complément : quand on connaît le nombre de tours à l'avance, une boucle `for` évite ce piège.\n\n"
             "```python\nfor i in range(n):\n    print(i)\n```",
             False),
        ],
    },
    {
        "auteur": "fatime.zakaria", "categorie": "Bases de données", "tags": ["SQL", "Modélisation"], "jours": 17,
        "titre": "Quelle est la différence entre une clé primaire et une clé étrangère ?",
        "description": (
            "Je prépare l'examen de bases de données et je confonds encore les deux notions. "
            "Quelqu'un peut-il m'expliquer avec un exemple simple (étudiants et filières par exemple) ?"
        ),
        "reponses": [
            ("khadidja.hassan",
             "La clé primaire identifie une ligne de façon unique dans sa table. "
             "La clé étrangère est une colonne qui fait référence à la clé primaire d'une autre table : "
             "c'est elle qui crée le lien entre les deux.\n\n"
             "```sql\nCREATE TABLE filiere (\n    id   INT PRIMARY KEY,\n    nom  VARCHAR(100) NOT NULL\n);\n\n"
             "CREATE TABLE etudiant (\n    matricule   VARCHAR(20) PRIMARY KEY,\n    nom         VARCHAR(100),\n"
             "    filiere_id  INT REFERENCES filiere(id)\n);\n```\n\n"
             "Ici, `filiere_id` est une clé étrangère : on ne peut pas inscrire un étudiant dans une filière qui n'existe pas.",
             True),
            ("achta.moussa",
             "Une astuce pour retenir : la clé primaire dit « qui je suis », la clé étrangère dit « à qui je suis lié ».",
             False),
        ],
    },
    {
        "auteur": "mahamat.abakar", "categorie": "Réseaux", "tags": ["Linux", "Ubuntu", "IP"], "jours": 15,
        "titre": "Comment configurer une adresse IP statique sous Ubuntu Server 24.04 ?",
        "description": (
            "Pour le TP de réseaux, je dois donner une IP fixe (192.168.10.20/24) à mon serveur Ubuntu. "
            "J'ai vu des tutoriels avec `/etc/network/interfaces` mais ce fichier n'existe pas chez moi."
        ),
        "reponses": [
            ("idriss.ali",
             "Depuis Ubuntu 18.04, la configuration passe par netplan. Modifiez le fichier YAML du dossier "
             "`/etc/netplan/` (attention, l'indentation compte) :\n\n"
             "```\nnetwork:\n  version: 2\n  ethernets:\n    enp0s3:\n      dhcp4: false\n"
             "      addresses: [192.168.10.20/24]\n      routes:\n        - to: default\n          via: 192.168.10.1\n"
             "      nameservers:\n        addresses: [8.8.8.8, 1.1.1.1]\n```\n\nPuis appliquez :\n\n"
             "```bash\nsudo netplan try\nsudo netplan apply\nip a\n```\n\n"
             "`netplan try` annule tout seul après 2 minutes si vous perdez la connexion : pratique à distance.",
             True),
        ],
    },
    {
        "auteur": "zara.adoum", "categorie": "Programmation", "tags": ["Java", "Exceptions"], "jours": 13,
        "titre": "NullPointerException quand j'ajoute un élément à ma liste en Java",
        "description": (
            "J'ai cette classe pour gérer les notes, mais `ajouterNote` plante avec une NullPointerException :\n\n"
            "```java\npublic class Bulletin {\n    private List<Double> notes;\n\n"
            "    public void ajouterNote(double note) {\n        notes.add(note);\n    }\n}\n```"
        ),
        "reponses": [
            ("abdelkerim.saleh",
             "L'attribut `notes` est déclaré mais jamais créé : il vaut `null`. Il faut instancier la liste, "
             "par exemple directement à la déclaration :\n\n"
             "```java\nprivate List<Double> notes = new ArrayList<>();\n```\n\n"
             "N'oubliez pas `import java.util.ArrayList;`.",
             True),
            ("mahamat.abakar", "J'avais exactement le même problème la semaine dernière, merci pour la question !", False),
        ],
    },
    {
        "auteur": "achta.moussa", "categorie": "Génie logiciel", "tags": ["UML", "Conception"], "jours": 12,
        "titre": "Diagramme de classes : association, agrégation ou composition ?",
        "description": (
            "Dans notre projet de forum, une Question possède plusieurs Réponses, et un Utilisateur écrit "
            "plusieurs Questions. Quelle relation dessiner dans StarUML pour chaque cas ?"
        ),
        "reponses": [
            ("abdelkerim.saleh",
             "Posez-vous la question : « la partie peut-elle exister sans le tout ? »\n\n"
             "- Question → Réponse : une réponse n'a pas de sens sans sa question, et elle est supprimée avec elle. "
             "C'est une composition (losange plein).\n"
             "- Utilisateur → Question : c'est une simple association 1..* (un utilisateur écrit 0 ou plusieurs questions).\n\n"
             "L'agrégation (losange vide) est rarement indispensable : en cas de doute, une association suffit.",
             True),
            ("brahim.issa",
             "Pour info, dans le code Django du forum ça correspond à `on_delete=models.CASCADE` entre Reponse et Question : "
             "c'est la composition traduite en base de données.",
             False),
        ],
    },
    {
        "auteur": "ousmane.djibrine", "categorie": "Systèmes & Linux", "tags": ["Bash", "Permissions"], "jours": 10,
        "titre": "« Permission denied » quand je lance mon script .sh",
        "description": "J'ai écrit `sauvegarde.sh` mais quand je tape `./sauvegarde.sh` j'obtiens `bash: ./sauvegarde.sh: Permission denied`.",
        "reponses": [
            ("idriss.ali",
             "Le fichier n'a pas le droit d'exécution. Ajoutez-le avec `chmod`, puis relancez :\n\n"
             "```bash\nchmod +x sauvegarde.sh\n./sauvegarde.sh\n```\n\n"
             "Vérifiez aussi que la première ligne du script est bien `#!/bin/bash`.",
             True),
        ],
    },
    {
        "auteur": "hawa.brahim", "categorie": "Programmation", "tags": ["React", "JavaScript"], "jours": 8,
        "titre": "Pourquoi useEffect s'exécute deux fois en développement ?",
        "description": (
            "Dans mon composant React, la requête vers l'API part deux fois au chargement :\n\n"
            "```javascript\nuseEffect(() => {\n  fetch(\"/api/questions/\").then((r) => r.json()).then(setQuestions);\n}, []);\n```\n\n"
            "Pourtant le tableau de dépendances est vide."
        ),
        "reponses": [
            ("brahim.issa",
             "C'est normal : en développement, `<StrictMode>` monte, démonte puis remonte chaque composant pour "
             "détecter les effets mal nettoyés. En production (`npm run build`), l'effet ne s'exécute qu'une fois.\n\n"
             "Si la double requête pose problème (un compteur par exemple), c'est au serveur de rester correct "
             "quand il reçoit deux fois la même demande.",
             True),
        ],
    },
    {
        "auteur": "fatime.zakaria", "categorie": "Bases de données", "tags": ["SQL", "GROUP BY"], "jours": 7,
        "titre": "Compter le nombre d'étudiants par niveau en SQL",
        "description": "J'ai une table `etudiant(matricule, nom, niveau)`. Comment obtenir le nombre d'étudiants pour chaque niveau (L1, L2…) ?",
        "reponses": [
            ("khadidja.hassan",
             "Il faut regrouper les lignes avec `GROUP BY` puis compter dans chaque groupe :\n\n"
             "```sql\nSELECT niveau, COUNT(*) AS nombre\nFROM etudiant\nGROUP BY niveau\nORDER BY niveau;\n```\n\n"
             "Pour ne garder que les niveaux de plus de 30 étudiants, on filtre les groupes avec `HAVING COUNT(*) > 30`.",
             True),
            ("zara.adoum", "Merci, le `HAVING` m'a aussi débloquée pour le TP 4 !", False),
        ],
    },
    {
        "auteur": "mahamat.abakar", "categorie": "Programmation", "tags": ["C", "Pointeurs"], "jours": 6,
        "titre": "Erreur de segmentation avec un pointeur en C",
        "description": (
            "Mon programme compile mais plante avec `Segmentation fault (core dumped)` :\n\n"
            "```c\n#include <stdio.h>\n\nint main(void) {\n    int *valeur;\n    *valeur = 42;\n"
            "    printf(\"%d\\n\", *valeur);\n    return 0;\n}\n```"
        ),
        "reponses": [
            ("abdelkerim.saleh",
             "`valeur` n'est pas initialisé : il pointe vers une adresse au hasard, et écrire à cette adresse "
             "provoque l'erreur. Faites-le pointer vers une vraie variable, ou réservez la mémoire :\n\n"
             "```c\nint nombre;\nint *valeur = &nombre;\n*valeur = 42;\n```\n\n"
             "Compilez avec `gcc -Wall -g` : l'avertissement « may be used uninitialized » vous aurait prévenu.",
             False),
            ("hawa.brahim",
             "Et avec `malloc` si tu as besoin de mémoire dynamique (sans oublier le `free`) :\n\n"
             "```c\nint *valeur = malloc(sizeof(int));\n*valeur = 42;\nfree(valeur);\n```",
             False),
        ],
    },
    {
        "auteur": "zara.adoum", "categorie": "Réseaux", "tags": ["TCP", "UDP", "Sockets"], "jours": 5,
        "titre": "TCP ou UDP pour une application de chat en projet tutoré ?",
        "description": "Pour notre projet de messagerie entre les postes de la salle info, faut-il utiliser TCP ou UDP ? Quels sont les avantages de chacun ?",
        "reponses": [
            ("idriss.ali",
             "Pour un chat, TCP : les messages arrivent tous, dans l'ordre, et la connexion est maintenue. "
             "UDP est plus rapide mais peut perdre ou désordonner des paquets : on le réserve à la voix, la vidéo ou les jeux.",
             False),
            ("brahim.issa",
             "D'accord avec Idriss. Et si vous faites une version web, regardez les WebSockets : ils reposent sur TCP.",
             False),
        ],
    },
    {
        "auteur": "brahim.issa", "categorie": "Génie logiciel", "tags": ["Git", "Travail en équipe"], "jours": 4,
        "titre": "Comment bien utiliser Git à plusieurs pour le projet de fin d'études ?",
        "description": "On est quatre sur le même dépôt et on écrase régulièrement le travail des autres. Quelle méthode simple nous conseillez-vous ?",
        "reponses": [
            ("abdelkerim.saleh",
             "Une branche par fonctionnalité, et jamais de travail directement sur `main` :\n\n"
             "```bash\ngit switch -c inscription-etudiants\n# ... travail, puis :\ngit add .\n"
             "git commit -m \"Ajout du formulaire d'inscription\"\ngit push -u origin inscription-etudiants\n```\n\n"
             "Ouvrez ensuite une « pull request » : un camarade relit avant la fusion. "
             "Et faites `git pull` chaque matin avant de commencer.",
             True),
        ],
    },
    {
        "auteur": "achta.moussa", "categorie": "Programmation", "tags": ["PHP", "Formulaires"], "jours": 2,
        "titre": "Formulaire PHP : $_POST est toujours vide",
        "description": (
            "Quand j'envoie mon formulaire, `$_POST['nom']` est vide alors que le champ est rempli :\n\n"
            "```html\n<form action=\"traitement.php\">\n  <input type=\"text\" id=\"nom\">\n"
            "  <button type=\"submit\">Envoyer</button>\n</form>\n```"
        ),
        "reponses": [],
    },
    {
        "auteur": "ousmane.djibrine", "categorie": "Systèmes & Linux", "tags": ["Python", "Windows"], "jours": 1,
        "titre": "« python n'est pas reconnu » après l'installation sous Windows",
        "description": "J'ai installé Python 3.12 mais dans l'invite de commandes, `python --version` affiche « 'python' n'est pas reconnu en tant que commande interne ».",
        "reponses": [
            ("mahamat.abakar",
             "Python n'a pas été ajouté au PATH. Relance l'installateur, choisis « Modify », et coche "
             "« Add Python to environment variables ». Sinon, la commande `py` fonctionne souvent quand même :\n\n"
             "```bash\npy --version\n```",
             False),
        ],
    },
    {
        "auteur": "hawa.brahim", "categorie": "Programmation", "tags": ["Python", "Pandas"], "jours": 0,
        "titre": "Lire un fichier CSV avec des accents dans pandas",
        "description": (
            "Mon fichier `resultats.csv` (exporté depuis Excel) contient des noms avec accents, et "
            "`pd.read_csv(\"resultats.csv\")` affiche une erreur `UnicodeDecodeError`. Comment faire ?"
        ),
        "reponses": [],
    },
]


class Command(BaseCommand):
    help = "Ajoute des données de démonstration (membres, questions, réponses, votes…), ou les retire avec --supprimer."

    def add_arguments(self, parser):
        parser.add_argument("--supprimer", action="store_true", help="Retire toutes les données de démonstration.")

    def handle(self, *args, **options):
        demo = Utilisateur.objects.filter(email__endswith=f"@{DOMAINE}")

        if options["supprimer"]:
            # Supprimer les membres supprime aussi leurs questions, réponses, votes… (CASCADE)
            nombre = demo.count()
            demo.delete()
            Tag.objects.filter(questions__isnull=True).delete()
            self._recalculer_scores()
            self.stdout.write(self.style.SUCCESS(f"{nombre} membres de démonstration supprimés avec leur contenu."))
            return

        if demo.exists():
            self.stdout.write(self.style.WARNING(
                "Les données de démonstration sont déjà présentes. "
                "Pour repartir de zéro : python manage.py peupler --supprimer, puis relancez."
            ))
            return

        with transaction.atomic():
            self._peupler()

    def _peupler(self):
        hasard = random.Random(2026)  # toujours le même résultat d'une exécution à l'autre
        maintenant = timezone.now()

        membres = {}
        for identifiant, prenom, nom, profil, niveau in MEMBRES:
            membre = Utilisateur.objects.create_user(
                username=identifiant, email=f"{identifiant}@{DOMAINE}", password=MOT_DE_PASSE,
                first_name=prenom, last_name=nom, profil=profil, niveau=niveau,
            )
            # Inscriptions étalées sur le mois précédent
            Utilisateur.objects.filter(pk=membre.pk).update(date_joined=maintenant - timedelta(days=hasard.randint(25, 40)))
            membres[identifiant] = membre

        categories = {c.nom: c for c in Categorie.objects.all()}
        nb_questions = nb_reponses = 0

        for donnees in QUESTIONS:
            auteur = membres[donnees["auteur"]]
            question = Question.objects.create(
                titre=donnees["titre"], description=donnees["description"],
                categorie=categories[donnees["categorie"]], auteur=auteur,
            )
            question.tags.set([
                Tag.objects.filter(nom__iexact=nom).first() or Tag.objects.create(nom=nom) for nom in donnees["tags"]
            ])
            date_question = maintenant - timedelta(days=donnees["jours"], hours=hasard.randint(1, 10))
            Question.objects.filter(pk=question.pk).update(date_creation=date_question)
            nb_questions += 1

            autres = [m for m in membres.values() if m != auteur]

            # Vues : une partie des membres a ouvert la question
            lecteurs = hasard.sample(autres, k=hasard.randint(3, len(autres)))
            VueQuestion.objects.bulk_create(VueQuestion(utilisateur=m, question=question) for m in lecteurs)

            # Votes sur la question (quelques-uns de ceux qui l'ont lue)
            for votant in hasard.sample(lecteurs, k=hasard.randint(0, len(lecteurs) // 2)):
                VoteQuestion.objects.create(utilisateur=votant, question=question, valeur=1)

            # Favoris
            for membre in hasard.sample(lecteurs, k=hasard.randint(0, 2)):
                Favori.objects.create(utilisateur=membre, question=question)

            # Réponses, quelques heures après la question
            date_reponse = date_question
            resolue = False
            for identifiant, contenu, acceptee in donnees["reponses"]:
                repondant = membres[identifiant]
                date_reponse += timedelta(hours=hasard.randint(1, 20), minutes=hasard.randint(0, 59))
                reponse = Reponse.objects.create(question=question, auteur=repondant, contenu=contenu, acceptee=acceptee)
                Reponse.objects.filter(pk=reponse.pk).update(date_creation=date_reponse)
                nb_reponses += 1

                # Votes : la réponse acceptée est la plus appréciée
                votants = [m for m in lecteurs if m != repondant]
                for votant in hasard.sample(votants, k=min(len(votants), hasard.randint(3, 6) if acceptee else hasard.randint(0, 3))):
                    VoteReponse.objects.create(utilisateur=votant, reponse=reponse, valeur=1)

                # Notifications, comme dans l'application ; les plus anciennes sont lues
                lue = donnees["jours"] > 3
                notification = Notification.objects.create(
                    destinataire=auteur, acteur=repondant, type=Notification.Type.REPONSE,
                    question=question, reponse=reponse, lue=lue,
                )
                Notification.objects.filter(pk=notification.pk).update(date=date_reponse)
                if acceptee:
                    resolue = True
                    notification = Notification.objects.create(
                        destinataire=repondant, acteur=auteur, type=Notification.Type.ACCEPTEE,
                        question=question, reponse=reponse, lue=lue,
                    )
                    Notification.objects.filter(pk=notification.pk).update(date=date_reponse + timedelta(hours=2))

            Question.objects.filter(pk=question.pk).update(vues=len(lecteurs), resolue=resolue)

        self._recalculer_scores()
        self.stdout.write(self.style.SUCCESS(
            f"Données de démonstration ajoutées : {len(membres)} membres, {nb_questions} questions, {nb_reponses} réponses.\n"
            f"Connexion possible avec n'importe quel membre, par exemple « hawa.brahim », "
            f"mot de passe « {MOT_DE_PASSE} »."
        ))

    @staticmethod
    def _recalculer_scores():
        """Le score affiché de chaque question et réponse = la somme de ses votes."""
        for question in Question.objects.all():
            total = question.liste_votes.aggregate(t=Sum("valeur"))["t"] or 0
            Question.objects.filter(pk=question.pk).update(votes=total)
        for reponse in Reponse.objects.all():
            total = reponse.liste_votes.aggregate(t=Sum("valeur"))["t"] or 0
            Reponse.objects.filter(pk=reponse.pk).update(votes=total)
