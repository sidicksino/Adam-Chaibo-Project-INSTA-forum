from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F, Sum
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import Categorie, Favori, Question, Reponse, VoteQuestion, VoteReponse
from .serializers import (
    AuteurSerializer, CategorieSerializer, QuestionSerializer, ReponseSerializer, VoteSerializer,
)


def mes_votes(modele_vote, champ, utilisateur, ids):
    """{id de la question ou réponse: 1 ou -1} pour les votes de l'utilisateur connecté."""
    if not utilisateur.is_authenticated:
        return {}
    votes = modele_vote.objects.filter(utilisateur=utilisateur, **{f"{champ}__in": ids})
    return dict(votes.values_list(champ, "valeur"))


def enregistrer_vote(request, cible, modele_vote, champ, nom):
    """
    Vote pour (1) ou contre (-1) une question ou une réponse.
    Revoter la même valeur retire le vote ; voter l'inverse le remplace.
    """
    if cible.auteur_id == request.user.id:
        raise PermissionDenied(f"Vous ne pouvez pas voter pour votre propre {nom}.")

    serializer = VoteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    valeur = serializer.validated_data["valeur"]

    with transaction.atomic():
        filtre = {"utilisateur": request.user, champ: cible}
        vote = modele_vote.objects.select_for_update().filter(**filtre).first()
        if vote and vote.valeur == valeur:
            vote.delete()
            mon_vote = 0
        else:
            modele_vote.objects.update_or_create(**filtre, defaults={"valeur": valeur})
            mon_vote = valeur

        # Le score est recalculé à partir de tous les votes : il reste toujours exact.
        cible.votes = modele_vote.objects.filter(**{champ: cible}).aggregate(total=Sum("valeur"))["total"] or 0
        cible.save(update_fields=["votes"])

    return Response({"votes": cible.votes, "mon_vote": mon_vote})


class CategorieViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/categories/ : liste des catégories avec leur nombre de questions."""

    serializer_class = CategorieSerializer
    queryset = Categorie.objects.annotate(nb_questions=Count("questions"))


class QuestionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET  /api/questions/                : toutes les questions, les plus récentes d'abord
    GET  /api/questions/<id>/           : une question (compte une vue de plus)
    POST /api/questions/                : publier une question (connexion obligatoire)
    GET  /api/questions/<id>/reponses/  : les réponses à une question
    POST /api/questions/<id>/reponses/  : répondre (connexion obligatoire)
    POST /api/questions/<id>/voter/     : voter pour ou contre la question
    POST /api/questions/<id>/favori/    : ajouter ou retirer la question des favoris
    """

    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    # select_related / prefetch_related : évite une requête SQL par question
    queryset = (
        Question.objects.select_related("auteur", "categorie")
        .prefetch_related("tags")
        .annotate(nb_reponses=Count("reponses"))
    )

    def get_serializer_context(self):
        contexte = super().get_serializer_context()
        utilisateur = self.request.user
        # Une seule requête pour savoir quelles questions sont dans les favoris de l'utilisateur
        contexte["mes_favoris"] = (
            set(utilisateur.favoris.values_list("question_id", flat=True))
            if utilisateur.is_authenticated else set()
        )
        return contexte

    def perform_create(self, serializer):
        # L'auteur est toujours l'utilisateur connecté, jamais une valeur envoyée par le client.
        serializer.save(auteur=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        question = self.get_object()
        # F() fait l'addition dans la base : deux visites simultanées sont bien comptées.
        Question.objects.filter(pk=question.pk).update(vues=F("vues") + 1)
        question.vues += 1
        contexte = {
            **self.get_serializer_context(),
            "mes_votes": mes_votes(VoteQuestion, "question", request.user, [question.id]),
        }
        return Response(QuestionSerializer(question, context=contexte).data)

    @action(detail=True, methods=["get", "post"])
    def reponses(self, request, pk=None):
        question = self.get_object()

        if request.method == "GET":
            reponses = list(question.reponses.select_related("auteur"))
            votes = mes_votes(VoteReponse, "reponse", request.user, [r.id for r in reponses])
            return Response(ReponseSerializer(reponses, many=True, context={"mes_votes": votes}).data)

        serializer = ReponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(question=question, auteur=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def voter(self, request, pk=None):
        return enregistrer_vote(request, self.get_object(), VoteQuestion, "question", "question")

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def favori(self, request, pk=None):
        question = self.get_object()
        favori, cree = Favori.objects.get_or_create(utilisateur=request.user, question=question)
        if not cree:
            # Elle était déjà en favori : un second clic la retire.
            favori.delete()
        return Response({"favori": cree})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def voter_reponse(request, pk):
    """POST /api/reponses/<id>/voter/ : voter pour ou contre une réponse."""
    reponse = get_object_or_404(Reponse, pk=pk)
    return enregistrer_vote(request, reponse, VoteReponse, "reponse", "réponse")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accepter_reponse(request, pk):
    """
    POST /api/reponses/<id>/accepter/ : l'auteur de la question choisit la bonne réponse.
    Un second appel sur la même réponse l'annule.
    """
    reponse = get_object_or_404(Reponse.objects.select_related("question"), pk=pk)
    question = reponse.question

    if question.auteur_id != request.user.id:
        raise PermissionDenied("Seul l’auteur de la question peut accepter une réponse.")

    nouvel_etat = not reponse.acceptee
    # transaction.atomic : tout est enregistré, ou rien en cas d'erreur.
    with transaction.atomic():
        # Une seule réponse acceptée par question
        question.reponses.update(acceptee=False)
        reponse.acceptee = nouvel_etat
        reponse.save(update_fields=["acceptee"])
        question.resolue = nouvel_etat
        question.save(update_fields=["resolue"])

    return Response(ReponseSerializer(reponse).data)


# Barème du classement (affiché aussi sur la page « Classement »)
POINTS_QUESTION = 2
POINTS_REPONSE = 5
POINTS_ACCEPTEE = 15  # en plus des points de la réponse


@api_view(["GET"])
def classement(request):
    """GET /api/classement/ : les membres classés par points."""
    Utilisateur = get_user_model()

    # Chaque total est calculé séparément : les combiner dans une seule requête
    # multiplierait les lignes (une jointure par question × une par réponse).
    def par_auteur(requete, calcul):
        return dict(requete.values_list("auteur").annotate(total=calcul))

    nb_questions = par_auteur(Question.objects.all(), Count("id"))
    nb_reponses = par_auteur(Reponse.objects.all(), Count("id"))
    nb_acceptees = par_auteur(Reponse.objects.filter(acceptee=True), Count("id"))
    votes_questions = par_auteur(Question.objects.all(), Sum("votes"))
    votes_reponses = par_auteur(Reponse.objects.all(), Sum("votes"))

    lignes = []
    for membre in Utilisateur.objects.filter(pk__in={*nb_questions, *nb_reponses}):
        q = nb_questions.get(membre.id, 0)
        r = nb_reponses.get(membre.id, 0)
        a = nb_acceptees.get(membre.id, 0)
        v = votes_questions.get(membre.id, 0) + votes_reponses.get(membre.id, 0)
        lignes.append({
            **AuteurSerializer(membre).data,
            "questions": q,
            "reponses": r,
            "acceptees": a,
            "votes_recus": v,
            "points": q * POINTS_QUESTION + r * POINTS_REPONSE + a * POINTS_ACCEPTEE + v,
        })

    lignes.sort(key=lambda m: (-m["points"], m["username"]))
    for rang, ligne in enumerate(lignes, start=1):
        ligne["rang"] = rang

    return Response({
        "bareme": {
            "question": POINTS_QUESTION,
            "reponse": POINTS_REPONSE,
            "acceptee": POINTS_ACCEPTEE,
        },
        "membres": lignes[:50],
    })


@api_view(["GET"])
def statistiques(request):
    """GET /api/statistiques/ : chiffres affichés sur la page d'accueil."""
    Utilisateur = get_user_model()
    contributeurs = (
        Utilisateur.objects.annotate(nb_reponses=Count("reponses"))
        .filter(nb_reponses__gt=0)
        .order_by("-nb_reponses", "username")[:3]
    )
    return Response({
        "questions": Question.objects.count(),
        "reponses": Reponse.objects.count(),
        "membres": Utilisateur.objects.count(),
        "contributeurs": [
            {**AuteurSerializer(u).data, "nb_reponses": u.nb_reponses} for u in contributeurs
        ],
    })
