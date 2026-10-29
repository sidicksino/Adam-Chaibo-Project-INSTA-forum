
import { useEffect, useRef, useState } from "react";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import HomePage from "./pages/HomePage";
import AskQuestionPage from "./pages/AskQuestionPage";
import QuestionPage from "./pages/QuestionPage";
import MotDePassePage from "./pages/MotDePassePage";
import ProfilPage from "./pages/ProfilPage";
import {
  connecter, deconnecter, inscrire, modifierQuestion, publierQuestion, utilisateurConnecte,
} from "./api";

// Anciennes données enregistrées dans le navigateur : tout est désormais sur le serveur.
localStorage.removeItem("insta_users");
localStorage.removeItem("insta_questions");

/* ---------- Adresses des pages ----------
   L'adresse est placée après le « # » (ex. http://localhost:5173/#/questions/12) :
   actualiser la page ou utiliser le bouton Retour du navigateur fonctionne,
   et aucun réglage n'est nécessaire sur le serveur qui héberge le site. */

// Menus de la page d'accueil et leur adresse
const MENUS = {
  "Accueil": "/",
  "Questions": "/questions",
  "Catégories": "/categories",
  "Mes questions": "/mes-questions",
  "Favoris": "/favoris",
  "Classement": "/classement",
};

const lireAdresse = () => window.location.hash.replace(/^#/, "") || "/";

const aller = (chemin) => {
  window.location.hash = chemin;
};

// Transforme l'adresse en page à afficher
function analyser(adresse) {
  const [chemin, recherche = ""] = adresse.split("?");
  const parametres = new URLSearchParams(recherche);

  if (chemin === "/connexion") return { page: "connexion" };
  if (chemin === "/inscription") return { page: "inscription" };
  if (chemin === "/poser") return { page: "poser" };
  if (chemin === "/mot-de-passe-oublie") return { page: "oubli" };

  // Lien reçu par email : #/reinitialiser/<uid>/<jeton>
  const lien = chemin.match(/^\/reinitialiser\/([\w-]+)\/([\w-]+)$/);
  if (lien) return { page: "reinitialiser", uid: lien[1], token: lien[2] };

  const detail = chemin.match(/^\/questions\/(\d+)$/);
  if (detail) return { page: "question", id: Number(detail[1]) };

  const profil = chemin.match(/^\/membres\/([^/]+)$/);
  if (profil) return { page: "profil", username: decodeURIComponent(profil[1]) };

  const modification = chemin.match(/^\/questions\/(\d+)\/modifier$/);
  if (modification) return { page: "modifier", id: Number(modification[1]) };

  const menu = Object.keys(MENUS).find((nom) => MENUS[nom] === chemin);
  if (menu) {
    const categorie = Number(parametres.get("categorie")) || null;
    return { page: "accueil", menu, categorie: menu === "Questions" ? categorie : null };
  }

  // Adresse inconnue : on affiche l'accueil
  return { page: "accueil", menu: "Accueil", categorie: null };
}

const TITRES = {
  connexion: "Connexion",
  inscription: "Créer un compte",
  oubli: "Mot de passe oublié",
  reinitialiser: "Nouveau mot de passe",
  poser: "Poser une question",
  modifier: "Modifier la question",
  profil: "Profil",
  question: "Question",
};

export default function App() {
  const [adresse, setAdresse] = useState(lireAdresse);
  const [currentUser, setCurrentUser] = useState(null);
  const [chargement, setChargement] = useState(true);
  // Message affiché sur la page de connexion (ex. après une inscription réussie)
  const [messageConnexion, setMessageConnexion] = useState("");
  // Dernière vue de l'accueil, pour que « Retour » y ramène (ex. #/favoris)
  const derniereVue = useRef("/");

  const route = analyser(adresse);

  // Suivre les changements d'adresse (liens, bouton Retour du navigateur)
  useEffect(() => {
    const surChangement = () => {
      setAdresse(lireAdresse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", surChangement);
    return () => window.removeEventListener("hashchange", surChangement);
  }, []);

  // Au chargement : si un jeton est enregistré, on reconnecte l'utilisateur.
  useEffect(() => {
    utilisateurConnecte().then((utilisateur) => {
      if (utilisateur) setCurrentUser(utilisateur);
      setChargement(false);
    });
  }, []);

  if (route.page === "accueil") derniereVue.current = adresse;

  // Titre de l'onglet du navigateur
  // Pages accessibles sans être connecté
  const PAGES_PUBLIQUES = ["inscription", "oubli", "reinitialiser"];
  const pageAffichee = currentUser || PAGES_PUBLIQUES.includes(route.page) ? route.page : "connexion";
  useEffect(() => {
    const titre = pageAffichee === "accueil" ? (route.menu === "Accueil" ? "" : route.menu) : TITRES[pageAffichee];
    document.title = titre ? `${titre} — INSTA-FORUM` : "INSTA-FORUM";
  }, [pageAffichee, route.menu]);

  // Déjà connecté : les pages de connexion et d'inscription renvoient à l'accueil.
  useEffect(() => {
    if (currentUser && ["connexion", "inscription"].includes(route.page)) aller("/");
  }, [currentUser, route.page]);

  // Inscription (POST /api/comptes/inscription/)
  const handleRegister = async (data) => {
    await inscrire(data);
    setMessageConnexion("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
    aller("/connexion");
  };

  // Connexion (POST /api/comptes/connexion/)
  // L'utilisateur reste sur la page qu'il voulait ouvrir (ex. un lien vers une question).
  const handleLogin = async (identifiants) => {
    const utilisateur = await connecter(identifiants);
    setMessageConnexion("");
    setCurrentUser(utilisateur);
  };

  // Déconnexion (POST /api/comptes/deconnexion/)
  const handleLogout = async () => {
    await deconnecter().catch(() => {});
    setCurrentUser(null);
    derniereVue.current = "/";
    aller("/connexion");
  };

  // Publier une question (POST /api/questions/), puis l'ouvrir.
  // En cas d'erreur, le message est affiché par AskQuestionPage.
  const handleAddQuestion = async (data) => {
    const question = await publierQuestion(data);
    aller(`/questions/${question.id}`);
  };

  if (chargement) return null;

  // ===== Mot de passe oublié (connecté ou non) =====
  if (route.page === "oubli" || route.page === "reinitialiser") {
    return (
      <MotDePassePage
        key={route.page}
        uid={route.uid}
        token={route.token}
        onRetour={() => aller(currentUser ? "/" : "/connexion")}
        onNouvelleDemande={() => aller("/mot-de-passe-oublie")}
        onTermine={async (message) => {
          // Le mot de passe a changé : toutes les sessions sont fermées, on se reconnecte.
          if (currentUser) {
            await deconnecter().catch(() => {});
            setCurrentUser(null);
          }
          setMessageConnexion(message);
          aller("/connexion");
        }}
      />
    );
  }

  // ===== Pages accessibles sans être connecté =====
  if (!currentUser) {
    if (route.page === "inscription") {
      return <SignupPage onSubmit={handleRegister} onGoLogin={() => aller("/connexion")} />;
    }
    return (
      <LoginPage
        message={messageConnexion}
        onLogin={handleLogin}
        onSignup={() => aller("/inscription")}
        onForgotPassword={() => aller("/mot-de-passe-oublie")}
      />
    );
  }

  // ===== Pages réservées aux membres connectés =====
  if (route.page === "question") {
    return (
      <QuestionPage
        key={route.id}
        id={route.id}
        user={currentUser}
        onBack={() => aller(derniereVue.current)}
        onEdit={() => aller(`/questions/${route.id}/modifier`)}
        onDeleted={() => aller(derniereVue.current)}
        onLogout={handleLogout}
      />
    );
  }

  if (route.page === "profil") {
    return (
      <ProfilPage
        username={route.username}
        user={currentUser}
        onUserUpdate={setCurrentUser}
        onBack={() => window.history.length > 1 ? window.history.back() : aller(derniereVue.current)}
        onLogout={handleLogout}
      />
    );
  }

  if (route.page === "poser") {
    return <AskQuestionPage onSubmit={handleAddQuestion} onBack={() => aller(derniereVue.current)} />;
  }

  // Modifier une question (PATCH /api/questions/<id>/), puis revenir dessus
  if (route.page === "modifier") {
    return (
      <AskQuestionPage
        key={route.id}
        questionId={route.id}
        user={currentUser}
        onSubmit={async (data) => {
          await modifierQuestion(route.id, data);
          aller(`/questions/${route.id}`);
        }}
        onBack={() => aller(`/questions/${route.id}`)}
      />
    );
  }

  // Accueil et ses menus
  return (
    <HomePage
      user={currentUser}
      vue={route}
      onChangerVue={({ menu, categorie }) =>
        aller(MENUS[menu] + (menu === "Questions" && categorie ? `?categorie=${categorie}` : ""))
      }
      onLogout={handleLogout}
      onAskQuestion={() => aller("/poser")}
      onOpenQuestion={(id) => aller(`/questions/${id}`)}
    />
  );
}
