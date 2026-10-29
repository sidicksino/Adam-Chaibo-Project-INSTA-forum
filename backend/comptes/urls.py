from django.urls import path

from . import views

urlpatterns = [
    path("inscription/", views.inscription, name="inscription"),
    path("connexion/", views.connexion, name="connexion"),
    path("deconnexion/", views.deconnexion, name="deconnexion"),
    path("moi/", views.moi, name="moi"),
    path("mot-de-passe/", views.changer_mot_de_passe, name="changer-mot-de-passe"),
    path("mot-de-passe-oublie/", views.mot_de_passe_oublie, name="mot-de-passe-oublie"),
    path("reinitialiser/", views.reinitialiser, name="reinitialiser"),
    path("reinitialiser/verifier/", views.verifier_lien, name="verifier-lien"),
]
