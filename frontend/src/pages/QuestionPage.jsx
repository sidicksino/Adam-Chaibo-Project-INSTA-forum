import { useEffect, useState } from "react";
import "./HomePage.css";      // styles communs (barre du haut, cartes, tags, avatars)
import "./QuestionPage.css";  // styles propres à cette page
import {
  accepterReponse, basculerFavori, listerReponses, lireQuestion, modifierReponse, publierReponse,
  supprimerQuestion, supprimerReponse, voterQuestion, voterReponse,
} from "../api";
import { Avatar, Avis, MenuCompte, couleurPour, ilYA, nomCourt, pluriel, useAvis } from "../commun";

const GradCap = () => (
  <svg width="44" height="28" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#1766f0" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#1766f0" />
    <path d="M150 38v30" stroke="#1766f0" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

const Etoile = ({ pleine }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={pleine ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" />
  </svg>
);

const Fleche = ({ bas }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"
    style={bas ? { transform: "rotate(180deg)" } : undefined}>
    <path d="M12 5l8 10H4z" fill="currentColor" />
  </svg>
);

/* ---------- Colonne de vote : ▲ score ▼ ---------- */
// « nom » sert aux messages : « question » ou « réponse »
function Votes({ score, monVote, estAMoi, nom, onVoter }) {
  const titre = (texte) => (estAMoi ? `Vous ne pouvez pas voter pour votre propre ${nom}` : texte);
  return (
    <div className="votes">
      <button type="button" className={`votes__btn${monVote === 1 ? " is-actif" : ""}`}
        onClick={() => onVoter(1)} disabled={estAMoi} aria-pressed={monVote === 1}
        title={titre(`Cette ${nom} est utile`)} aria-label={`Voter pour cette ${nom}`}>
        <Fleche />
      </button>
      <strong className="votes__score">{score}</strong>
      <button type="button" className={`votes__btn${monVote === -1 ? " is-actif is-contre" : ""}`}
        onClick={() => onVoter(-1)} disabled={estAMoi} aria-pressed={monVote === -1}
        title={titre(`Cette ${nom} n’est pas utile`)} aria-label={`Voter contre cette ${nom}`}>
        <Fleche bas />
      </button>
    </div>
  );
}

// « • modifiée » ; la date exacte s'affiche au survol
const Modifiee = ({ date }) =>
  date ? (
    <>
      <span>•</span>
      <span title={`Modifiée le ${new Date(date).toLocaleString("fr-FR")}`}>modifiée {ilYA(date)}</span>
    </>
  ) : null;

/* ---------- Page de détail d'une question ---------- */
export default function QuestionPage({ id, user, onBack, onEdit, onDeleted, onLogout }) {
  const [question, setQuestion] = useState(null);
  const [reponses, setReponses] = useState([]);
  const [erreur, setErreur] = useState("");
  const [contenu, setContenu] = useState("");
  const [erreurReponse, setErreurReponse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [avis, afficherAvis] = useAvis();
  // Réponse en cours de modification : { id, texte, erreur, envoi } ou null
  const [edition, setEdition] = useState(null);

  useEffect(() => {
    Promise.all([lireQuestion(id), listerReponses(id)])
      .then(([q, r]) => {
        setQuestion(q);
        setReponses(r);
      })
      .catch((err) => setErreur(err.message));
  }, [id]);

  const estAuteur = question && user && question.auteur.username === user.username;
  const estAMoi = (reponse) => reponse.auteur.username === user?.username;

  const handleSupprimerQuestion = async () => {
    const message = reponses.length
      ? `Supprimer cette question et ses ${pluriel(reponses.length, "réponse")} ? Cette action est définitive.`
      : "Supprimer cette question ? Cette action est définitive.";
    if (!window.confirm(message)) return;
    try {
      await supprimerQuestion(id);
      onDeleted();
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  const handleEnregistrerReponse = async (e) => {
    e.preventDefault();
    if (!edition.texte.trim()) {
      setEdition((ed) => ({ ...ed, erreur: "La réponse ne peut pas être vide." }));
      return;
    }
    setEdition((ed) => ({ ...ed, envoi: true, erreur: "" }));
    try {
      const modifiee = await modifierReponse(edition.id, edition.texte.trim());
      // On garde notre vote, que le serveur ne renvoie pas ici
      setReponses((liste) => liste.map((r) => (r.id === modifiee.id ? { ...r, ...modifiee, mon_vote: r.mon_vote } : r)));
      setEdition(null);
    } catch (err) {
      setEdition((ed) => ({ ...ed, envoi: false, erreur: err.message }));
    }
  };

  const handleSupprimerReponse = async (reponse) => {
    if (!window.confirm("Supprimer votre réponse ? Cette action est définitive.")) return;
    try {
      await supprimerReponse(reponse.id);
      setReponses((liste) => liste.filter((r) => r.id !== reponse.id));
      // Supprimer la réponse acceptée remet la question « non résolue » (comme sur le serveur)
      setQuestion((q) => ({ ...q, reponses: q.reponses - 1, resolue: reponse.acceptee ? false : q.resolue }));
      afficherAvis("Votre réponse a été supprimée.");
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  const handleRepondre = async (e) => {
    e.preventDefault();
    setErreurReponse("");

    if (!contenu.trim()) {
      setErreurReponse("Écrivez votre réponse avant de la publier.");
      return;
    }

    try {
      setEnvoi(true);
      const nouvelle = await publierReponse(id, contenu.trim());
      setReponses((r) => [...r, nouvelle]);
      setQuestion((q) => ({ ...q, reponses: q.reponses + 1 }));
      setContenu("");
    } catch (err) {
      setErreurReponse(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  const handleAccepter = async (reponse) => {
    try {
      const modifiee = await accepterReponse(reponse.id);
      // La liste est rechargée car l'ordre change (réponse acceptée en premier)
      setReponses(await listerReponses(id));
      setQuestion((q) => ({ ...q, resolue: modifiee.acceptee }));
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  // Le serveur renvoie le nouveau score et notre vote : on met à jour sans recharger la page.
  const handleVoterQuestion = async (valeur) => {
    try {
      const { votes, mon_vote } = await voterQuestion(id, valeur);
      setQuestion((q) => ({ ...q, votes, mon_vote }));
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  const handleFavori = async () => {
    try {
      const { favori } = await basculerFavori(id);
      setQuestion((q) => ({ ...q, favori }));
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  const handleVoterReponse = async (reponse, valeur) => {
    try {
      const { votes, mon_vote } = await voterReponse(reponse.id, valeur);
      // L'ordre n'est pas modifié tout de suite pour que la réponse ne « saute » pas sous la souris.
      setReponses((liste) => liste.map((r) => (r.id === reponse.id ? { ...r, votes, mon_vote } : r)));
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  return (
    <div className="home">
      {/* ===== Barre du haut ===== */}
      <header className="home__nav">
        <a className="home__logo" href="#/">
          <GradCap />
          <span>INSTA-<b>FORUM</b></span>
        </a>
        <MenuCompte user={user} onLogout={onLogout} />
      </header>

      <main className="detail">
        <button type="button" className="detail__retour" onClick={onBack}>
          ← Retour aux questions
        </button>

        {erreur && <div className="card home__empty" role="alert">{erreur}</div>}

        {!question && !erreur && <div className="card home__empty">Chargement de la question…</div>}

        {question && (
          <>
            {/* ===== La question ===== */}
            <article className="card detail__question detail__ligne">
              <Votes score={question.votes} monVote={question.mon_vote} estAMoi={estAuteur}
                nom="question" onVoter={handleVoterQuestion} />
              <div className="detail__contenu">
              <div className="detail__entete">
                <h1>{question.titre}</h1>
                <div className="detail__actions">
                  {question.resolue && <span className="detail__badge">✓ Résolue</span>}
                  <button type="button" className={`detail__favori${question.favori ? " is-active" : ""}`}
                    onClick={handleFavori} aria-pressed={question.favori}>
                    <Etoile pleine={question.favori} />
                    {question.favori ? "En favori" : "Ajouter aux favoris"}
                  </button>
                </div>
              </div>

              <div className="question__meta">
                <Avatar name={`${question.auteur.prenom} ${question.auteur.nom}`}
                  color={couleurPour(question.auteur.username)} size={24} />
                <span className="question__author">{nomCourt(question.auteur)}</span>
                <span>•</span><span>{ilYA(question.date_creation)}</span>
                <Modifiee date={question.date_modification} />
                <span>•</span><span>{pluriel(question.vues, "vue")}</span>
              </div>

              <p className="detail__texte">{question.description}</p>

              <div className="question__tags">
                <span className="tag">{question.categorie.nom}</span>
                {question.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>

              {/* Modifier / supprimer : réservé à l'auteur */}
              {estAuteur && (
                <div className="detail__outils">
                  <button type="button" onClick={onEdit}>Modifier</button>
                  <button type="button" className="is-danger" onClick={handleSupprimerQuestion}>Supprimer</button>
                </div>
              )}
              </div>
            </article>

            {/* ===== Les réponses ===== */}
            <h2 className="detail__titre-reponses">{pluriel(reponses.length, "réponse")}</h2>

            {reponses.length === 0 && (
              <div className="card home__empty">
                Aucune réponse pour le moment. Aidez {nomCourt(question.auteur)} en répondant !
              </div>
            )}

            {reponses.map((r) => (
              <article key={r.id} className={`card detail__reponse detail__ligne${r.acceptee ? " is-acceptee" : ""}`}>
                <Votes score={r.votes} monVote={r.mon_vote} estAMoi={r.auteur.username === user?.username}
                  nom="réponse" onVoter={(valeur) => handleVoterReponse(r, valeur)} />
                <div className="detail__contenu">
                {r.acceptee && <span className="detail__badge">✓ Réponse acceptée</span>}

                {edition?.id === r.id ? (
                  /* Modification de sa propre réponse, directement dans la page */
                  <form className="detail__edition" onSubmit={handleEnregistrerReponse} noValidate>
                    <textarea rows="5" value={edition.texte} aria-label="Modifier votre réponse" autoFocus
                      onChange={(e) => setEdition((ed) => ({ ...ed, texte: e.target.value }))} />
                    {edition.erreur && <p className="detail__erreur" role="alert">{edition.erreur}</p>}
                    <div className="detail__outils">
                      <button type="button" onClick={() => setEdition(null)}>Annuler</button>
                      <button type="submit" className="is-principal" disabled={edition.envoi}>
                        {edition.envoi ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="detail__texte">{r.contenu}</p>
                )}

                <div className="detail__pied">
                  <div className="question__meta">
                    <Avatar name={`${r.auteur.prenom} ${r.auteur.nom}`}
                      color={couleurPour(r.auteur.username)} size={24} />
                    <span className="question__author">{nomCourt(r.auteur)}</span>
                    <span>•</span><span>{ilYA(r.date_creation)}</span>
                    <Modifiee date={r.date_modification} />
                  </div>
                  <div className="detail__outils">
                    {estAMoi(r) && edition?.id !== r.id && (
                      <>
                        <button type="button" onClick={() => setEdition({ id: r.id, texte: r.contenu, erreur: "", envoi: false })}>
                          Modifier
                        </button>
                        <button type="button" className="is-danger" onClick={() => handleSupprimerReponse(r)}>
                          Supprimer
                        </button>
                      </>
                    )}
                    {/* Seul l'auteur de la question peut choisir la bonne réponse */}
                    {estAuteur && (
                      <button type="button" className="detail__accepter" onClick={() => handleAccepter(r)}>
                        {r.acceptee ? "Retirer l’acceptation" : "Accepter cette réponse"}
                      </button>
                    )}
                  </div>
                </div>
                </div>
              </article>
            ))}

            {/* ===== Formulaire de réponse ===== */}
            <form className="card detail__formulaire" onSubmit={handleRepondre} noValidate>
              <h2>Votre réponse</h2>
              <textarea
                rows="6"
                placeholder="Expliquez votre solution en détail…"
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                aria-label="Votre réponse"
              />
              {erreurReponse && <p className="detail__erreur" role="alert">{erreurReponse}</p>}
              <button type="submit" className="home__ask" disabled={envoi}>
                {envoi ? "Publication…" : "Publier ma réponse"}
              </button>
            </form>
          </>
        )}
      </main>
      <Avis texte={avis} />
    </div>
  );
}
