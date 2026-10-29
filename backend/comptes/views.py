import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Utilisateur
from .serializers import (
    ChangementMotDePasseSerializer, ConnexionSerializer, DemandeReinitialisationSerializer, InscriptionSerializer,
    ModificationProfilSerializer, ReinitialisationSerializer, UtilisateurSerializer,
)

journal = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([AllowAny])
def inscription(request):
    """POST /api/comptes/inscription/ : crée un nouveau compte."""
    serializer = InscriptionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    utilisateur = serializer.save()
    return Response(UtilisateurSerializer(utilisateur).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def connexion(request):
    """POST /api/comptes/connexion/ : renvoie un jeton et l'utilisateur connecté."""
    serializer = ConnexionSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    utilisateur = serializer.validated_data["utilisateur"]
    jeton, _ = Token.objects.get_or_create(user=utilisateur)
    return Response({"token": jeton.key, "utilisateur": UtilisateurSerializer(utilisateur).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def deconnexion(request):
    """POST /api/comptes/deconnexion/ : supprime le jeton de l'utilisateur."""
    request.auth.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def moi(request):
    """
    GET   /api/comptes/moi/ : l'utilisateur correspondant au jeton
    PATCH /api/comptes/moi/ : modifier son nom, prénom, profil ou niveau
    """
    if request.method == "PATCH":
        serializer = ModificationProfilSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(UtilisateurSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def changer_mot_de_passe(request):
    """
    POST /api/comptes/mot-de-passe/ : {"ancien": …, "nouveau": …}
    Les autres appareils sont déconnectés ; un nouveau jeton est renvoyé pour celui-ci.
    """
    serializer = ChangementMotDePasseSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    utilisateur = request.user
    utilisateur.set_password(serializer.validated_data["nouveau"])
    utilisateur.save(update_fields=["password"])
    Token.objects.filter(user=utilisateur).delete()
    jeton = Token.objects.create(user=utilisateur)
    return Response({"token": jeton.key, "detail": "Mot de passe modifié."})


MESSAGE_ENVOYE = (
    "Si un compte existe avec cette adresse, un email vient d’être envoyé avec un lien "
    "pour choisir un nouveau mot de passe. Pensez à regarder dans les spams."
)


@api_view(["POST"])
@permission_classes([AllowAny])
def mot_de_passe_oublie(request):
    """
    POST /api/comptes/mot-de-passe-oublie/ : envoie le lien de réinitialisation par email.
    La réponse est la même que l'adresse existe ou non : impossible de deviner qui est inscrit.
    """
    serializer = DemandeReinitialisationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    utilisateur = Utilisateur.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True).first()

    if utilisateur:
        uid = urlsafe_base64_encode(force_bytes(utilisateur.pk))
        jeton = default_token_generator.make_token(utilisateur)
        lien = f"{settings.FRONTEND_URL}/#/reinitialiser/{uid}/{jeton}"
        prenom = utilisateur.first_name or utilisateur.username
        try:
            send_mail(
                subject="INSTA-FORUM : réinitialisation de votre mot de passe",
                message=(
                    f"Bonjour {prenom},\n\n"
                    "Vous avez demandé à changer le mot de passe de votre compte INSTA-FORUM.\n"
                    f"Cliquez sur ce lien pour en choisir un nouveau (valable 1 heure) :\n\n{lien}\n\n"
                    "Si vous n’êtes pas à l’origine de cette demande, ignorez cet email : "
                    "votre mot de passe actuel reste valable.\n\nL’équipe INSTA-FORUM"
                ),
                from_email=None,  # DEFAULT_FROM_EMAIL
                recipient_list=[utilisateur.email],
            )
        except Exception:
            journal.exception("Échec de l’envoi de l’email de réinitialisation")
            return Response(
                {"detail": "Impossible d’envoyer l’email pour le moment. Réessayez dans quelques minutes."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    return Response({"detail": MESSAGE_ENVOYE})


@api_view(["POST"])
@permission_classes([AllowAny])
def verifier_lien(request):
    """POST /api/comptes/reinitialiser/verifier/ : le lien reçu par email est-il encore valable ?"""
    serializer = ReinitialisationSerializer(data={k: v for k, v in request.data.items() if k != "password"})
    serializer.is_valid(raise_exception=True)
    return Response({"valide": True, "email": serializer.validated_data["utilisateur"].email})


@api_view(["POST"])
@permission_classes([AllowAny])
def reinitialiser(request):
    """POST /api/comptes/reinitialiser/ : enregistre le nouveau mot de passe."""
    if not request.data.get("password"):
        return Response({"password": ["Choisissez un nouveau mot de passe."]}, status=status.HTTP_400_BAD_REQUEST)
    serializer = ReinitialisationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    utilisateur = serializer.validated_data["utilisateur"]
    utilisateur.set_password(serializer.validated_data["password"])
    utilisateur.save(update_fields=["password"])
    # Déconnecte tous les appareils qui utilisaient l'ancien mot de passe
    Token.objects.filter(user=utilisateur).delete()
    return Response({"detail": "Mot de passe modifié. Vous pouvez maintenant vous connecter."})
