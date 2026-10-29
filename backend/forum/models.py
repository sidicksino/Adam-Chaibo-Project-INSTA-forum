from django.conf import settings
from django.db import models


class Categorie(models.Model):

    nom = models.CharField("nom", max_length=60, unique=True)
    couleur = models.CharField("couleur", max_length=7, default="#0b5ed7")

    class Meta:
        verbose_name = "catégorie"
        verbose_name_plural = "catégories"
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Tag(models.Model):

    nom = models.CharField("nom", max_length=30, unique=True)

    class Meta:
        verbose_name = "tag"
        verbose_name_plural = "tags"
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Question(models.Model):

    class Difficulte(models.TextChoices):
        DEBUTANT = "debutant", "Débutant"
        INTERMEDIAIRE = "intermediaire", "Intermédiaire"
        AVANCE = "avance", "Avancé"

    titre = models.CharField("titre", max_length=200)
    description = models.TextField("description")
    categorie = models.ForeignKey(
        Categorie, on_delete=models.PROTECT, related_name="questions", verbose_name="catégorie"
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="questions", verbose_name="tags")
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="questions", verbose_name="auteur"
    )
    difficulte = models.CharField(
        "niveau de difficulté", max_length=20, choices=Difficulte.choices, blank=True, default=""
    )
    code_extrait = models.TextField("extrait de code", blank=True, default="")
    langage = models.CharField("langage", max_length=30, blank=True, default="")
    date_creation = models.DateTimeField("date de création", auto_now_add=True)
    date_modification = models.DateTimeField("date de modification", null=True, blank=True)
    votes = models.IntegerField("votes", default=0)
    vues = models.PositiveIntegerField("vues", default=0)
    resolue = models.BooleanField("résolue", default=False)

    class Meta:
        verbose_name = "question"
        verbose_name_plural = "questions"
        ordering = ["-date_creation"]

    def __str__(self):
        return self.titre


class Reponse(models.Model):
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="reponses", verbose_name="question"
    )
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reponses", verbose_name="auteur"
    )
    contenu = models.TextField("contenu")
    date_creation = models.DateTimeField("date de création", auto_now_add=True)
    date_modification = models.DateTimeField("date de modification", null=True, blank=True)
    acceptee = models.BooleanField("acceptée", default=False)
    votes = models.IntegerField("votes", default=0)

    class Meta:
        verbose_name = "réponse"
        verbose_name_plural = "réponses"
        ordering = ["-acceptee", "-votes", "date_creation"]

    def __str__(self):
        return f"Réponse de {self.auteur} à « {self.question} »"


class VueQuestion(models.Model):

    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name="utilisateur"
    )
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="liste_vues", verbose_name="question"
    )
    date = models.DateTimeField("date", auto_now_add=True)

    class Meta:
        verbose_name = "vue"
        verbose_name_plural = "vues"
        constraints = [
            models.UniqueConstraint(fields=["utilisateur", "question"], name="une_vue_par_personne"),
        ]


class Favori(models.Model):

    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favoris", verbose_name="utilisateur"
    )
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="favoris", verbose_name="question"
    )
    date_ajout = models.DateTimeField("date d'ajout", auto_now_add=True)

    class Meta:
        verbose_name = "favori"
        verbose_name_plural = "favoris"
        constraints = [
            models.UniqueConstraint(fields=["utilisateur", "question"], name="un_favori_par_question"),
        ]


class Vote(models.Model):

    class Valeur(models.IntegerChoices):
        POUR = 1, "Pour"
        CONTRE = -1, "Contre"

    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name="utilisateur"
    )
    valeur = models.SmallIntegerField("valeur", choices=Valeur.choices)

    class Meta:
        abstract = True


class VoteQuestion(Vote):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="liste_votes")

    class Meta:
        verbose_name = "vote sur une question"
        verbose_name_plural = "votes sur les questions"
        constraints = [
            models.UniqueConstraint(fields=["utilisateur", "question"], name="un_vote_par_question"),
        ]


class VoteReponse(Vote):
    reponse = models.ForeignKey(Reponse, on_delete=models.CASCADE, related_name="liste_votes")

    class Meta:
        verbose_name = "vote sur une réponse"
        verbose_name_plural = "votes sur les réponses"
        constraints = [
            models.UniqueConstraint(fields=["utilisateur", "reponse"], name="un_vote_par_reponse"),
        ]


class Notification(models.Model):

    class Type(models.TextChoices):
        REPONSE = "reponse", "Nouvelle réponse à votre question"
        ACCEPTEE = "acceptee", "Votre réponse a été acceptée"

    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications", verbose_name="destinataire"
    )
    acteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+", verbose_name="acteur"
    )
    type = models.CharField("type", max_length=20, choices=Type.choices)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="+", verbose_name="question")
    reponse = models.ForeignKey(Reponse, on_delete=models.CASCADE, related_name="+", verbose_name="réponse")
    lue = models.BooleanField("lue", default=False)
    date = models.DateTimeField("date", auto_now_add=True)

    class Meta:
        verbose_name = "notification"
        verbose_name_plural = "notifications"
        ordering = ["-date"]
        indexes = [models.Index(fields=["destinataire", "lue"])]

    def __str__(self):
        return f"{self.get_type_display()} → {self.destinataire}"


class CaptureQuestion(models.Model):

    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="captures", verbose_name="question"
    )
    image = models.ImageField("image", upload_to="captures/")
    date_ajout = models.DateTimeField("date d'ajout", auto_now_add=True)

    class Meta:
        verbose_name = "capture d'écran"
        verbose_name_plural = "captures d'écran"
        ordering = ["date_ajout"]

    def __str__(self):
        return f"Capture pour « {self.question} »"
