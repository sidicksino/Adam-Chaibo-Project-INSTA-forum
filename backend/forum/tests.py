from io import StringIO

from django.core.management import call_command
from django.db.models import F
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from comptes.models import Utilisateur

from .models import Categorie, Notification, Question, Reponse, Tag


class BaseForum(APITestCase):

    def setUp(self):
        self.awa = self.membre("awa")
        self.ali = self.membre("ali")
        self.moussa = self.membre("moussa")
        self.categorie = Categorie.objects.get(nom="Programmation")

    @staticmethod
    def membre(nom):
        return Utilisateur.objects.create_user(
            username=nom, email=f"{nom}@insta.td", password="Forum-Test-2026",
            first_name=nom.capitalize(), last_name="Test", profil="etudiant", niveau="L2",
        )

    @staticmethod
    def client_de(utilisateur=None):
        client = APIClient()
        if utilisateur:
            client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.get_or_create(user=utilisateur)[0].key}")
        return client

    def poser(self, auteur=None, **champs):
        donnees = {"titre": "Question de test assez longue", "description": "Une description suffisamment longue.",
                   "categorie_id": self.categorie.id}
        donnees.update(champs)
        reponse = self.client_de(auteur or self.awa).post("/api/questions/", donnees, format="json")
        self.assertEqual(reponse.status_code, 201, reponse.data)
        return reponse.data["id"]

    def repondre(self, question_id, auteur, contenu="Une réponse suffisamment longue."):
        reponse = self.client_de(auteur).post(f"/api/questions/{question_id}/reponses/", {"contenu": contenu}, format="json")
        self.assertEqual(reponse.status_code, 201, reponse.data)
        return reponse.data["id"]


class QuestionsTests(BaseForum):
    def test_publier_exige_d_etre_connecte(self):
        reponse = self.client_de().post("/api/questions/", {"titre": "x"}, format="json")
        self.assertEqual(reponse.status_code, 401)

    def test_validation_en_francais(self):
        reponse = self.client_de(self.awa).post(
            "/api/questions/", {"titre": "court", "description": "trop court", "tags": ["a"] * 6}, format="json"
        )
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.data["titre"], ["Le titre doit contenir au moins 10 caractères."])
        self.assertEqual(reponse.data["description"], ["La description doit contenir au moins 20 caractères."])
        self.assertEqual(reponse.data["categorie_id"], ["Choisissez une catégorie."])
        self.assertEqual(reponse.data["tags"], ["Pas plus de 5 tags par question."])

    def test_plus_recentes_en_premier(self):
        ancienne, recente = self.poser(), self.poser()
        Question.objects.filter(pk=ancienne).update(date_creation=Question.objects.get(pk=recente).date_creation.replace(year=2025))
        self.repondre(ancienne, self.ali)
        ids = [q["id"] for q in self.client_de().get("/api/questions/").data]
        self.assertEqual(ids, [recente, ancienne])

    def test_auteur_impose_et_tags_dedoublonnes(self):
        question_id = self.poser(tags=["React", " react ", "JavaScript", ""], auteur_id=self.ali.id)
        question = Question.objects.get(pk=question_id)
        self.assertEqual(question.auteur, self.awa)
        self.assertEqual(sorted(question.tags.values_list("nom", flat=True)), ["JavaScript", "React"])


class VuesTests(BaseForum):
    def vues(self, client):
        return client.get(f"/api/questions/{self.question_id}/").data["vues"]

    def setUp(self):
        super().setUp()
        self.question_id = self.poser()

    def test_une_vue_par_membre_et_pas_l_auteur(self):
        self.assertEqual(self.vues(self.client_de(self.awa)), 0)
        ali = self.client_de(self.ali)
        self.assertEqual([self.vues(ali) for _ in range(3)], [1, 1, 1])
        self.assertEqual(self.vues(self.client_de(self.moussa)), 2)
        self.assertEqual(self.vues(self.client_de()), 2)


class VotesTests(BaseForum):
    def setUp(self):
        super().setUp()
        self.question_id = self.poser()

    def voter(self, utilisateur, valeur, cible=None):
        cible = cible or f"questions/{self.question_id}"
        return self.client_de(utilisateur).post(f"/api/{cible}/voter/", {"valeur": valeur}, format="json")

    def test_pas_de_vote_pour_soi_meme(self):
        reponse = self.voter(self.awa, 1)
        self.assertEqual(reponse.status_code, 403)
        self.assertEqual(reponse.data["detail"], "Vous ne pouvez pas voter pour votre propre question.")

    def test_pour_contre_changer_et_annuler(self):
        self.assertEqual(self.voter(self.ali, 1).data, {"votes": 1, "mon_vote": 1})
        self.assertEqual(self.voter(self.moussa, 1).data, {"votes": 2, "mon_vote": 1})
        self.assertEqual(self.voter(self.ali, -1).data, {"votes": 0, "mon_vote": -1})
        self.assertEqual(self.voter(self.ali, -1).data, {"votes": 1, "mon_vote": 0})

    def test_valeur_invalide_et_visiteur(self):
        self.assertEqual(self.voter(self.ali, 5).status_code, 400)
        anonyme = self.client_de().post(f"/api/questions/{self.question_id}/voter/", {"valeur": 1}, format="json")
        self.assertEqual(anonyme.status_code, 401)

    def test_votes_sur_les_reponses(self):
        reponse_id = self.repondre(self.question_id, self.ali)
        self.assertEqual(self.voter(self.ali, 1, f"reponses/{reponse_id}").status_code, 403)
        self.assertEqual(self.voter(self.awa, 1, f"reponses/{reponse_id}").data["votes"], 1)


class ReponseAccepteeTests(BaseForum):
    def setUp(self):
        super().setUp()
        self.question_id = self.poser()
        self.r_ali = self.repondre(self.question_id, self.ali)
        self.r_moussa = self.repondre(self.question_id, self.moussa)

    def accepter(self, utilisateur, reponse_id):
        return self.client_de(utilisateur).post(f"/api/reponses/{reponse_id}/accepter/")

    def test_seul_l_auteur_de_la_question_accepte(self):
        reponse = self.accepter(self.ali, self.r_ali)
        self.assertEqual(reponse.status_code, 403)
        self.assertFalse(Reponse.objects.get(pk=self.r_ali).acceptee)

    def test_une_seule_reponse_acceptee_et_question_resolue(self):
        self.accepter(self.awa, self.r_ali)
        self.accepter(self.awa, self.r_moussa)
        self.assertEqual(list(Reponse.objects.filter(acceptee=True).values_list("pk", flat=True)), [self.r_moussa])
        self.assertTrue(Question.objects.get(pk=self.question_id).resolue)

        liste = self.client_de().get(f"/api/questions/{self.question_id}/reponses/").data
        self.assertEqual(liste[0]["id"], self.r_moussa)

        self.accepter(self.awa, self.r_moussa)
        self.assertFalse(Question.objects.get(pk=self.question_id).resolue)


class ModificationSuppressionTests(BaseForum):
    def setUp(self):
        super().setUp()
        self.question_id = self.poser(tags=["React", "Ancien"])
        self.reponse_id = self.repondre(self.question_id, self.ali)

    def test_seul_l_auteur_modifie_ou_supprime(self):
        ali = self.client_de(self.ali)
        self.assertEqual(ali.patch(f"/api/questions/{self.question_id}/", {"titre": "Piratage du titre"}, format="json").status_code, 403)
        self.assertEqual(ali.delete(f"/api/questions/{self.question_id}/").status_code, 403)
        awa = self.client_de(self.awa)
        self.assertEqual(awa.patch(f"/api/reponses/{self.reponse_id}/", {"contenu": "Je modifie celle d'Ali"}, format="json").status_code, 403)
        self.assertEqual(awa.delete(f"/api/reponses/{self.reponse_id}/").status_code, 403)

    def test_modifier_une_question_note_la_date_et_nettoie_les_tags(self):
        reponse = self.client_de(self.awa).patch(
            f"/api/questions/{self.question_id}/", {"titre": "Titre corrigé de la question", "tags": ["React", "Hooks"]}, format="json"
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertIsNotNone(reponse.data["date_modification"])
        self.assertEqual(sorted(reponse.data["tags"]), ["Hooks", "React"])
        self.assertFalse(Tag.objects.filter(nom="Ancien").exists())

    def test_supprimer_la_reponse_acceptee_rouvre_la_question(self):
        self.client_de(self.awa).post(f"/api/reponses/{self.reponse_id}/accepter/")
        self.assertEqual(self.client_de(self.ali).delete(f"/api/reponses/{self.reponse_id}/").status_code, 204)
        self.assertFalse(Question.objects.get(pk=self.question_id).resolue)

    def test_supprimer_la_question_supprime_ses_reponses(self):
        self.assertEqual(self.client_de(self.awa).delete(f"/api/questions/{self.question_id}/").status_code, 204)
        self.assertFalse(Reponse.objects.filter(pk=self.reponse_id).exists())


class FavorisTests(BaseForum):
    def test_favori_personnel_et_bascule(self):
        question_id = self.poser()
        ali = self.client_de(self.ali)
        self.assertEqual(ali.post(f"/api/questions/{question_id}/favori/").data, {"favori": True})
        self.assertTrue(ali.get("/api/questions/").data[0]["favori"])
        self.assertFalse(self.client_de(self.moussa).get("/api/questions/").data[0]["favori"])
        self.assertEqual(ali.post(f"/api/questions/{question_id}/favori/").data, {"favori": False})


class NotificationsTests(BaseForum):
    def notifications(self, utilisateur):
        return self.client_de(utilisateur).get("/api/notifications/").data

    def test_reponse_notifie_l_auteur_mais_pas_soi_meme(self):
        question_id = self.poser()
        self.repondre(question_id, self.awa)
        self.repondre(question_id, self.ali)
        donnees = self.notifications(self.awa)
        self.assertEqual(donnees["non_lues"], 1)
        self.assertEqual(donnees["notifications"][0]["type"], "reponse")
        self.assertEqual(donnees["notifications"][0]["acteur"]["username"], "ali")

    def test_acceptation_et_changement_d_avis(self):
        question_id = self.poser()
        r_ali, r_moussa = self.repondre(question_id, self.ali), self.repondre(question_id, self.moussa)
        awa = self.client_de(self.awa)
        awa.post(f"/api/reponses/{r_ali}/accepter/")
        self.assertEqual(self.notifications(self.ali)["notifications"][0]["type"], "acceptee")

        awa.post(f"/api/reponses/{r_moussa}/accepter/")
        self.assertEqual(self.notifications(self.ali)["notifications"], [])
        self.assertEqual(self.notifications(self.moussa)["non_lues"], 1)

    def test_ouvrir_la_question_marque_comme_lu(self):
        question_id = self.poser()
        self.repondre(question_id, self.ali)
        self.client_de(self.awa).get(f"/api/questions/{question_id}/")
        self.assertEqual(self.notifications(self.awa)["non_lues"], 0)

    def test_tout_marquer_et_chacun_les_siennes(self):
        question_id = self.poser()
        self.repondre(question_id, self.ali)
        self.repondre(question_id, self.moussa)
        notification_id = Notification.objects.filter(destinataire=self.awa).first().id

        self.client_de(self.ali).post("/api/notifications/lire/", {"id": notification_id}, format="json")
        self.assertEqual(self.notifications(self.awa)["non_lues"], 2)

        self.client_de(self.awa).post("/api/notifications/lire/", {"id": notification_id}, format="json")
        self.assertEqual(self.notifications(self.awa)["non_lues"], 1)
        self.client_de(self.awa).post("/api/notifications/lire/", {}, format="json")
        self.assertEqual(self.notifications(self.awa)["non_lues"], 0)

    def test_supprimer_la_reponse_supprime_sa_notification(self):
        question_id = self.poser()
        reponse_id = self.repondre(question_id, self.ali)
        self.client_de(self.ali).delete(f"/api/reponses/{reponse_id}/")
        self.assertEqual(self.notifications(self.awa)["notifications"], [])

    def test_visiteur_refuse(self):
        self.assertEqual(self.client_de().get("/api/notifications/").status_code, 401)


class ClassementTests(BaseForum):
    def test_bareme(self):
        question_id = self.poser()
        reponse_id = self.repondre(question_id, self.ali)
        self.client_de(self.awa).post(f"/api/reponses/{reponse_id}/accepter/")
        self.client_de(self.moussa).post(f"/api/reponses/{reponse_id}/voter/", {"valeur": 1}, format="json")

        membres = {m["username"]: m for m in self.client_de().get("/api/classement/").data["membres"]}
        self.assertEqual(membres["ali"]["points"], 5 + 15 + 1)
        self.assertEqual(membres["ali"]["rang"], 1)
        self.assertEqual(membres["awa"]["points"], 2)
        self.assertNotIn("moussa", membres)


class ProfilMembreTests(BaseForum):
    def test_profil_statistiques_et_rang(self):
        question_id = self.poser()
        reponse_id = self.repondre(question_id, self.ali)
        self.client_de(self.awa).post(f"/api/reponses/{reponse_id}/accepter/")
        self.client_de(self.moussa).post(f"/api/reponses/{reponse_id}/voter/", {"valeur": 1}, format="json")

        profil = self.client_de().get("/api/membres/ali/").data
        self.assertEqual(profil["prenom"], "Ali")
        self.assertEqual(profil["stats"], {
            "questions": 0, "reponses": 1, "acceptees": 1, "votes_recus": 1, "points": 21, "rang": 1,
        })
        self.assertEqual(profil["reponses"][0]["question"]["id"], question_id)
        self.assertTrue(profil["reponses"][0]["acceptee"])

        awa = self.client_de().get("/api/membres/awa/").data
        self.assertEqual([q["id"] for q in awa["questions"]], [question_id])
        self.assertEqual(awa["stats"]["rang"], 2)

    def test_membre_sans_activite(self):
        stats = self.client_de().get("/api/membres/moussa/").data["stats"]
        self.assertEqual((stats["points"], stats["rang"]), (0, None))

    def test_email_visible_seulement_par_soi_meme(self):
        self.assertIsNone(self.client_de().get("/api/membres/awa/").data["email"])
        self.assertIsNone(self.client_de(self.ali).get("/api/membres/awa/").data["email"])
        self.assertEqual(self.client_de(self.awa).get("/api/membres/awa/").data["email"], "awa@insta.td")

    def test_membre_inconnu(self):
        self.assertEqual(self.client_de().get("/api/membres/personne/").status_code, 404)


class DonneesDemonstrationTests(APITestCase):
    def peupler(self, *options):
        sortie = StringIO()
        call_command("peupler", *options, stdout=sortie)
        return sortie.getvalue()

    def test_ajout_sans_doublon_puis_suppression(self):
        vrai_compte = Utilisateur.objects.create_user(username="vrai", email="vrai@insta.td", password="Forum-Test-2026")

        self.assertIn("10 membres, 14 questions", self.peupler())
        self.assertIn("déjà présentes", self.peupler())
        self.assertEqual(Question.objects.count(), 14)

        for reponse in Reponse.objects.prefetch_related("liste_votes"):
            self.assertNotIn(reponse.auteur_id, [v.utilisateur_id for v in reponse.liste_votes.all()])
        self.assertFalse(Question.objects.filter(liste_vues__utilisateur=F("auteur")).exists())

        self.peupler("--supprimer")
        self.assertEqual(list(Utilisateur.objects.values_list("username", flat=True)), ["vrai"])
        self.assertEqual(Question.objects.count(), 0)
        self.assertTrue(Utilisateur.objects.filter(pk=vrai_compte.pk).exists())
