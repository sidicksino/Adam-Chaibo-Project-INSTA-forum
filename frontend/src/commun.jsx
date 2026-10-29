/* ---------- Outils partagés entre les pages ---------- */
import { useCallback, useEffect, useRef, useState } from "react";

const COULEURS = ["#7c5cfc", "#0e9f6e", "#e5484d", "#f59e0b", "#0b5ed7", "#0891b2"];

// Une couleur d'avatar stable pour chaque utilisateur
export const couleurPour = (username = "") =>
  COULEURS[[...username].reduce((somme, c) => somme + c.charCodeAt(0), 0) % COULEURS.length];

// « Awa D. » à partir du prénom et du nom
export const nomCourt = (a) =>
  a.prenom ? `${a.prenom} ${a.nom ? `${a.nom[0]}.` : ""}`.trim() : a.username;

// « il y a 5 minutes », « hier »…
const formatRelatif = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
export function ilYA(date) {
  const secondes = Math.round((new Date(date) - Date.now()) / 1000);
  const unites = [["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unite, duree] of unites) {
    if (Math.abs(secondes) >= duree) return formatRelatif.format(Math.round(secondes / duree), unite);
  }
  return "à l’instant";
}

// « 1 réponse », « 3 réponses »
export const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

const initiales = (nom = "") =>
  nom.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

// Pastille ronde avec les initiales (style .avatar dans HomePage.css)
export const Avatar = ({ name, color = "#0b5ed7", size = 36 }) => (
  <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
    {initiales(name)}
  </span>
);

/* ---------- Message temporaire en bas de l'écran (remplace alert()) ---------- */
// const [avis, afficherAvis] = useAvis();  puis  afficherAvis("Texte")  et  <Avis texte={avis} />
export function useAvis(duree = 4000) {
  const [avis, setAvis] = useState("");
  const minuteur = useRef(null);

  const afficherAvis = useCallback((texte) => {
    setAvis(texte);
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setAvis(""), duree);
  }, [duree]);

  useEffect(() => () => clearTimeout(minuteur.current), []);
  return [avis, afficherAvis];
}

export const Avis = ({ texte }) =>
  texte ? <div className="avis" role="alert">{texte}</div> : null;

/* ---------- Menu du compte (clic sur l'avatar en haut à droite) ---------- */
const PROFILS = { etudiant: "Étudiant", enseignant: "Enseignant", personnel: "Personnel" };

export function MenuCompte({ user, onLogout }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  const nomComplet = `${user?.prenom ?? ""} ${user?.nom ?? ""}`.trim() || user?.username || "Invité";

  // Fermer le menu en cliquant ailleurs ou avec la touche Échap
  useEffect(() => {
    if (!ouvert) return;
    const clicDehors = (e) => { if (!zone.current?.contains(e.target)) setOuvert(false); };
    const echap = (e) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("mousedown", clicDehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", clicDehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  return (
    <div className="compte" ref={zone}>
      <button type="button" className="home__avatar-btn" onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu" aria-expanded={ouvert} aria-label="Mon compte">
        <Avatar name={nomComplet} color={couleurPour(user?.username)} size={46} />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ transform: ouvert ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {ouvert && (
        <div className="compte__menu card" role="menu">
          <div className="compte__identite">
            <strong>{nomComplet}</strong>
            <span>@{user?.username}</span>
            <span>
              {PROFILS[user?.profil] ?? ""}{user?.niveau ? ` · ${user.niveau}` : ""}
            </span>
          </div>
          <button type="button" role="menuitem" className="compte__deconnexion" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
