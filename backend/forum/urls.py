from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

# Le routeur crée automatiquement les adresses /questions/ et /questions/<id>/
routeur = DefaultRouter()
routeur.register("categories", views.CategorieViewSet, basename="categorie")
routeur.register("questions", views.QuestionViewSet, basename="question")

urlpatterns = [
    path("", include(routeur.urls)),
    path("reponses/<int:pk>/", views.reponse_detail, name="reponse-detail"),
    path("reponses/<int:pk>/accepter/", views.accepter_reponse, name="accepter-reponse"),
    path("reponses/<int:pk>/voter/", views.voter_reponse, name="voter-reponse"),
    path("classement/", views.classement, name="classement"),
    path("statistiques/", views.statistiques, name="statistiques"),
]
