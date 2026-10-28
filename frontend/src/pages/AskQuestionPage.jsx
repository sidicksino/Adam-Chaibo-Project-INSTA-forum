
import { useEffect, useState } from "react";
import "./AskQuestionPage.css";
import { listerCategories } from "../api";

export default function AskQuestionPage({ onSubmit, onBack }) {
  const [titre, setTitre] = useState("");
  const [categorie, setCategorie] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [categories, setCategories] = useState([]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Les catégories viennent du serveur (modifiables depuis l'administration Django)
  useEffect(() => {
    listerCategories()
      .then(setCategories)
      .catch((err) => setErreur(err.message));
  }, []);

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
      setErreur(err?.message || "Impossible de publier la question. Réessayez.");
      setEnvoi(false);
    }
  };

  return (
    <div className="question-page">
      <div className="question-container">
        <button className="retour-btn" onClick={onBack}>
          ← Retour à l'accueil
        </button>

        <h1>Poser une question</h1>
        <p className="question-intro">
          Décrivez votre problème pour obtenir de l'aide
          de la communauté INSTA-FORUM.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label>Titre de la question *</label>
          <input
            type="text"
            placeholder="Ex : Comment utiliser useState dans React ?"
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
              {envoi ? "Publication…" : "Publier la question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
