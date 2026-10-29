
import { useEffect, useState } from "react";
import "./AskQuestionPage.css";
import { listerCategories, lireQuestion } from "../api";

// Sert à poser une question, ou à la modifier quand questionId est fourni.
export default function AskQuestionPage({ questionId, user, onSubmit, onBack }) {
  const modification = Boolean(questionId);
  const [titre, setTitre] = useState("");
  const [categorie, setCategorie] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [categories, setCategories] = useState([]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  // En modification, le formulaire reste caché tant que la question n'est pas chargée
  const [pret, setPret] = useState(!modification);

  // Les catégories viennent du serveur (modifiables depuis l'administration Django)
  useEffect(() => {
    listerCategories()
      .then(setCategories)
      .catch((err) => setErreur(err.message));
  }, []);

  // Modification : on pré-remplit le formulaire avec la question existante
  useEffect(() => {
    if (!questionId) return;
    lireQuestion(questionId)
      .then((q) => {
        if (q.auteur.username !== user?.username) {
          setErreur("Seul l’auteur peut modifier cette question.");
          return;
        }
        setTitre(q.titre);
        setCategorie(String(q.categorie.id));
        setDescription(q.description);
        setTags(q.tags.join(", "));
        setPret(true);
      })
      .catch((err) => setErreur(err.message));
  }, [questionId, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur("");

    if (!titre.trim() || !categorie || !description.trim()) {
      setErreur("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    try {
      setEnvoi(true);
      await onSubmit({
        titre: titre.trim(),
        categorie_id: Number(categorie),
        description: description.trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
    } catch (err) {
      setErreur(err?.message || "Impossible d’enregistrer la question. Réessayez.");
      setEnvoi(false);
    }
  };

  return (
    <div className="question-page">
      <div className="question-container">
        <button className="retour-btn" onClick={onBack}>
          {modification ? "← Retour à la question" : "← Retour à l'accueil"}
        </button>

        <h1>{modification ? "Modifier la question" : "Poser une question"}</h1>
        <p className="question-intro">
          {modification
            ? "Corrigez ou complétez votre question. Les réponses déjà publiées sont conservées."
            : "Décrivez votre problème pour obtenir de l'aide de la communauté INSTA-FORUM."}
        </p>

        {!pret && !erreur && <p className="question-intro">Chargement de la question…</p>}
        {!pret && erreur && <p className="question-erreur" role="alert">{erreur}</p>}

        {pret && (
        <form onSubmit={handleSubmit} noValidate>
          <label>Titre de la question *</label>
          <input
            type="text"
            placeholder="Ex : Comment utiliser useState dans React ?"
            maxLength={200}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            required
          />

          <label>Catégorie *</label>
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            required
          >
            <option value="">Choisir une catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>

          <label>Description *</label>
          <textarea
            rows="7"
            placeholder="Expliquez votre problème en détail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />

          <label>Tags</label>
          <input
            type="text"
            placeholder="React, JavaScript, useState"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />

          {erreur && (
            <p className="question-erreur" role="alert">
              {erreur}
            </p>
          )}

          <div className="question-actions">
            <button
              type="button"
              className="annuler-btn"
              onClick={onBack}
            >
              Annuler
            </button>

            <button type="submit" className="publier-btn" disabled={envoi}>
              {modification
                ? (envoi ? "Enregistrement…" : "Enregistrer les modifications")
                : (envoi ? "Publication…" : "Publier la question")}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
