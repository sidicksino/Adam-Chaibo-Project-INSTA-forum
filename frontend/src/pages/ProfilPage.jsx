import { useEffect, useState } from "react";
import "./HomePage.css";    // styles communs (barre du haut, cartes, onglets, avatars)
import "./QuestionPage.css"; // bouton « Retour » et messages d'erreur (.detail__retour, .detail__erreur)
import "./SignupPage.css";  // indicateur de solidité du mot de passe (.solidite)
import "./ProfilPage.css";  // styles propres à cette page
import { changerMotDePasse, lireMembre, modifierMonProfil } from "../api";
import { Avatar, Cloche, MenuCompte, Solidite, couleurPour, ilYA, pluriel } from "../commun";

const GradCap = () => (
  <svg width="44" height="28" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#1766f0" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#1766f0" />
    <path d="M150 38v30" stroke="#1766f0" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const PROFILS = { etudiant: "Étudiant", enseignant: "Enseignant", personnel: "Personnel" };
const NIVEAUX = { L1: "Licence 1", L2: "Licence 2", L3: "Licence 3", M1: "Master 1", M2: "Master 2" };

// « octobre 2026 »
const moisAnnee = (date) => new Date(date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

/* ---------- Onglet « Paramètres » (uniquement sur son propre profil) ---------- */
function Parametres({ user, onUserUpdate }) {
  const [infos, setInfos] = useState({
    prenom: user.prenom, nom: user.nom, profil: user.profil, niveau: user.niveau || "",
  });
  const [etatInfos, setEtatInfos] = useState({ envoi: false, message: "", erreur: "" });

  const [mdp, setMdp] = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [etatMdp, setEtatMdp] = useState({ envoi: false, message: "", erreur: "" });

  const changerInfo = (cle) => (e) => {
    const valeur = e.target.value;
    setInfos((i) => ({ ...i, [cle]: valeur, ...(cle === "profil" && valeur !== "etudiant" ? { niveau: "" } : {}) }));
    setEtatInfos({ envoi: false, message: "", erreur: "" });
  };

  const enregistrerInfos = async (e) => {
    e.preventDefault();
    if (!infos.prenom.trim() || !infos.nom.trim()) {
      setEtatInfos({ envoi: false, message: "", erreur: "Le prénom et le nom sont obligatoires." });
      return;
    }
    setEtatInfos({ envoi: true, message: "", erreur: "" });
    try {
      const misAJour = await modifierMonProfil({ ...infos, prenom: infos.prenom.trim(), nom: infos.nom.trim() });
      onUserUpdate(misAJour);
      setEtatInfos({ envoi: false, message: "Vos informations ont été enregistrées.", erreur: "" });
    } catch (err) {
      setEtatInfos({ envoi: false, message: "", erreur: err.message });
    }
  };

  const changerMdp = (cle) => (e) => {
    setMdp((m) => ({ ...m, [cle]: e.target.value }));
    setEtatMdp({ envoi: false, message: "", erreur: "" });
  };

  const enregistrerMdp = async (e) => {
    e.preventDefault();
    if (!mdp.ancien || !mdp.nouveau) {
      setEtatMdp({ envoi: false, message: "", erreur: "Remplissez votre mot de passe actuel et le nouveau." });
      return;
    }
    if (mdp.nouveau !== mdp.confirmation) {
      setEtatMdp({ envoi: false, message: "", erreur: "Les deux nouveaux mots de passe ne correspondent pas." });
      return;
    }
    setEtatMdp({ envoi: true, message: "", erreur: "" });
    try {
      await changerMotDePasse(mdp.ancien, mdp.nouveau);
      setMdp({ ancien: "", nouveau: "", confirmation: "" });
      setEtatMdp({
        envoi: false, erreur: "",
        message: "Mot de passe modifié. Vos autres appareils ont été déconnectés.",
      });
    } catch (err) {
      setEtatMdp({ envoi: false, message: "", erreur: err.message });
    }
  };

  return (
    <div className="profil__parametres">
      <form className="card profil__formulaire" onSubmit={enregistrerInfos} noValidate>
        <h2>Mes informations</h2>
        <div className="profil__grille">
          <label>Prénom<input value={infos.prenom} onChange={changerInfo("prenom")} autoComplete="given-name" /></label>
          <label>Nom<input value={infos.nom} onChange={changerInfo("nom")} autoComplete="family-name" /></label>
          <label>
            Profil
            <select value={infos.profil} onChange={changerInfo("profil")}>
              {Object.entries(PROFILS).map(([valeur, texte]) => <option key={valeur} value={valeur}>{texte}</option>)}
            </select>
          </label>
          <label>
            Niveau
            <select value={infos.niveau} onChange={changerInfo("niveau")} disabled={infos.profil !== "etudiant"}>
              <option value="">{infos.profil === "etudiant" ? "Choisir…" : "Non applicable"}</option>
              {Object.entries(NIVEAUX).map(([valeur, texte]) => <option key={valeur} value={valeur}>{texte}</option>)}
            </select>
          </label>
        </div>
        <p className="profil__aide">Votre nom d’utilisateur (@{user.username}) et votre email ({user.email}) ne peuvent pas être modifiés.</p>
        {etatInfos.erreur && <p className="detail__erreur" role="alert">{etatInfos.erreur}</p>}
        {etatInfos.message && <p className="profil__succes" role="status">{etatInfos.message}</p>}
        <button type="submit" className="home__ask" disabled={etatInfos.envoi}>
          {etatInfos.envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <form className="card profil__formulaire" onSubmit={enregistrerMdp} noValidate>
        <h2>Changer mon mot de passe</h2>
        <div className="profil__grille profil__grille--une-colonne">
          <label>
            Mot de passe actuel
            <input type="password" value={mdp.ancien} onChange={changerMdp("ancien")} autoComplete="current-password" />
          </label>
          <label>
            Nouveau mot de passe
            <input type="password" value={mdp.nouveau} onChange={changerMdp("nouveau")} autoComplete="new-password" />
          </label>
          <Solidite motDePasse={mdp.nouveau} />
          <label>
            Confirmer le nouveau mot de passe
            <input type="password" value={mdp.confirmation} onChange={changerMdp("confirmation")} autoComplete="new-password" />
          </label>
        </div>
        {etatMdp.erreur && <p className="detail__erreur" role="alert">{etatMdp.erreur}</p>}
        {etatMdp.message && <p className="profil__succes" role="status">{etatMdp.message}</p>}
        <button type="submit" className="home__ask" disabled={etatMdp.envoi}>
          {etatMdp.envoi ? "Enregistrement…" : "Changer le mot de passe"}
        </button>
      </form>
    </div>
  );
}

/* ---------- Page de profil d'un membre ---------- */
export default function ProfilPage({ username, user, onUserUpdate, onBack, onLogout }) {
  const [membre, setMembre] = useState(null);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState("questions");
  const estMoi = user?.username === username;

  useEffect(() => {
    setMembre(null);
    setErreur("");
    setOnglet("questions");
    lireMembre(username)
      .then((m) => {
        setMembre(m);
        // Un membre qui répond sans poser de questions (souvent un enseignant) : on ouvre ses réponses
        if (m.questions.length === 0 && m.reponses.length > 0) setOnglet("reponses");
      })
      .catch((err) => setErreur(err.statut === 404 ? "Ce membre n’existe pas." : err.message));
  }, [username]);

  // Après « Mes informations », le nom affiché en haut du profil suit
  const mettreAJour = (misAJour) => {
    onUserUpdate(misAJour);
    setMembre((m) => ({ ...m, prenom: misAJour.prenom, nom: misAJour.nom, profil: misAJour.profil, niveau: misAJour.niveau }));
  };

  const nomComplet = membre ? `${membre.prenom} ${membre.nom}`.trim() || membre.username : "";
  const stats = membre?.stats;

  return (
    <div className="home">
      {/* ===== Barre du haut ===== */}
      <header className="home__nav">
        <a className="home__logo" href="#/">
          <GradCap />
          <span>INSTA-<b>FORUM</b></span>
        </a>
        <div className="home__actions">
          <Cloche />
          <MenuCompte user={user} onLogout={onLogout} />
        </div>
      </header>

      <main className="profil">
        <button type="button" className="detail__retour" onClick={onBack}>← Retour</button>

        {erreur && (
          <div className="card home__empty" role="alert">
            {erreur}
          </div>
        )}
        {!membre && !erreur && <div className="card home__empty">Chargement du profil…</div>}

        {membre && (
          <>
            {/* ===== Identité ===== */}
            <section className="card profil__entete">
              <Avatar name={nomComplet} color={couleurPour(membre.username)} size={88} />
              <div className="profil__identite">
                <h1>{nomComplet}{estMoi && <span className="profil__vous">vous</span>}</h1>
                <p className="profil__pseudo">@{membre.username}</p>
                <div className="profil__badges">
                  <span className="profil__badge">
                    {PROFILS[membre.profil] ?? "Membre"}{membre.niveau ? ` · ${NIVEAUX[membre.niveau] ?? membre.niveau}` : ""}
                  </span>
                  <span className="profil__depuis">Membre depuis {moisAnnee(membre.date_inscription)}</span>
                </div>
              </div>
              <div className={`profil__rang${stats.rang ? "" : " is-vide"}`}>
                {stats.rang ? (
                  <>
                    <strong>{stats.rang <= 3 ? ["🥇", "🥈", "🥉"][stats.rang - 1] : `#${stats.rang}`}</strong>
                    <span>{stats.rang === 1 ? "1er" : `${stats.rang}e`} au classement</span>
                    <small>{pluriel(stats.points, "point")}</small>
                  </>
                ) : (
                  <span>Pas encore classé</span>
                )}
              </div>
            </section>

            {/* ===== Statistiques ===== */}
            <ul className="profil__stats">
              <li><strong>{stats.questions}</strong>question{stats.questions > 1 ? "s" : ""}</li>
              <li><strong>{stats.reponses}</strong>réponse{stats.reponses > 1 ? "s" : ""}</li>
              <li className="is-vert"><strong>{stats.acceptees}</strong>acceptée{stats.acceptees > 1 ? "s" : ""}</li>
              <li><strong>{stats.votes_recus}</strong>vote{Math.abs(stats.votes_recus) > 1 ? "s" : ""} reçu{Math.abs(stats.votes_recus) > 1 ? "s" : ""}</li>
            </ul>

            {/* ===== Onglets ===== */}
            <div className="home__tabs" role="tablist">
              <button role="tab" aria-selected={onglet === "questions"} className={onglet === "questions" ? "is-active" : ""}
                onClick={() => setOnglet("questions")}>Questions ({membre.questions.length})</button>
              <button role="tab" aria-selected={onglet === "reponses"} className={onglet === "reponses" ? "is-active" : ""}
                onClick={() => setOnglet("reponses")}>Réponses ({membre.reponses.length})</button>
              {estMoi && (
                <button role="tab" aria-selected={onglet === "parametres"} className={onglet === "parametres" ? "is-active" : ""}
                  onClick={() => setOnglet("parametres")}>Paramètres</button>
              )}
            </div>

            {onglet === "questions" && (
              membre.questions.length === 0 ? (
                <div className="card home__empty">{estMoi ? "Vous n’avez pas encore posé de question." : `${membre.prenom || membre.username} n’a pas encore posé de question.`}</div>
              ) : (
                <ul className="card profil__liste">
                  {membre.questions.map((q) => (
                    <li key={q.id}>
                      <span className="qcarte__categorie" style={{ "--couleur-categorie": q.categorie.couleur }}>{q.categorie.nom}</span>
                      <a href={`#/questions/${q.id}`} className="profil__titre">{q.titre}</a>
                      <span className="profil__meta">
                        {ilYA(q.date_creation)} · {pluriel(q.votes, "vote")} · {pluriel(q.reponses, "réponse")}
                        {q.resolue && <span className="profil__resolue">✓ Résolue</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}

            {onglet === "reponses" && (
              membre.reponses.length === 0 ? (
                <div className="card home__empty">{estMoi ? "Vous n’avez pas encore répondu à une question." : `${membre.prenom || membre.username} n’a pas encore répondu à une question.`}</div>
              ) : (
                <ul className="card profil__liste">
                  {membre.reponses.map((r) => (
                    <li key={r.id}>
                      <span className="profil__contexte">
                        Réponse à <a href={`#/questions/${r.question.id}`}>{r.question.titre}</a>
                      </span>
                      <p className="profil__extrait">{r.extrait.replace(/```[\w+#.-]*\n?/g, "").replace(/`/g, "")}</p>
                      <span className="profil__meta">
                        {ilYA(r.date_creation)} · {pluriel(r.votes, "vote")}
                        {r.acceptee && <span className="profil__resolue">✓ Réponse acceptée</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}

            {onglet === "parametres" && estMoi && <Parametres user={user} onUserUpdate={mettreAJour} />}
          </>
        )}
      </main>
    </div>
  );
}
