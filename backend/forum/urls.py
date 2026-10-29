from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

routeur = DefaultRouter()
routeur.register("categories", views.CategorieViewSet, basename="categorie")
routeur.register("questions", views.QuestionViewSet, basename="question")

urlpatterns = [
    path("", include(routeur.urls)),
    path("reponses/<int:pk>/", views.reponse_detail, name="reponse-detail"),
    path("reponses/<int:pk>/accepter/", views.accepter_reponse, name="accepter-reponse"),
    path("reponses/<int:pk>/voter/", views.voter_reponse, name="voter-reponse"),
    path("notifications/", views.notifications, name="notifications"),
    path("notifications/lire/", views.lire_notifications, name="lire-notifications"),
    path("membres/<str:username>/", views.membre, name="membre"),
    path("classement/", views.classement, name="classement"),
    path("statistiques/", views.statistiques, name="statistiques"),
]
