import { useEffect, useRef, useState } from "react";
import "./HomePage.css";      // styles communs (barre du haut, cartes, tags, avatars)
import "./QuestionPage.css";  // styles propres à cette page
import {
  accepterReponse, basculerFavori, listerReponses, lireQuestion, publierReponse, voterQuestion, voterReponse,
} from "../api";
import { Avatar, couleurPour, ilYA, nomCourt, pluriel } from "../commun";

const GradCap = () => (
  <svg width="40" height="26" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#0b5ed7" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#0b5ed7" />
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

/* ---------- Page de détail d'une question ---------- */
export default function QuestionPage({ id, user, onBack, onLogout }) {
  const [question, setQuestion] = useState(null);
  const [reponses, setReponses] = useState([]);
  const [erreur, setErreur] = useState("");
  const [contenu, setContenu] = useState("");
  const [erreurReponse, setErreurReponse] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // En développement, React exécute useEffect deux fois : ce repère évite de compter deux vues.
  const dejaCharge = useRef(null);

  useEffect(() => {
    if (dejaCharge.current === id) return;
    dejaCharge.current = id;

    Promise.all([lireQuestion(id), listerReponses(id)])
      .then(([q, r]) => {
        setQuestion(q);
        setReponses(r);
      })
      .catch((err) => setErreur(err.message));
  }, [id]);

  const estAuteur = question && user && question.auteur.username === user.username;

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
      alert(err.message);
    }
  };

  // Le serveur renvoie le nouveau score et notre vote : on met à jour sans recharger la page.
  const handleVoterQuestion = async (valeur) => {
    try {
      const { votes, mon_vote } = await voterQuestion(id, valeur);
      setQuestion((q) => ({ ...q, votes, mon_vote }));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFavori = async () => {
    try {
      const { favori } = await basculerFavori(id);
      setQuestion((q) => ({ ...q, favori }));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVoterReponse = async (reponse, valeur) => {
    try {
      const { votes, mon_vote } = await voterReponse(reponse.id, valeur);
      // L'ordre n'est pas modifié tout de suite pour que la réponse ne « saute » pas sous la souris.
      setReponses((liste) => liste.map((r) => (r.id === reponse.id ? { ...r, votes, mon_vote } : r)));
    } catch (err) {
      alert(err.message);
    }
  };

  const fullName = user ? `${user.prenom ?? ""} ${user.nom ?? ""}`.trim() : "Invité";

  return (
    <div className="home">
      {/* ===== Barre du haut ===== */}
      <header className="home__nav">
        <a className="home__logo" href="/" onClick={(e) => { e.preventDefault(); onBack(); }}>
          <GradCap />
          <span>INSTA-<b>FORUM</b></span>
        </a>
        <button className="home__avatar-btn" onClick={onLogout} title="Se déconnecter" aria-label="Se déconnecter">
          <Avatar name={fullName} size={44} />
        </button>
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
                <span>•</span><span>{pluriel(question.vues, "vue")}</span>
              </div>

              <p className="detail__texte">{question.description}</p>

              <div className="question__tags">
                <span className="tag">{question.categorie.nom}</span>
                {question.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
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
                <p className="detail__texte">{r.contenu}</p>
                <div className="detail__pied">
                  <div className="question__meta">
                    <Avatar name={`${r.auteur.prenom} ${r.auteur.nom}`}
                      color={couleurPour(r.auteur.username)} size={24} />
                    <span className="question__author">{nomCourt(r.auteur)}</span>
                    <span>•</span><span>{ilYA(r.date_creation)}</span>
                  </div>
                  {/* Seul l'auteur de la question peut choisir la bonne réponse */}
                  {estAuteur && (
                    <button type="button" className="detail__accepter" onClick={() => handleAccepter(r)}>
                      {r.acceptee ? "Retirer l’acceptation" : "Accepter cette réponse"}
                    </button>
                  )}
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
    </div>
  );
}
