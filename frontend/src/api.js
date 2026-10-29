const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const CLE_JETON = "insta_jeton";

export const lireJeton = () =>
  localStorage.getItem(CLE_JETON) || sessionStorage.getItem(CLE_JETON);

const enregistrerJeton = (jeton, seSouvenir) => {
  (seSouvenir ? localStorage : sessionStorage).setItem(CLE_JETON, jeton);
};

const effacerJeton = () => {
  localStorage.removeItem(CLE_JETON);
  sessionStorage.removeItem(CLE_JETON);
};

const textes = (valeur) =>
  typeof valeur === "string" ? [valeur]
    : Array.isArray(valeur) ? valeur.flatMap(textes)
    : valeur && typeof valeur === "object" ? Object.values(valeur).flatMap(textes)
    : [];

const messageErreur = (donnees) => {
  const liste = textes(donnees);
  return liste.length ? liste.join(" ") : "Une erreur est survenue. Réessayez.";
};

async function requete(chemin, { methode = "GET", corps } = {}) {
  const enTetes = { "Content-Type": "application/json" };
  const jeton = lireJeton();
  if (jeton) enTetes.Authorization = `Token ${jeton}`;

  let reponse;
  try {
    reponse = await fetch(`${API_URL}${chemin}`, {
      method: methode,
      headers: enTetes,
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifiez que le backend est démarré.");
  }

  const donnees = reponse.status === 204 ? null : await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const erreur = new Error(messageErreur(donnees));
    erreur.champs = donnees && typeof donnees === "object" ? donnees : {};
    erreur.statut = reponse.status;
    throw erreur;
  }
  return donnees;
}

export const inscrire = (donnees) =>
  requete("/comptes/inscription/", { methode: "POST", corps: donnees });

export async function connecter({ identifier, password, remember }) {
  effacerJeton();
  const { token, utilisateur } = await requete("/comptes/connexion/", {
    methode: "POST",
    corps: { identifier, password },
  });
  enregistrerJeton(token, remember);
  return utilisateur;
}

export async function deconnecter() {
  try {
    await requete("/comptes/deconnexion/", { methode: "POST" });
  } finally {
    effacerJeton();
  }
}

export const listerQuestions = () => requete("/questions/");

export const publierQuestion = (donnees) =>
  requete("/questions/", { methode: "POST", corps: donnees });

export const lireQuestion = (id) => requete(`/questions/${id}/`);

export const modifierQuestion = (id, donnees) =>
  requete(`/questions/${id}/`, { methode: "PATCH", corps: donnees });

export async function televerserCaptures(questionId, fichiers) {
  if (!fichiers || fichiers.length === 0) return [];
  const form = new FormData();
  fichiers.forEach((f) => form.append("images", f));
  const jeton = lireJeton();
  const enTetes = {};
  if (jeton) enTetes.Authorization = `Token ${jeton}`;

  const reponse = await fetch(`${API_URL}/questions/${questionId}/captures/`, {
    method: "POST",
    headers: enTetes,
    body: form,
  });
  if (!reponse.ok) {
    const donnees = await reponse.json().catch(() => null);
    throw new Error(messageErreur(donnees));
  }
  return reponse.json();
}

export const supprimerQuestion = (id) => requete(`/questions/${id}/`, { methode: "DELETE" });

export const modifierReponse = (id, contenu) =>
  requete(`/reponses/${id}/`, { methode: "PATCH", corps: { contenu } });

export const supprimerReponse = (id) => requete(`/reponses/${id}/`, { methode: "DELETE" });

export const listerReponses = (idQuestion) => requete(`/questions/${idQuestion}/reponses/`);

export const publierReponse = (idQuestion, contenu) =>
  requete(`/questions/${idQuestion}/reponses/`, { methode: "POST", corps: { contenu } });

export const accepterReponse = (idReponse) =>
  requete(`/reponses/${idReponse}/accepter/`, { methode: "POST" });

export const voterQuestion = (id, valeur) =>
  requete(`/questions/${id}/voter/`, { methode: "POST", corps: { valeur } });

export const voterReponse = (id, valeur) =>
  requete(`/reponses/${id}/voter/`, { methode: "POST", corps: { valeur } });

export const basculerFavori = (id) =>
  requete(`/questions/${id}/favori/`, { methode: "POST" });

export const lireClassement = () => requete("/classement/");

export const lireNotifications = () => requete("/notifications/");

export const marquerNotificationsLues = (id) =>
  requete("/notifications/lire/", { methode: "POST", corps: id ? { id } : {} });

export const listerCategories = () => requete("/categories/");

export const lireStatistiques = () => requete("/statistiques/");

export const lireMembre = (username) => requete(`/membres/${encodeURIComponent(username)}/`);

export const modifierMonProfil = (donnees) => requete("/comptes/moi/", { methode: "PATCH", corps: donnees });

export async function changerMotDePasse(ancien, nouveau) {
  const { token, detail } = await requete("/comptes/mot-de-passe/", { methode: "POST", corps: { ancien, nouveau } });
  const seSouvenir = localStorage.getItem(CLE_JETON) !== null;
  enregistrerJeton(token, seSouvenir);
  return detail;
}

export const demanderReinitialisation = (email) =>
  requete("/comptes/mot-de-passe-oublie/", { methode: "POST", corps: { email } });

export const verifierLien = (uid, token) =>
  requete("/comptes/reinitialiser/verifier/", { methode: "POST", corps: { uid, token } });

export const reinitialiserMotDePasse = (uid, token, password) =>
  requete("/comptes/reinitialiser/", { methode: "POST", corps: { uid, token, password } });

export async function utilisateurConnecte() {
  if (!lireJeton()) return null;
  try {
    return await requete("/comptes/moi/");
  } catch {
    effacerJeton();
    return null;
  }
}
