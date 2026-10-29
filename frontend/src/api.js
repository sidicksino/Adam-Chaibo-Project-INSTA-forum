// Adresse de l'API Django (modifiable via le fichier .env : VITE_API_URL=...)
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const CLE_JETON = "insta_jeton";

/* ---------- Jeton de connexion ---------- */
// « Se souvenir de moi » : localStorage (persiste), sinon sessionStorage (fermé avec l'onglet).
export const lireJeton = () =>
  localStorage.getItem(CLE_JETON) || sessionStorage.getItem(CLE_JETON);

const enregistrerJeton = (jeton, seSouvenir) => {
  (seSouvenir ? localStorage : sessionStorage).setItem(CLE_JETON, jeton);
};

const effacerJeton = () => {
  localStorage.removeItem(CLE_JETON);
  sessionStorage.removeItem(CLE_JETON);
};

/* ---------- Requête générique ---------- */
// Récupère tous les textes d'une erreur Django, même imbriqués
// (ex. {"tags": {"0": ["Ce champ ne peut contenir plus de 30 caractères."]}}).
const textes = (valeur) =>
  typeof valeur === "string" ? [valeur]
    : Array.isArray(valeur) ? valeur.flatMap(textes)
    : valeur && typeof valeur === "object" ? Object.values(valeur).flatMap(textes)
    : [];

// Transforme les erreurs renvoyées par Django en un seul message lisible.
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

  // 204 : réponse sans contenu
  const donnees = reponse.status === 204 ? null : await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const erreur = new Error(messageErreur(donnees));
    // Détail par champ (ex. { username: ["Ce nom d'utilisateur est déjà pris."] }), pour les formulaires
    erreur.champs = donnees && typeof donnees === "object" ? donnees : {};
    erreur.statut = reponse.status; // ex. 404 : introuvable
    throw erreur;
  }
  return donnees;
}

/* ---------- Comptes ---------- */
export const inscrire = (donnees) =>
  requete("/comptes/inscription/", { methode: "POST", corps: donnees });

export async function connecter({ identifier, password, remember }) {
  // Un ancien jeton ne doit pas être envoyé avec la demande de connexion.
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
    // Même si le serveur ne répond pas, on oublie le jeton localement.
    effacerJeton();
  }
}

/* ---------- Forum ---------- */
export const listerQuestions = () => requete("/questions/");

export const publierQuestion = (donnees) =>
  requete("/questions/", { methode: "POST", corps: donnees });

export const lireQuestion = (id) => requete(`/questions/${id}/`);

// Modifier ou supprimer : réservé à l'auteur (le serveur refuse pour les autres)
export const modifierQuestion = (id, donnees) =>
  requete(`/questions/${id}/`, { methode: "PATCH", corps: donnees });

export const supprimerQuestion = (id) => requete(`/questions/${id}/`, { methode: "DELETE" });

export const modifierReponse = (id, contenu) =>
  requete(`/reponses/${id}/`, { methode: "PATCH", corps: { contenu } });

export const supprimerReponse = (id) => requete(`/reponses/${id}/`, { methode: "DELETE" });

export const listerReponses = (idQuestion) => requete(`/questions/${idQuestion}/reponses/`);

export const publierReponse = (idQuestion, contenu) =>
  requete(`/questions/${idQuestion}/reponses/`, { methode: "POST", corps: { contenu } });

// Un second appel sur la même réponse annule l'acceptation.
export const accepterReponse = (idReponse) =>
  requete(`/reponses/${idReponse}/accepter/`, { methode: "POST" });

// valeur : 1 (pour) ou -1 (contre). Revoter la même valeur retire le vote.
export const voterQuestion = (id, valeur) =>
  requete(`/questions/${id}/voter/`, { methode: "POST", corps: { valeur } });

export const voterReponse = (id, valeur) =>
  requete(`/reponses/${id}/voter/`, { methode: "POST", corps: { valeur } });

// Ajoute la question aux favoris, ou l'en retire si elle y est déjà
export const basculerFavori = (id) =>
  requete(`/questions/${id}/favori/`, { methode: "POST" });

export const lireClassement = () => requete("/classement/");

// { non_lues, notifications: [...] }
export const lireNotifications = () => requete("/notifications/");

// Sans identifiant : marque toutes les notifications comme lues
export const marquerNotificationsLues = (id) =>
  requete("/notifications/lire/", { methode: "POST", corps: id ? { id } : {} });

export const listerCategories = () => requete("/categories/");

export const lireStatistiques = () => requete("/statistiques/");

/* ---------- Profil ---------- */
// Profil public d'un membre : statistiques, rang, questions et réponses
export const lireMembre = (username) => requete(`/membres/${encodeURIComponent(username)}/`);

// Modifier son prénom, nom, profil ou niveau ; renvoie l'utilisateur à jour
export const modifierMonProfil = (donnees) => requete("/comptes/moi/", { methode: "PATCH", corps: donnees });

// Le serveur déconnecte les autres appareils et renvoie un nouveau jeton pour celui-ci
export async function changerMotDePasse(ancien, nouveau) {
  const { token, detail } = await requete("/comptes/mot-de-passe/", { methode: "POST", corps: { ancien, nouveau } });
  // Le nouveau jeton remplace l'ancien là où il était rangé (« Se souvenir de moi » ou non)
  const seSouvenir = localStorage.getItem(CLE_JETON) !== null;
  enregistrerJeton(token, seSouvenir);
  return detail;
}

/* ---------- Mot de passe oublié ---------- */
export const demanderReinitialisation = (email) =>
  requete("/comptes/mot-de-passe-oublie/", { methode: "POST", corps: { email } });

export const verifierLien = (uid, token) =>
  requete("/comptes/reinitialiser/verifier/", { methode: "POST", corps: { uid, token } });

export const reinitialiserMotDePasse = (uid, token, password) =>
  requete("/comptes/reinitialiser/", { methode: "POST", corps: { uid, token, password } });

// Retrouve l'utilisateur connecté au rechargement de la page.
export async function utilisateurConnecte() {
  if (!lireJeton()) return null;
  try {
    return await requete("/comptes/moi/");
  } catch {
    effacerJeton();
    return null;
  }
}
