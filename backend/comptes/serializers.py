from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import Utilisateur


class UtilisateurSerializer(serializers.ModelSerializer):
    """Données publiques d'un utilisateur renvoyées au frontend."""

    prenom = serializers.CharField(source="first_name")
    nom = serializers.CharField(source="last_name")

    class Meta:
        model = Utilisateur
        fields = ["id", "username", "email", "prenom", "nom", "profil", "niveau"]


class ModificationProfilSerializer(serializers.ModelSerializer):
    """Ce qu'un membre peut changer lui-même : nom, prénom, profil et niveau."""

    prenom = serializers.CharField(source="first_name", max_length=150)
    nom = serializers.CharField(source="last_name", max_length=150)

    class Meta:
        model = Utilisateur
        fields = ["prenom", "nom", "profil", "niveau"]
        extra_kwargs = {"niveau": {"required": False}}

    def validate(self, donnees):
        # Même règle qu'à l'inscription : niveau obligatoire pour un étudiant, vide sinon
        profil = donnees.get("profil", self.instance.profil)
        niveau = donnees.get("niveau", self.instance.niveau)
        if profil == Utilisateur.Profil.ETUDIANT:
            if not niveau:
                raise serializers.ValidationError({"niveau": "Choisissez votre niveau."})
        else:
            donnees["niveau"] = ""
        return donnees


class ChangementMotDePasseSerializer(serializers.Serializer):
    ancien = serializers.CharField(write_only=True, error_messages={"blank": "Indiquez votre mot de passe actuel."})
    nouveau = serializers.CharField(write_only=True, error_messages={"blank": "Choisissez un nouveau mot de passe."})

    def validate_ancien(self, valeur):
        if not self.context["request"].user.check_password(valeur):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return valeur

    def validate(self, donnees):
        if donnees["ancien"] == donnees["nouveau"]:
            raise serializers.ValidationError({"nouveau": "Le nouveau mot de passe doit être différent de l’actuel."})
        try:
            validate_password(donnees["nouveau"], user=self.context["request"].user)
        except Exception as erreur:
            raise serializers.ValidationError({"nouveau": list(erreur.messages)})
        return donnees


class InscriptionSerializer(serializers.ModelSerializer):
    """Création d'un compte à partir du formulaire d'inscription."""

    prenom = serializers.CharField(source="first_name", max_length=150)
    nom = serializers.CharField(source="last_name", max_length=150)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Utilisateur
        fields = ["username", "email", "prenom", "nom", "profil", "niveau", "password"]
        # Le contrôle « déjà pris » de Django est remplacé par validate_username / validate_email :
        # leurs messages sont plus clairs et ils ignorent les majuscules.
        # La contrainte d'unicité reste dans la base de données.
        extra_kwargs = {
            "niveau": {"required": False},
            "username": {"validators": [UnicodeUsernameValidator()]},
            "email": {"validators": []},
        }

    def validate_username(self, valeur):
        if Utilisateur.objects.filter(username__iexact=valeur).exists():
            raise serializers.ValidationError("Ce nom d’utilisateur est déjà pris.")
        return valeur

    def validate_email(self, valeur):
        valeur = valeur.lower()
        if Utilisateur.objects.filter(email__iexact=valeur).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse email.")
        return valeur

    def validate(self, donnees):
        # Le niveau est obligatoire pour un étudiant, et vide pour les autres profils.
        if donnees.get("profil") == Utilisateur.Profil.ETUDIANT:
            if not donnees.get("niveau"):
                raise serializers.ValidationError({"niveau": "Choisissez votre niveau."})
        else:
            donnees["niveau"] = ""

        # Règles de sécurité de Django (longueur, mot de passe trop courant, etc.)
        utilisateur = Utilisateur(
            username=donnees.get("username"),
            email=donnees.get("email"),
            first_name=donnees.get("first_name"),
            last_name=donnees.get("last_name"),
        )
        try:
            validate_password(donnees["password"], user=utilisateur)
        except Exception as erreur:
            raise serializers.ValidationError({"password": list(erreur.messages)})
        return donnees

    def create(self, donnees):
        # create_user chiffre le mot de passe : il n'est jamais stocké en clair.
        return Utilisateur.objects.create_user(**donnees)


class ConnexionSerializer(serializers.Serializer):
    """Connexion avec le nom d'utilisateur OU l'adresse email."""

    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, donnees):
        identifiant = donnees["identifier"].strip()

        # Si l'utilisateur a saisi un email, on retrouve le nom d'utilisateur correspondant.
        compte = Utilisateur.objects.filter(email__iexact=identifiant).first()
        username = compte.username if compte else identifiant

        utilisateur = authenticate(
            request=self.context.get("request"),
            username=username,
            password=donnees["password"],
        )
        if utilisateur is None:
            raise serializers.ValidationError("Identifiants incorrects.")

        donnees["utilisateur"] = utilisateur
        return donnees


class DemandeReinitialisationSerializer(serializers.Serializer):
    """« Mot de passe oublié » : l'adresse email du compte."""

    email = serializers.EmailField(error_messages={
        "required": "Indiquez votre adresse email.",
        "blank": "Indiquez votre adresse email.",
        "invalid": "Adresse email invalide.",
    })


class ReinitialisationSerializer(serializers.Serializer):
    """Lien reçu par email (uid + jeton) et nouveau mot de passe."""

    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, required=False)

    LIEN_INVALIDE = "Ce lien n’est plus valide. Il a peut-être déjà servi ou a expiré (1 heure). Refaites une demande."

    def validate(self, donnees):
        try:
            identifiant = force_str(urlsafe_base64_decode(donnees["uid"]))
            utilisateur = Utilisateur.objects.get(pk=identifiant, is_active=True)
        except (TypeError, ValueError, OverflowError, Utilisateur.DoesNotExist):
            raise serializers.ValidationError(self.LIEN_INVALIDE)

        # Le jeton change dès que le mot de passe change : un lien ne sert qu'une fois.
        if not default_token_generator.check_token(utilisateur, donnees["token"]):
            raise serializers.ValidationError(self.LIEN_INVALIDE)

        if "password" in donnees:
            try:
                validate_password(donnees["password"], user=utilisateur)
            except Exception as erreur:
                raise serializers.ValidationError({"password": list(erreur.messages)})

        donnees["utilisateur"] = utilisateur
        return donnees
