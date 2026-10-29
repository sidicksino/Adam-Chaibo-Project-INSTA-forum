import { useEffect, useMemo, useState } from "react";
import "./HomePage.css";
import { basculerFavori, listerCategories, listerQuestions, lireClassement, lireStatistiques } from "../api";
import { Avatar, Avis, MenuCompte, couleurPour, ilYA, nomCourt, pluriel, useAvis } from "../commun";


/* ---------- Icônes ---------- */
const Icon = ({ children, size = 20, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);
const I = {
  search: <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Icon>,
  home: <Icon><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></Icon>,
  question: <Icon><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></Icon>,
  folder: <Icon><path d="M3 6a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></Icon>,
  user: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></Icon>,
  star: <Icon><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></Icon>,
  etoilePleine: <Icon fill="currentColor"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></Icon>,
  trophy: <Icon><path d="M7 4h10v6a5 5 0 0 1-10 0zM12 15v4M8 20h8" /></Icon>,
  bell: <Icon><path d="M6 17h12c-2-1.5-2-4-2-7a4 4 0 0 0-8 0c0 3 0 5.5-2 7zM10 20a2 2 0 0 0 4 0" /></Icon>,
  plus: <Icon><path d="M12 5v14M5 12h14" /></Icon>,
  eye: <Icon size={16}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>,
  check: <Icon size={14}><path d="M4 12.5l5 5L20 6" /></Icon>,
  ampoule: (
    <Icon size={24}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" />
    </Icon>
  ),
};

/* Icônes du menu : contour au repos, pleine quand le menu est actif (comme dans le design) */
const ICONES_MENU = {
  "Accueil": [
    <Icon key="c" size={24}><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></Icon>,
    <Icon key="p" size={24} stroke="none" fill="currentColor"><path d="M11.3 2.4a1 1 0 0 1 1.4 0l8.9 8a1 1 0 0 1 .4.7V20a2 2 0 0 1-2 2h-4.5v-6.5h-5V22H4a2 2 0 0 1-2-2v-8.9a1 1 0 0 1 .4-.7z" /></Icon>,
  ],
  "Questions": [
    <Icon key="c" size={24}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></Icon>,
    <Icon key="p" size={24}><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" stroke="#fff" /></Icon>,
  ],
  "Catégories": [
    <Icon key="c" size={24}><path d="M3 6a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M3 10h18" /></Icon>,
    <Icon key="p" size={24} stroke="none" fill="currentColor"><path d="M2 6a2 2 0 0 1 2-2h5.5l2 3H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" /></Icon>,
  ],
  "Mes questions": [
    <Icon key="c" size={24}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></Icon>,
    <Icon key="p" size={24} stroke="none" fill="currentColor"><circle cx="12" cy="7.5" r="4.5" /><path d="M3 21c0-4.6 4-8 9-8s9 3.4 9 8z" /></Icon>,
  ],
  "Favoris": [
    <Icon key="c" size={24}><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></Icon>,
    <Icon key="p" size={24} fill="currentColor"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></Icon>,
  ],
  "Classement": [
    <Icon key="c" size={24}><path d="M7 4h10v6a5 5 0 0 1-10 0zM12 15v4M8 20h8" /></Icon>,
    <Icon key="p" size={24}><path d="M7 4h10v6a5 5 0 0 1-10 0z" fill="currentColor" /><path d="M12 15v4M8 20h8" /></Icon>,
  ],
};

/* Icônes des cartes de statistiques */
const IconeQuestions = () => (
  <Icon size={26} stroke="none" fill="currentColor"><circle cx="12" cy="7.5" r="4.5" /><path d="M3.5 21c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5z" /></Icon>
);
const IconeReponses = () => (
  <Icon size={26} stroke="none" fill="currentColor">
    <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M7 8h10M7 12h6" stroke="#c9eedb" strokeWidth="2" strokeLinecap="round" />
  </Icon>
);
const IconeMembres = ({ size = 26 }) => (
  <Icon size={size} stroke="none" fill="currentColor">
    <circle cx="9" cy="7.5" r="3.8" /><path d="M1.5 20c0-4 3.4-6.8 7.5-6.8s7.5 2.8 7.5 6.8z" />
    <circle cx="17.5" cy="8.5" r="3" /><path d="M17 13.3c3.3.2 5.5 2.6 5.5 5.7h-4.6" />
  </Icon>
);

const GradCap = () => (
  <svg width="44" height="28" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#1766f0" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#1766f0" />
    <path d="M150 38v30" stroke="#1766f0" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

/* Carte du bas du menu : groupe de personnes sur des vagues bleues */
const CarteCommunaute = () => (
  <div className="communaute">
    <span className="communaute__icone">
      <svg width="64" height="54" viewBox="0 0 64 54" aria-hidden="true" fill="currentColor">
        <path d="M14 6l3 4M50 6l-3 4M32 1v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="18" r="8" />
        <path d="M17 50c0-9 6.7-15 15-15s15 6 15 15z" />
        <circle cx="14" cy="24" r="6" opacity=".85" />
        <path d="M2 50c0-7 5.4-12 12-12 2.4 0 4.6.6 6.4 1.8C17.6 42.6 16 46 16 50z" opacity=".85" />
        <circle cx="50" cy="24" r="6" opacity=".85" />
        <path d="M62 50c0-7-5.4-12-12-12-2.4 0-4.6.6-6.4 1.8C46.4 42.6 48 46 48 50z" opacity=".85" />
      </svg>
    </span>
    <strong>Une communauté<br />étudiante et solidaire</strong>
    <span className="communaute__texte">Ensemble, on va plus loin !</span>
    <svg className="communaute__vagues" viewBox="0 0 240 120" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="vague-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcd3fb" /><stop offset="1" stopColor="#a5c3fa" />
        </linearGradient>
        <linearGradient id="vague-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5d9bf8" /><stop offset="1" stopColor="#1766f0" />
        </linearGradient>
      </defs>
      <path d="M0 50 C60 20 120 80 240 30 V120 H0z" fill="url(#vague-a)" opacity=".7" />
      <path d="M0 85 C70 55 150 110 240 70 V120 H0z" fill="url(#vague-b)" />
    </svg>
  </div>
);

/* ---------- Mise en forme des données reçues de l'API ---------- */
const extrait = (texte, max = 180) =>
  texte.length > max ? `${texte.slice(0, max).trimEnd()}…` : texte;

// Convertit une question de l'API au format attendu par l'affichage
const versCarte = (q) => ({
  id: q.id,
  votes: q.votes,
  answers: q.reponses,
  solved: q.resolue,
  title: q.titre,
  excerpt: extrait(q.description),
  description: q.description,
  tags: [q.categorie.nom, ...q.tags],
  categorieId: q.categorie.id,
  author: nomCourt(q.auteur),
  authorUsername: q.auteur.username,
  color: couleurPour(q.auteur.username),
  when: ilYA(q.date_creation),
  views: q.vues,
  favori: q.favori,
});

const MENU = ["Accueil", "Questions", "Catégories", "Mes questions", "Favoris", "Classement"];
const TABS = ["Récents", "Populaires", "Sans réponse", "Résolues"];

// Menus qui affichent une liste de questions (les autres ont leur propre affichage)
const VUES_LISTE = ["Accueil", "Questions", "Mes questions", "Favoris"];

const ENTETES = {
  "Questions": ["Toutes les questions", "Parcourez les questions posées par la communauté."],
  "Mes questions": ["Mes questions", "Les questions que vous avez posées sur le forum."],
  "Favoris": ["Mes favoris", "Les questions que vous avez mises de côté avec l’étoile."],
  "Catégories": ["Catégories", "Choisissez un thème pour voir ses questions."],
  "Classement": ["Classement", "Les membres qui aident le plus la communauté."],
};

/* ---------- Page d'accueil ---------- */
// vue = { menu, categorie } : gardée par App pour la retrouver au retour d'une question
export default function HomePage({ user, vue, onChangerVue, onLogout, onAskQuestion, onOpenQuestion }) {
  const { menu, categorie: categorieFiltre } = vue;
  // « Sidick Abdoulaye » dans la bannière, comme dans le design
  const nomComplet = `${user?.prenom ?? ""} ${user?.nom ?? ""}`.trim();
  const [tab, setTab] = useState("Récents");
  const [query, setQuery] = useState("");
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({ questions: 0, reponses: 0, membres: 0, contributeurs: [] });
  const [classement, setClassement] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [erreurClassement, setErreurClassement] = useState("");
  const [avis, afficherAvis] = useAvis();

  // Chargement des questions, catégories et statistiques depuis Django
  const charger = () => {
    setChargement(true);
    setErreur("");
    Promise.all([listerQuestions(), listerCategories(), lireStatistiques()])
      .then(([q, c, s]) => {
        setQuestions(q.map(versCarte));
        setCategories(c);
        setStats(s);
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  };

  useEffect(charger, []);

  // Le classement n'est chargé que lorsqu'on ouvre ce menu
  useEffect(() => {
    if (menu === "Classement" && !classement && !erreurClassement) {
      lireClassement().then(setClassement).catch((err) => setErreurClassement(err.message));
    }
  }, [menu, classement, erreurClassement]);

  // Changer de menu (y compris avec le bouton Retour du navigateur) remet l'onglet « Récents »
  useEffect(() => setTab("Récents"), [menu, categorieFiltre]);

  const changerMenu = (nouveau, categorie = null) => onChangerVue({ menu: nouveau, categorie });

  // Une recherche depuis « Catégories » ou « Classement » bascule vers la liste des questions
  const rechercher = (texte) => {
    setQuery(texte);
    if (texte && !VUES_LISTE.includes(menu)) changerMenu("Questions");
  };

  const handleFavori = async (id) => {
    try {
      const { favori } = await basculerFavori(id);
      setQuestions((liste) => liste.map((q) => (q.id === id ? { ...q, favori } : q)));
    } catch (err) {
      afficherAvis(err.message);
    }
  };

  const list = useMemo(() => {
    let items = [...questions];
    if (menu === "Mes questions") items = items.filter((q) => q.authorUsername === user?.username);
    if (menu === "Favoris") items = items.filter((q) => q.favori);
    if (menu === "Questions" && categorieFiltre) items = items.filter((q) => q.categorieId === categorieFiltre);

    if (tab === "Populaires") items.sort((a, b) => b.votes - a.votes);
    if (tab === "Sans réponse") items = items.filter((q) => q.answers === 0);
    if (tab === "Résolues") items = items.filter((q) => q.solved);
    // La recherche porte sur le titre, la description, les tags et l'auteur
    const s = query.trim().toLowerCase();
    if (s) {
      items = items.filter((q) =>
        [q.title, q.description, q.author, ...q.tags].some((texte) => texte.toLowerCase().includes(s))
      );
    }
    return items;
  }, [questions, menu, categorieFiltre, user, tab, query]);

  // Message adapté quand la liste est vide
  const messageVide = () => {
    if (query.trim() || tab !== "Récents") return "Aucune question ne correspond. Essayez un autre filtre ou une autre recherche.";
    if (menu === "Mes questions") return "Vous n’avez pas encore posé de question.";
    if (menu === "Favoris") return "Aucun favori pour le moment. Cliquez sur l’étoile d’une question pour la retrouver ici.";
    if (menu === "Questions" && categorieFiltre) return "Aucune question dans cette catégorie pour le moment.";
    return "Aucune question pour le moment. Soyez le premier à poser une question !";
  };

  const [titreVue, sousTitreVue] = ENTETES[menu] ?? [];

  return (
    <div className="home">
      {/* ===== Barre du haut ===== */}
      <header className="home__nav">
        <a className="home__logo" href="#/">
          <GradCap />
          <span>INSTA-<b>FORUM</b></span>
        </a>

        <label className="home__search">
          {I.search}
          <input type="search" placeholder="Rechercher une question, un sujet…"
            value={query} onChange={(e) => rechercher(e.target.value)} aria-label="Rechercher" />
        </label>

        <div className="home__actions">
          <button className="home__ask" onClick={onAskQuestion} aria-label="Poser une question">
            {/* Le texte est masqué sur téléphone (voir HomePage.css) : seul le « + » reste */}
            {I.plus} <span>Poser une question</span>
          </button>
          <button className="home__icon-btn" aria-label="Notifications" title="Notifications"
            onClick={() => afficherAvis("Les notifications ne sont pas encore disponibles.")}>
            {I.bell}
          </button>
          <MenuCompte user={user} onLogout={onLogout} />
        </div>
      </header>

      <div className="home__body">
        {/* ===== Menu gauche ===== */}
        <aside className="card home__menu" aria-label="Navigation">
          {MENU.map((label) => (
            <button key={label}
              className={`home__menu-item${menu === label ? " is-active" : ""}`}
              aria-current={menu === label ? "page" : undefined}
              onClick={() => changerMenu(label)}>
              {ICONES_MENU[label][menu === label ? 1 : 0]}<span>{label}</span>
            </button>
          ))}
          <CarteCommunaute />
        </aside>

        {/* ===== Fil principal ===== */}
        <main className="home__main">
          {menu === "Accueil" ? (
            <>
              <section className="home__hero">
                <h1>Bienvenue{nomComplet ? `, ${nomComplet}` : ""} sur INSTA-FORUM</h1>
                <p>Posez vos questions, partagez vos connaissances et progressez ensemble.</p>
                {/* Illustration générée avec Google Flow (fond détouré) */}
                <img className="home__hero-image" src="/images/banniere-idees.png" alt="" />
              </section>

              <ul className="stats" aria-label="Statistiques du forum">
                <li className="is-bleu">
                  <span className="stats__icone"><IconeQuestions /></span>
                  <div><strong>{stats.questions}</strong><span>question{stats.questions > 1 ? "s" : ""}</span></div>
                </li>
                <li className="is-vert">
                  <span className="stats__icone"><IconeReponses /></span>
                  <div><strong>{stats.reponses}</strong><span>réponse{stats.reponses > 1 ? "s" : ""}</span></div>
                </li>
                <li className="is-violet">
                  <span className="stats__icone"><IconeMembres /></span>
                  <div><strong>{stats.membres}</strong><span>membre{stats.membres > 1 ? "s" : ""}</span></div>
                </li>
              </ul>
            </>
          ) : (
            <section className="home__entete">
              <h1>{titreVue}</h1>
              <p>{sousTitreVue}</p>
            </section>
          )}

          {/* Filtre par catégorie (menu « Questions ») */}
          {menu === "Questions" && (
            <div className="home__filtres" aria-label="Filtrer par catégorie">
              <button className={!categorieFiltre ? "is-active" : ""} onClick={() => changerMenu("Questions")}>
                Toutes
              </button>
              {categories.map((c) => (
                <button key={c.id} className={categorieFiltre === c.id ? "is-active" : ""}
                  onClick={() => changerMenu("Questions", c.id)}>
                  <i style={{ background: c.couleur }} />{c.nom}
                </button>
              ))}
            </div>
          )}

          {erreur && (
            <div className="card home__empty" role="alert">
              {erreur}
              <button type="button" className="home__ask home__empty-action" onClick={charger}>Réessayer</button>
            </div>
          )}

          {/* ===== Listes de questions ===== */}
          {VUES_LISTE.includes(menu) && (
            <>
              <div className="home__tabs" role="tablist">
                {TABS.map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t}
                    className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
                    {t}
                  </button>
                ))}
              </div>

              {chargement && <div className="card home__empty">Chargement des questions…</div>}

              {!chargement && !erreur && list.length === 0 && (
                <div className="card home__empty">
                  {messageVide()}
                  {menu === "Mes questions" && !query && tab === "Récents" && (
                    <button className="home__ask home__empty-action" onClick={onAskQuestion}>
                      {I.plus} Poser une question
                    </button>
                  )}
                </div>
              )}

              {list.map((q) => (
                <article key={q.id} className="card question">
                  <div className="question__stats">
                    <div className="question__votes">
                      <strong>{q.votes}</strong><span>{Math.abs(q.votes) > 1 ? "votes" : "vote"}</span>
                    </div>
                    <span className={`question__answers${q.solved ? " is-solved" : q.answers === 0 ? " is-empty" : ""}`}>
                      {q.solved && I.check}{q.answers} rép.
                    </span>
                  </div>

                  <div className="question__content">
                    <div className="question__ligne-titre">
                      <h2>
                        <button type="button" className="question__lien" onClick={() => onOpenQuestion(q.id)}>
                          {q.title}
                        </button>
                      </h2>
                      <button type="button" className={`etoile${q.favori ? " is-active" : ""}`}
                        onClick={() => handleFavori(q.id)} aria-pressed={q.favori}
                        title={q.favori ? "Retirer des favoris" : "Ajouter aux favoris"}
                        aria-label={q.favori ? "Retirer des favoris" : "Ajouter aux favoris"}>
                        {q.favori ? I.etoilePleine : I.star}
                      </button>
                    </div>
                    <p>{q.excerpt}</p>
                    <div className="question__tags">
                      {q.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                    <div className="question__meta">
                      <Avatar name={q.author} color={q.color} size={24} />
                      <span className="question__author">{q.author}</span>
                      <span>•</span><span>{q.when}</span>
                      <span>•</span>{I.eye}<span>{pluriel(q.views, "vue")}</span>
                    </div>
                  </div>
                </article>
              ))}
            </>
          )}

          {/* ===== Catégories ===== */}
          {menu === "Catégories" && (
            <div className="cats-grille">
              {categories.map((c) => (
                <button key={c.id} className="card cats-grille__carte" onClick={() => changerMenu("Questions", c.id)}
                  style={{ borderTopColor: c.couleur }}>
                  <strong>{c.nom}</strong>
                  <span>{pluriel(c.nb_questions, "question")}</span>
                </button>
              ))}
            </div>
          )}

          {/* ===== Classement ===== */}
          {menu === "Classement" && (
            <section className="card classement">
              {!classement && !erreurClassement && <p className="home__empty">Chargement du classement…</p>}
              {erreurClassement && (
                <div className="home__empty" role="alert">
                  {erreurClassement}
                  <button type="button" className="home__ask home__empty-action"
                    onClick={() => setErreurClassement("")}>Réessayer</button>
                </div>
              )}
              {classement && (
                <>
                  <p className="classement__bareme">
                    Barème : question {classement.bareme.question} pts · réponse {classement.bareme.reponse} pts ·
                    réponse acceptée +{classement.bareme.acceptee} pts · chaque vote reçu ±1 pt
                  </p>
                  {classement.membres.length === 0 ? (
                    <p className="home__empty">Personne n’a encore participé. Soyez le premier !</p>
                  ) : (
                    <div className="classement__defilement">
                      <table>
                        <thead>
                          <tr>
                            <th>Rang</th><th>Membre</th><th>Questions</th><th>Réponses</th>
                            <th>Acceptées</th><th>Votes reçus</th><th>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classement.membres.map((m) => (
                            <tr key={m.username} className={m.username === user?.username ? "is-moi" : ""}>
                              <td className="classement__rang">{m.rang <= 3 ? ["🥇", "🥈", "🥉"][m.rang - 1] : m.rang}</td>
                              <td>
                                <span className="classement__membre">
                                  <Avatar name={`${m.prenom} ${m.nom}`} color={couleurPour(m.username)} size={28} />
                                  {nomCourt(m)}{m.username === user?.username && " (vous)"}
                                </span>
                              </td>
                              <td>{m.questions}</td>
                              <td>{m.reponses}</td>
                              <td>{m.acceptees}</td>
                              <td>{m.votes_recus}</td>
                              <td><strong>{m.points}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </main>

        {/* ===== Colonne droite ===== */}
        <aside className="home__side">
          <section className="card">
            <h3>Catégories</h3>
            <ul className="cats">
              {categories.map((c) => (
                <li key={c.id}>
                  <button type="button" className="cats__lien" onClick={() => changerMenu("Questions", c.id)}>
                    <span><i style={{ background: c.couleur }} />{c.nom}</span>
                    <em>{c.nb_questions}</em>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Classement par nombre de réponses publiées */}
          {stats.contributeurs.length > 0 && (
            <section className="card">
              <h3>Meilleurs contributeurs</h3>
              <ul className="top">
                {stats.contributeurs.map((m) => (
                  <li key={m.username}>
                    <Avatar name={`${m.prenom} ${m.nom}`} color={couleurPour(m.username)} />
                    <div>
                      <strong>{nomCourt(m)}</strong>
                      <small>{pluriel(m.nb_reponses, "réponse")}</small>
                    </div>
                    <span className="top__trophy">{I.trophy}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card tip">
            <h3>{I.ampoule}Besoin d’aide ?</h3>
            <p>Décrivez votre problème avec un exemple de code et le message d’erreur pour obtenir une réponse plus vite.</p>
          </section>
        </aside>
      </div>
      <Avis texte={avis} />
    </div>
  );
}
