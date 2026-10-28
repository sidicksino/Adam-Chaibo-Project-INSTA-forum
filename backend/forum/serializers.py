from rest_framework import serializers

from .models import Categorie, Question, Reponse, Tag


class CategorieSerializer(serializers.ModelSerializer):
    # Nombre de questions dans la catégorie (calculé dans la vue)
    nb_questions = serializers.IntegerField(read_only=True)

    class Meta:
        model = Categorie
        fields = ["id", "nom", "couleur", "nb_questions"]


class AuteurSerializer(serializers.Serializer):
    username = serializers.CharField()
    prenom = serializers.CharField(source="first_name")
    nom = serializers.CharField(source="last_name")


class QuestionSerializer(serializers.ModelSerializer):
    auteur = AuteurSerializer(read_only=True)
    # Lecture : la catégorie complète ; écriture : seulement son identifiant
    categorie = CategorieSerializer(read_only=True)
    categorie_id = serializers.PrimaryKeyRelatedField(
        source="categorie",
        queryset=Categorie.objects.all(),
        write_only=True,
        error_messages={
            "required": "Choisissez une catégorie.",
            "does_not_exist": "Cette catégorie n’existe pas.",
        },
    )
    # Écriture : une liste de noms ; la lecture est gérée dans to_representation
    tags = serializers.ListField(
        child=serializers.CharField(max_length=30, allow_blank=True),
        required=False,
        write_only=True,
        max_length=5,
        error_messages={"max_length": "Pas plus de 5 tags par question."},
    )
    reponses = serializers.SerializerMethodField()
    mon_vote = serializers.SerializerMethodField()
    favori = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            "id", "titre", "description", "categorie", "categorie_id", "tags",
            "auteur", "date_creation", "votes", "vues", "resolue", "reponses", "mon_vote", "favori",
        ]
        read_only_fields = ["date_creation", "votes", "vues", "resolue"]

    def get_reponses(self, question):
        # nb_reponses est calculé dans la vue ; une question qui vient d'être créée n'en a aucune.
        return getattr(question, "nb_reponses", 0)

    def get_mon_vote(self, question):
        # 1, -1 ou 0 : fourni par la vue dans le contexte (absent de la liste d'accueil)
        return self.context.get("mes_votes", {}).get(question.id, 0)

    def get_favori(self, question):
        # Ensemble des questions favorites de l'utilisateur connecté, fourni par la vue
        return question.id in self.context.get("mes_favoris", set())

    def validate_titre(self, valeur):
        valeur = valeur.strip()
        if len(valeur) < 10:
            raise serializers.ValidationError("Le titre doit contenir au moins 10 caractères.")
        return valeur

    def validate_description(self, valeur):
        valeur = valeur.strip()
        if len(valeur) < 20:
            raise serializers.ValidationError("La description doit contenir au moins 20 caractères.")
        return valeur

    def validate_tags(self, valeurs):
        # Supprime les espaces et les doublons (sans tenir compte des majuscules)
        uniques = {}
        for nom in valeurs:
            nom = nom.strip()
            if nom:
                uniques.setdefault(nom.lower(), nom)
        return list(uniques.values())

    def create(self, donnees):
        noms_tags = donnees.pop("tags", [])
        question = Question.objects.create(**donnees)
        for nom in noms_tags:
            # Réutilise un tag existant (« react » et « React » sont le même tag)
            tag = Tag.objects.filter(nom__iexact=nom).first() or Tag.objects.create(nom=nom)
            question.tags.add(tag)
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
        fields = ["id", "contenu", "auteur", "date_creation", "acceptee", "votes", "mon_vote"]
        read_only_fields = ["date_creation", "acceptee", "votes"]
        extra_kwargs = {
            "contenu": {"error_messages": {"blank": "Écrivez votre réponse avant de la publier."}},
        }

    def get_mon_vote(self, reponse):
        return self.context.get("mes_votes", {}).get(reponse.id, 0)

    def validate_contenu(self, valeur):
        valeur = valeur.strip()
        if len(valeur) < 10:
            raise serializers.ValidationError("La réponse doit contenir au moins 10 caractères.")
        return valeur


class VoteSerializer(serializers.Serializer):
    valeur = serializers.ChoiceField(
        choices=[1, -1],
        error_messages={"invalid_choice": "Le vote doit valoir 1 (pour) ou -1 (contre)."},
    )
