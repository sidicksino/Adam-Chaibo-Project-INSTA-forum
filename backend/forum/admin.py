from django.contrib import admin

from .models import Categorie, Notification, Question, Reponse, Tag


@admin.register(Categorie)
class CategorieAdmin(admin.ModelAdmin):
    list_display = ["nom", "couleur"]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    search_fields = ["nom"]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["titre", "auteur", "categorie", "date_creation", "votes", "resolue"]
    list_filter = ["categorie", "resolue"]
    search_fields = ["titre", "description"]
    filter_horizontal = ["tags"]


@admin.register(Reponse)
class ReponseAdmin(admin.ModelAdmin):
    list_display = ["question", "auteur", "date_creation", "votes", "acceptee"]
    list_filter = ["acceptee"]
    search_fields = ["contenu"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["destinataire", "type", "acteur", "question", "lue", "date"]
    list_filter = ["type", "lue"]
