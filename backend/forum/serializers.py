from rest_framework import serializers

from .models import Categorie, CaptureQuestion, Notification, Question, Reponse, Tag


class CategorieSerializer(serializers.ModelSerializer):
    nb_questions = serializers.IntegerField(read_only=True)

    class Meta:
        model = Categorie
        fields = ["id", "nom", "couleur", "nb_questions"]


class AuteurSerializer(serializers.Serializer):
    username = serializers.CharField()
    prenom = serializers.CharField(source="first_name")
    nom = serializers.CharField(source="last_name")


class CaptureSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaptureQuestion
        fields = ["id", "image", "date_ajout"]
        read_only_fields = ["date_ajout"]


class QuestionSerializer(serializers.ModelSerializer):
    auteur = AuteurSerializer(read_only=True)
    categorie = CategorieSerializer(read_only=True)
    categorie_id = serializers.PrimaryKeyRelatedField(
        source="categorie",
        queryset=Categorie.objects.all(),
        write_only=True,
        error_messages={
            "required": "Choisissez une cat\u00e9gorie.",
            "does_not_exist": "Cette cat\u00e9gorie n\u2019existe pas.",
        },
    )
    tags = serializers.ListField(
        child=serializers.CharField(
            max_length=30,
            allow_blank=True,
            error_messages={"max_length": "Un tag ne peut pas d\u00e9passer 30 caract\u00e8res."},
        ),
        required=False,
        write_only=True,
        max_length=5,
        error_messages={"max_length": "Pas plus de 5 tags par question."},
    )
    reponses = serializers.SerializerMethodField()
    mon_vote = serializers.SerializerMethodField()
    favori = serializers.SerializerMethodField()
    captures = CaptureSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            "id", "titre", "description", "categorie", "categorie_id", "tags",
            "auteur", "difficulte", "code_extrait", "langage",
            "date_creation", "date_modification", "votes", "vues", "resolue", "reponses",
            "mon_vote", "favori", "captures",
        ]
        read_only_fields = ["date_creation", "date_modification", "votes", "vues", "resolue"]

    def get_reponses(self, question):
        return getattr(question, "nb_reponses", 0)

    def get_mon_vote(self, question):
        return self.context.get("mes_votes", {}).get(question.id, 0)

    def get_favori(self, question):
        return question.id in self.context.get("mes_favoris", set())

    def validate_titre(self, valeur):
        valeur = valeur.strip()
        if len(valeur) < 10:
            raise serializers.ValidationError("Le titre doit contenir au moins 10 caract\u00e8res.")
        return valeur

    def validate_description(self, valeur):
        valeur = valeur.strip()
        if len(valeur) < 20:
            raise serializers.ValidationError("La description doit contenir au moins 20 caract\u00e8res.")
        return valeur

    def validate_tags(self, valeurs):
        uniques = {}
        for nom in valeurs:
            nom = nom.strip()
            if nom:
                uniques.setdefault(nom.lower(), nom)
        return list(uniques.values())

    @staticmethod
    def _tags(noms):
        return [Tag.objects.filter(nom__iexact=nom).first() or Tag.objects.create(nom=nom) for nom in noms]

    def create(self, donnees):
        noms_tags = donnees.pop("tags", [])
        question = Question.objects.create(**donnees)
        question.tags.set(self._tags(noms_tags))
        return question

    def update(self, question, donnees):
        noms_tags = donnees.pop("tags", None)
        question = super().update(question, donnees)
        if noms_tags is not None:
            question.tags.set(self._tags(noms_tags))
            Tag.objects.filter(questions__isnull=True).delete()
        return question

    def to_representation(self, question):
        donnees = super().to_representation(question)
        donnees["tags"] = [tag.nom for tag in question.tags.all()]
        return donnees


class ReponseSerializer(serializers.ModelSerializer):
    auteur = AuteurSerializer(read_only=True)
    mon_vote = serializers.SerializerMethodField()

    class Meta:
        model = Reponse
        fields = ["id", "contenu", "auteur", "date_creation", "date_modification", "acceptee", "votes", "mon_vote"]
        read_only_fields = ["date_creation", "date_modification", "acceptee", "votes"]
        extra_kwargs = {
            "contenu": {"error_messages": {"blank": "\u00c9crivez votre r\u00e9ponse avant de la publier."}},
        }

    def get_mon_vote(self, reponse):
        return self.context.get("mes_votes", {}).get(reponse.id, 0)

    def validate_contenu(self, valeur):
        valeur = valeur.strip()
        if len(valeur) < 10:
            raise serializers.ValidationError("La r\u00e9ponse doit contenir au moins 10 caract\u00e8res.")
        return valeur


class VoteSerializer(serializers.Serializer):
    valeur = serializers.ChoiceField(
        choices=[1, -1],
        error_messages={"invalid_choice": "Le vote doit valoir 1 (pour) ou -1 (contre)."},
    )


class NotificationSerializer(serializers.ModelSerializer):
    acteur = AuteurSerializer(read_only=True)
    question = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "type", "acteur", "question", "lue", "date"]

    def get_question(self, notification):
        return {"id": notification.question_id, "titre": notification.question.titre}
