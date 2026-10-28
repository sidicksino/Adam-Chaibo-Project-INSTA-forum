import { useState } from "react";
import "./LoginPage.css";   // styles communs (panneau gauche, boutons, champs)
import "./SignupPage.css";  // styles propres à l'inscription

/* ---------- Icônes ---------- */
const Icon = ({ children, size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);
const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" fill="currentColor" stroke="none" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" stroke="none" />
  </Icon>
);
const MailIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M4 8l8 6 8-6" />
  </Icon>
);
const LockIcon = () => (
  <Icon>
    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    <rect x="4" y="11" width="16" height="10" rx="3" fill="currentColor" stroke="none" />
  </Icon>
);
const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  </Icon>
);
const EyeOffIcon = () => (
  <Icon>
    <path d="M2 12s3.6-7 10-7c2 0 3.8.7 5.3 1.6M22 12s-3.6 7-10 7c-2 0-3.8-.7-5.3-1.6" />
    <path d="M3 3l18 18" />
  </Icon>
);
const ChevronIcon = () => (
  <Icon size={20}><path d="M6 9l6 6 6-6" /></Icon>
);
const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.5" fill="currentColor" stroke="none" />
    <path d="M2 20c0-3.8 3.1-6 7-6s7 2.2 7 6z" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="9" r="2.8" fill="currentColor" stroke="none" />
    <path d="M17 14.2c3 .2 5 2 5 5.8h-4.5" fill="currentColor" stroke="none" />
  </Icon>
);
const BookIcon = () => (
  <Icon>
    <path d="M2 5c4-1 7 0 10 2v13c-3-2-6-3-10-2z" fill="currentColor" stroke="none" />
    <path d="M22 5c-4-1-7 0-10 2v13c3-2 6-3 10-2z" fill="currentColor" stroke="none" />
  </Icon>
);
const UserPlusIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="4" fill="currentColor" stroke="none" />
    <path d="M1 21c0-4 3.6-7 8-7s8 3 8 7z" fill="currentColor" stroke="none" />
    <path d="M19 7v6M16 10h6" />
  </Icon>
);
const GradCap = () => (
  <svg width="120" height="76" viewBox="0 0 160 100" aria-hidden="true">
    <path d="M80 4 158 34 80 64 2 34Z" fill="#fff" />
    <path d="M34 54v24q46 20 92 0V54L80 74Z" fill="#fff" />
    <path d="M150 38v34" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    <rect x="145" y="70" width="10" height="18" rx="3" fill="#fff" />
  </svg>
);

/* ---------- Champ réutilisable ---------- */
function Field({ icon, error, right, children }) {
  return (
    <div className="field-wrap">
      <label className={`field${error ? " field--error" : ""}`}>
        <span className="field__icon">{icon}</span>
        {children}
        {right}
      </label>
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}

/* ---------- Validation ---------- */
const initial = {
  prenom: "", nom: "", username: "", email: "",
  profil: "", niveau: "", password: "", confirm: "", terms: false,
};

function validate(v) {
  const e = {};
  if (!v.prenom.trim()) e.prenom = "Entrez votre prénom.";
  if (!v.nom.trim()) e.nom = "Entrez votre nom.";
  if (v.username.trim().length < 3) e.username = "Au moins 3 caractères.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = "Adresse email invalide.";
  if (!v.profil) e.profil = "Choisissez votre profil.";
  if (v.profil === "etudiant" && !v.niveau) e.niveau = "Choisissez votre niveau.";
  if (v.password.length < 8) e.password = "Au moins 8 caractères.";
  if (v.confirm !== v.password) e.confirm = "Les mots de passe ne correspondent pas.";
  if (!v.terms) e.terms = "Vous devez accepter les conditions.";
  return e;
}

/* ---------- Page de création de compte ---------- */
export default function SignupPage({ onSubmit, onGoLogin }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "profil" && value !== "etudiant") next.niveau = "";
      return next;
    });
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      setLoading(true);
      const { confirm, terms, ...payload } = values;
      // À brancher sur votre API (ex. POST /api/auth/register)
      await onSubmit?.(payload);
    } catch (err) {
      setServerError(err?.message || "Impossible de créer le compte. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const isStudent = values.profil === "etudiant";

  return (
    <main className="login">
      {/* ===== Panneau gauche ===== */}
      <section className="login__brand">
        <div className="login__brand-top">
          <GradCap />
          <h1 className="login__title">INSTA-<span>FORUM</span></h1>
          <p className="login__subtitle">
            Rejoignez la communauté du forum de
            <br />
            résolution de problèmes informatiques
          </p>
          <hr className="login__divider" />
          <ul className="login__keywords">
            <li>Posez vos questions</li>
            <li>Partagez vos connaissances</li>
            <li>Progressez ensemble</li>
          </ul>
        </div>
        <div className="login__photo" role="img" aria-label="Bâtiment de l’INSTA">
          <p className="login__slogan">
            Ensemble pour
            <br />
            un meilleur apprentissage !
          </p>
        </div>
      </section>

      {/* ===== Panneau droit ===== */}
      <section className="login__panel">
        <form className="login__form login__form--signup" onSubmit={handleSubmit} noValidate>
          <h2>Créer un compte</h2>
          <p className="login__lead">Rejoignez la communauté et partagez vos connaissances.</p>

          <div className="row">
            <Field icon={<UserIcon />} error={errors.prenom}>
              <input type="text" placeholder="Prénom" autoComplete="given-name"
                value={values.prenom} onChange={set("prenom")} aria-label="Prénom" />
            </Field>
            <Field icon={<UserIcon />} error={errors.nom}>
              <input type="text" placeholder="Nom" autoComplete="family-name"
                value={values.nom} onChange={set("nom")} aria-label="Nom" />
            </Field>
          </div>

          <Field icon={<UserIcon />} error={errors.username}>
            <input type="text" placeholder="Nom d’utilisateur" autoComplete="username"
              value={values.username} onChange={set("username")} aria-label="Nom d’utilisateur" />
          </Field>

          <Field icon={<MailIcon />} error={errors.email}>
            <input type="email" placeholder="Adresse email" autoComplete="email"
              value={values.email} onChange={set("email")} aria-label="Adresse email" />
          </Field>

          <div className="row">
            <Field icon={<UsersIcon />} error={errors.profil} right={<ChevronIcon />}>
              <select value={values.profil} onChange={set("profil")} aria-label="Profil"
                className={values.profil ? "" : "is-empty"}>
                <option value="" disabled>Profil</option>
                <option value="etudiant">Étudiant</option>
                <option value="enseignant">Enseignant</option>
                <option value="personnel">Personnel</option>
              </select>
            </Field>
            <Field icon={<BookIcon />} error={errors.niveau} right={<ChevronIcon />}>
              <select value={values.niveau} onChange={set("niveau")} aria-label="Niveau"
                disabled={!isStudent} className={values.niveau ? "" : "is-empty"}>
                <option value="" disabled>{isStudent || !values.profil ? "Niveau" : "Non applicable"}</option>
                <option value="L1">Licence 1</option>
                <option value="L2">Licence 2</option>
                <option value="L3">Licence 3</option>
                <option value="M1">Master 1</option>
                <option value="M2">Master 2</option>
              </select>
            </Field>
          </div>

          <Field icon={<LockIcon />} error={errors.password}
            right={
              <button type="button" className="field__toggle" onClick={() => setShowPwd((s) => !s)}
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                {showPwd ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }>
            <input type={showPwd ? "text" : "password"} placeholder="Mot de passe" autoComplete="new-password"
              value={values.password} onChange={set("password")} aria-label="Mot de passe" />
          </Field>

          <Field icon={<LockIcon />} error={errors.confirm}
            right={
              <button type="button" className="field__toggle" onClick={() => setShowConfirm((s) => !s)}
                aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}>
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }>
            <input type={showConfirm ? "text" : "password"} placeholder="Confirmer le mot de passe"
              autoComplete="new-password" value={values.confirm} onChange={set("confirm")}
              aria-label="Confirmer le mot de passe" />
          </Field>

          <div className="terms-wrap">
            <label className="check check--top">
              <input type="checkbox" checked={values.terms} onChange={set("terms")} />
              <span>
                J’accepte les <a href="#conditions">conditions d’utilisation</a> et la{" "}
                <a href="#confidentialite">politique de confidentialité</a> du forum.
              </span>
            </label>
            {errors.terms && <p className="field__error" role="alert">{errors.terms}</p>}
          </div>

          {serverError && <p className="login__error" role="alert">{serverError}</p>}

          <button type="submit" className="btn btn--primary btn--signup" disabled={loading}>
            <UserPlusIcon />
            {loading ? "Création…" : "Créer mon compte"}
          </button>

          <p className="signup__switch">
            Vous avez déjà un compte ?{" "}
            <button type="button" className="link" onClick={onGoLogin}>Se connecter</button>
          </p>

          <p className="login__note">
            Uniquement pour les étudiants, enseignants
            <br />
            et le personnel de l’INSTA (département de génie informatique).
          </p>
        </form>
      </section>
    </main>
  );
}
