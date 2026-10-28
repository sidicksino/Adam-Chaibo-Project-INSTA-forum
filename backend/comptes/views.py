from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .serializers import ConnexionSerializer, InscriptionSerializer, UtilisateurSerializer


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def moi(request):
    """GET /api/comptes/moi/ : renvoie l'utilisateur correspondant au jeton."""
    return Response(UtilisateurSerializer(request.user).data)
