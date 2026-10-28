from django.contrib.auth.models import AbstractUser
from django.db import models


class Utilisateur(AbstractUser):
    """Utilisateur du forum : étudiant, enseignant ou personnel de l'INSTA."""

    class Profil(models.TextChoices):
        ETUDIANT = "etudiant", "Étudiant"
        ENSEIGNANT = "enseignant", "Enseignant"
        PERSONNEL = "personnel", "Personnel"

    class Niveau(models.TextChoices):
        L1 = "L1", "Licence 1"
        L2 = "L2", "Licence 2"
        L3 = "L3", "Licence 3"
        M1 = "M1", "Master 1"
        M2 = "M2", "Master 2"

    # L'email sert aussi d'identifiant de connexion : il doit être unique.
    email = models.EmailField("adresse email", unique=True)
    profil = models.CharField("profil", max_length=20, choices=Profil.choices)
    # Le niveau ne concerne que les étudiants.
    niveau = models.CharField("niveau", max_length=2, choices=Niveau.choices, blank=True)

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self):
        return self.username
