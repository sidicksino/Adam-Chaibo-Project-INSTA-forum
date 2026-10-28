from django.db import migrations

# Catégories proposées dans le formulaire « Poser une question »
CATEGORIES = [
    ("Programmation", "#7c5cfc"),
    ("Réseaux", "#e5484d"),
    ("Bases de données", "#0e9f6e"),
    ("Systèmes & Linux", "#f59e0b"),
    ("Génie logiciel", "#0b5ed7"),
]


def creer_categories(apps, schema_editor):
    Categorie = apps.get_model("forum", "Categorie")
    for nom, couleur in CATEGORIES:
        Categorie.objects.get_or_create(nom=nom, defaults={"couleur": couleur})


def supprimer_categories(apps, schema_editor):
    Categorie = apps.get_model("forum", "Categorie")
    Categorie.objects.filter(nom__in=[nom for nom, _ in CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("forum", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(creer_categories, supprimer_categories),
    ]
