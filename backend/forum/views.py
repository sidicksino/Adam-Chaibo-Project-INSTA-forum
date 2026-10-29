from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import (
    Categorie, CaptureQuestion, Favori, Notification, Question, Reponse, Tag, VoteQuestion, VoteReponse, VueQuestion,
)
from .serializers import (
    AuteurSerializer, CaptureSerializer, CategorieSerializer, NotificationSerializer, QuestionSerializer,
    ReponseSerializer, VoteSerializer,
)


def verifier_auteur(request, objet, action):
    if objet.auteur_id != request.user.id:
        raise PermissionDenied(f"Seul l’auteur peut {action}.")


def mes_votes(modele_vote, champ, utilisateur, ids):
    if not utilisateur.is_authenticated:
        return {}
    votes = modele_vote.objects.filter(utilisateur=utilisateur, **{f"{champ}__in": ids})
    return dict(votes.values_list(champ, "valeur"))


def enregistrer_vote(request, cible, modele_vote, champ, nom):
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

        cible.votes = modele_vote.objects.filter(**{champ: cible}).aggregate(total=Sum("valeur"))["total"] or 0
        cible.save(update_fields=["votes"])

    return Response({"votes": cible.votes, "mon_vote": mon_vote})


class CategorieViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = CategorieSerializer
    queryset = Categorie.objects.annotate(nb_questions=Count("questions")).order_by("nom")


class QuestionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):

    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = (
        Question.objects.select_related("auteur", "categorie")
        .prefetch_related("tags", "captures")
        .annotate(nb_reponses=Count("reponses"))
        .order_by("-date_creation")
    )

    def get_serializer_context(self):
        contexte = super().get_serializer_context()
        utilisateur = self.request.user
        contexte["mes_favoris"] = (
            set(utilisateur.favoris.values_list("question_id", flat=True))
            if utilisateur.is_authenticated else set()
        )
        return contexte

    def perform_create(self, serializer):
        serializer.save(auteur=self.request.user)

    def perform_update(self, serializer):
        verifier_auteur(self.request, serializer.instance, "modifier cette question")
        serializer.save(date_modification=timezone.now())

    def perform_destroy(self, question):
        verifier_auteur(self.request, question, "supprimer cette question")
        question.delete()
        Tag.objects.filter(questions__isnull=True).delete()

    def retrieve(self, request, *args, **kwargs):
        question = self.get_object()
        utilisateur = request.user
        if utilisateur.is_authenticated and utilisateur.id != question.auteur_id:
            _, nouvelle = VueQuestion.objects.get_or_create(utilisateur=utilisateur, question=question)
            if nouvelle:
                Question.objects.filter(pk=question.pk).update(vues=F("vues") + 1)
                question.vues += 1
        if utilisateur.is_authenticated:
            Notification.objects.filter(destinataire=utilisateur, question=question, lue=False).update(lue=True)
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
        reponse = serializer.save(question=question, auteur=request.user)
        if question.auteur_id != request.user.id:
            Notification.objects.create(
                destinataire_id=question.auteur_id, acteur=request.user,
                type=Notification.Type.REPONSE, question=question, reponse=reponse,
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def voter(self, request, pk=None):
        return enregistrer_vote(request, self.get_object(), VoteQuestion, "question", "question")

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def favori(self, request, pk=None):
        question = self.get_object()
        favori, cree = Favori.objects.get_or_create(utilisateur=request.user, question=question)
        if not cree:
            favori.delete()
        return Response({"favori": cree})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def captures(self, request, pk=None):
        question = self.get_object()
        verifier_auteur(request, question, "ajouter des captures à cette question")
        fichiers = request.FILES.getlist("images")
        if not fichiers:
            return Response({"detail": "Aucun fichier envoyé."}, status=status.HTTP_400_BAD_REQUEST)
        nouvelles = []
        for f in fichiers:
            if not f.content_type.startswith("image/"):
                continue
            capture = CaptureQuestion.objects.create(question=question, image=f)
            nouvelles.append(capture)
        return Response(CaptureSerializer(nouvelles, many=True).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def voter_reponse(request, pk):
    reponse = get_object_or_404(Reponse, pk=pk)
    return enregistrer_vote(request, reponse, VoteReponse, "reponse", "réponse")


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def reponse_detail(request, pk):
    reponse = get_object_or_404(Reponse.objects.select_related("question", "auteur"), pk=pk)

    if request.method == "DELETE":
        verifier_auteur(request, reponse, "supprimer cette réponse")
        with transaction.atomic():
            if reponse.acceptee:
                reponse.question.resolue = False
                reponse.question.save(update_fields=["resolue"])
            reponse.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    verifier_auteur(request, reponse, "modifier cette réponse")
    serializer = ReponseSerializer(reponse, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save(date_modification=timezone.now())
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accepter_reponse(request, pk):
    reponse = get_object_or_404(Reponse.objects.select_related("question"), pk=pk)
    question = reponse.question

    if question.auteur_id != request.user.id:
        raise PermissionDenied("Seul l’auteur de la question peut accepter une réponse.")

    nouvel_etat = not reponse.acceptee
    with transaction.atomic():
        question.reponses.update(acceptee=False)
        reponse.acceptee = nouvel_etat
        reponse.save(update_fields=["acceptee"])
        question.resolue = nouvel_etat
        question.save(update_fields=["resolue"])

        Notification.objects.filter(question=question, type=Notification.Type.ACCEPTEE).delete()
        if nouvel_etat and reponse.auteur_id != request.user.id:
            Notification.objects.create(
                destinataire_id=reponse.auteur_id, acteur=request.user,
                type=Notification.Type.ACCEPTEE, question=question, reponse=reponse,
            )

    return Response(ReponseSerializer(reponse).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications(request):
    mes_notifications = Notification.objects.filter(destinataire=request.user)
    recentes = mes_notifications.select_related("acteur", "question")[:30]
    return Response({
        "non_lues": mes_notifications.filter(lue=False).count(),
        "notifications": NotificationSerializer(recentes, many=True).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def lire_notifications(request):
    a_marquer = Notification.objects.filter(destinataire=request.user, lue=False)
    if request.data.get("id") is not None:
        a_marquer = a_marquer.filter(pk=request.data["id"])
    a_marquer.update(lue=True)
    return Response(status=status.HTTP_204_NO_CONTENT)


POINTS_QUESTION = 2
POINTS_REPONSE = 5
POINTS_ACCEPTEE = 15


def calculer_classement():
    Utilisateur = get_user_model()

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
    return lignes


@api_view(["GET"])
def classement(request):
    lignes = calculer_classement()
    return Response({
        "bareme": {
            "question": POINTS_QUESTION,
            "reponse": POINTS_REPONSE,
            "acceptee": POINTS_ACCEPTEE,
        },
        "membres": lignes[:50],
    })


@api_view(["GET"])
def membre(request, username):
    Utilisateur = get_user_model()
    personne = get_object_or_404(Utilisateur, username=username, is_active=True)

    ligne = next((m for m in calculer_classement() if m["username"] == personne.username), None)
    questions = (
        Question.objects.filter(auteur=personne).select_related("categorie")
        .annotate(nb_reponses=Count("reponses")).order_by("-date_creation")[:50]
    )
    reponses = Reponse.objects.filter(auteur=personne).select_related("question").order_by("-date_creation")[:50]

    return Response({
        **AuteurSerializer(personne).data,
        "profil": personne.profil,
        "niveau": personne.niveau,
        "date_inscription": personne.date_joined,
        "email": personne.email if request.user == personne else None,
        "stats": {
            "questions": ligne["questions"] if ligne else 0,
            "reponses": ligne["reponses"] if ligne else 0,
            "acceptees": ligne["acceptees"] if ligne else 0,
            "votes_recus": ligne["votes_recus"] if ligne else 0,
            "points": ligne["points"] if ligne else 0,
            "rang": ligne["rang"] if ligne else None,
        },
        "questions": [
            {
                "id": q.id, "titre": q.titre, "date_creation": q.date_creation, "votes": q.votes,
                "reponses": q.nb_reponses, "resolue": q.resolue,
                "categorie": {"nom": q.categorie.nom, "couleur": q.categorie.couleur},
            }
            for q in questions
        ],
        "reponses": [
            {
                "id": r.id, "extrait": r.contenu[:160], "date_creation": r.date_creation, "votes": r.votes,
                "acceptee": r.acceptee, "question": {"id": r.question_id, "titre": r.question.titre},
            }
            for r in reponses
        ],
    })


@api_view(["GET"])
def statistiques(request):
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
