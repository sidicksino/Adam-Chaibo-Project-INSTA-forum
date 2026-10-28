
import { useEffect, useState } from "react";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import HomePage from "./pages/HomePage";
import AskQuestionPage from "./pages/AskQuestionPage";
import QuestionPage from "./pages/QuestionPage";
import { connecter, deconnecter, inscrire, publierQuestion, utilisateurConnecte } from "./api";

// Anciennes données enregistrées dans le navigateur : tout est désormais sur le serveur.
localStorage.removeItem("insta_users");
localStorage.removeItem("insta_questions");

export default function App() {
  const [page, setPage] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [chargement, setChargement] = useState(true);
  // Identifiant de la question ouverte sur la page de détail
  const [questionId, setQuestionId] = useState(null);
  // Menu choisi sur la page d'accueil, conservé au retour d'une question
  const [vueAccueil, setVueAccueil] = useState({ menu: "Accueil", categorie: null });

  // Au chargement : si un jeton est enregistré, on reconnecte l'utilisateur.
  useEffect(() => {
    utilisateurConnecte().then((utilisateur) => {
      if (utilisateur) {
        setCurrentUser(utilisateur);
        setPage("home");
      }
      setChargement(false);
    });
  }, []);

  // Inscription (POST /api/comptes/inscription/)
  const handleRegister = async (data) => {
    await inscrire(data);
    alert("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
    setPage("login");
  };

  // Connexion (POST /api/comptes/connexion/)
  const handleLogin = async (identifiants) => {
    const utilisateur = await connecter(identifiants);
    setCurrentUser(utilisateur);
    setPage("home");
  };

  // Déconnexion (POST /api/comptes/deconnexion/)
  const handleLogout = async () => {
    await deconnecter().catch(() => {});
    setCurrentUser(null);
    setVueAccueil({ menu: "Accueil", categorie: null });
    setPage("login");
  };

  // Publier une question (POST /api/questions/)
  // En cas d'erreur, le message est affiché par AskQuestionPage.
  const handleAddQuestion = async (data) => {
    await publierQuestion(data);
    setPage("home");
  };

  if (chargement) return null;

  if (page === "signup") {
    return (
      <SignupPage
        onSubmit={handleRegister}
        onGoLogin={() => setPage("login")}
      />
    );
  }

  if (page === "home" && currentUser) {
    return (
      <HomePage
        user={currentUser}
        vue={vueAccueil}
        onChangerVue={setVueAccueil}
        onLogout={handleLogout}
        onAskQuestion={() => setPage("askQuestion")}
        onOpenQuestion={(id) => {
          setQuestionId(id);
          setPage("question");
        }}
      />
    );
  }

  if (page === "question" && currentUser) {
    return (
      <QuestionPage
        id={questionId}
        user={currentUser}
        onBack={() => setPage("home")}
        onLogout={handleLogout}
      />
    );
  }

  if (page === "askQuestion" && currentUser) {
    return (
      <AskQuestionPage
        onSubmit={handleAddQuestion}
        onBack={() => setPage("home")}
      />
    );
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      onSignup={() => setPage("signup")}
      onForgotPassword={() =>
        alert("Fonction à venir")
      }
    />
  );
}
