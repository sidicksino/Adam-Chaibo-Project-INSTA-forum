"""
Tests des comptes : inscription, connexion, déconnexion, mot de passe oublié.
Lancer :  python manage.py test
(Django crée une base de données temporaire : vos vraies données ne sont jamais touchées.)
"""

import re

from django.core import mail
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Utilisateur

MOT_DE_PASSE = "Forum-Test-2026"


def inscription(**champs):
    donnees = {
        "prenom": "Awa", "nom": "Diallo", "username": "awa", "email": "awa@insta.td",
        "profil": "etudiant", "niveau": "L2", "password": MOT_DE_PASSE,
    }
    donnees.update(champs)
    return donnees


class InscriptionTests(APITestCase):
    url = "/api/comptes/inscription/"

    def test_inscription_reussie(self):
        reponse = self.client.post(self.url, inscription(), format="json")
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data["prenom"], "Awa")
        self.assertNotIn("password", reponse.data)
        # Le mot de passe est chiffré, jamais stocké en clair
        utilisateur = Utilisateur.objects.get(username="awa")
        self.assertNotEqual(utilisateur.password, MOT_DE_PASSE)
        self.assertTrue(utilisateur.check_password(MOT_DE_PASSE))

    def test_nom_utilisateur_et_email_deja_pris_sans_tenir_compte_des_majuscules(self):
        self.client.post(self.url, inscription(), format="json")
        reponse = self.client.post(self.url, inscription(username="AWA", email="AWA@insta.td"), format="json")
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("username", reponse.data)
        self.assertIn("email", reponse.data)

    def test_niveau_obligatoire_pour_un_etudiant(self):
        reponse = self.client.post(self.url, inscription(niveau=""), format="json")
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.data["niveau"], ["Choisissez votre niveau."])

    def test_niveau_ignore_pour_un_enseignant(self):
        reponse = self.client.post(self.url, inscription(profil="enseignant", niveau="L1"), format="json")
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.data["niveau"], "")

    def test_mot_de_passe_trop_faible_refuse_en_francais(self):
        reponse = self.client.post(self.url, inscription(password="12345678"), format="json")
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("Ce mot de passe est trop courant.", reponse.data["password"])


class ConnexionTests(APITestCase):
    def setUp(self):
        self.client.post("/api/comptes/inscription/", inscription(), format="json")

    def connecter(self, identifiant, mot_de_passe=MOT_DE_PASSE):
        return self.client.post(
            "/api/comptes/connexion/", {"identifier": identifiant, "password": mot_de_passe}, format="json"
        )

    def test_connexion_avec_nom_utilisateur_ou_email(self):
        for identifiant in ["awa", "awa@insta.td", "AWA@INSTA.TD"]:
            with self.subTest(identifiant=identifiant):
                reponse = self.connecter(identifiant)
                self.assertEqual(reponse.status_code, 200)
                self.assertIn("token", reponse.data)
                self.assertEqual(reponse.data["utilisateur"]["username"], "awa")

    def test_mauvais_mot_de_passe(self):
        reponse = self.connecter("awa", "pas-le-bon")
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.data["non_field_errors"], ["Identifiants incorrects."])

    def test_moi_puis_deconnexion_invalide_le_jeton(self):
        jeton = self.connecter("awa").data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {jeton}")
        self.assertEqual(self.client.get("/api/comptes/moi/").data["username"], "awa")

        self.assertEqual(self.client.post("/api/comptes/deconnexion/").status_code, 204)
        self.assertEqual(self.client.get("/api/comptes/moi/").status_code, 401)


class MotDePasseOublieTests(APITestCase):
    def setUp(self):
        self.utilisateur = Utilisateur.objects.create_user(
            username="awa", email="awa@insta.td", password=MOT_DE_PASSE, first_name="Awa", profil="etudiant", niveau="L2"
        )

    def demander(self, email="awa@insta.td"):
        return self.client.post("/api/comptes/mot-de-passe-oublie/", {"email": email}, format="json")

    def lien_recu(self):
        """uid et jeton extraits du lien contenu dans le dernier email envoyé."""
        uid, jeton = re.search(r"#/reinitialiser/([\w-]+)/([\w-]+)", mail.outbox[-1].body).groups()
        return uid, jeton

    def test_email_envoye_avec_le_lien(self):
        reponse = self.demander()
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["awa@insta.td"])
        self.assertIn("Bonjour Awa", mail.outbox[0].body)
        self.assertIn("http://localhost:5173/#/reinitialiser/", mail.outbox[0].body)

    def test_adresse_inconnue_meme_reponse_et_aucun_email(self):
        # Impossible de deviner si une adresse a un compte
        connue, inconnue = self.demander(), self.demander("personne@insta.td")
        self.assertEqual(connue.data, inconnue.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_reinitialisation_complete(self):
        ancien_jeton = Token.objects.create(user=self.utilisateur)
        self.demander()
        uid, jeton = self.lien_recu()

        verification = self.client.post("/api/comptes/reinitialiser/verifier/", {"uid": uid, "token": jeton}, format="json")
        self.assertEqual(verification.data, {"valide": True, "email": "awa@insta.td"})

        reponse = self.client.post(
            "/api/comptes/reinitialiser/", {"uid": uid, "token": jeton, "password": "Nouveau-Mot-2026"}, format="json"
        )
        self.assertEqual(reponse.status_code, 200)
        self.utilisateur.refresh_from_db()
        self.assertTrue(self.utilisateur.check_password("Nouveau-Mot-2026"))
        # Les anciennes sessions sont fermées
        self.assertFalse(Token.objects.filter(key=ancien_jeton.key).exists())

        # Le lien ne sert qu'une fois
        deuxieme = self.client.post(
            "/api/comptes/reinitialiser/", {"uid": uid, "token": jeton, "password": "Encore-Autre-2026"}, format="json"
        )
        self.assertEqual(deuxieme.status_code, 400)
        self.assertIn("Ce lien n’est plus valide", str(deuxieme.data))

    def test_lien_invente_refuse(self):
        reponse = self.client.post(
            "/api/comptes/reinitialiser/verifier/", {"uid": "MQ", "token": "faux-jeton"}, format="json"
        )
        self.assertEqual(reponse.status_code, 400)

    def test_nouveau_mot_de_passe_trop_faible_refuse(self):
        self.demander()
        uid, jeton = self.lien_recu()
        reponse = self.client.post(
            "/api/comptes/reinitialiser/", {"uid": uid, "token": jeton, "password": "12345678"}, format="json"
        )
        self.assertEqual(reponse.status_code, 400)
        self.utilisateur.refresh_from_db()
        self.assertTrue(self.utilisateur.check_password(MOT_DE_PASSE))
