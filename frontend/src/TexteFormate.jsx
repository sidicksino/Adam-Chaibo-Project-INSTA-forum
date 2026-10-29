
import { useState } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import "highlight.js/styles/github-dark.css";
import "./TexteFormate.css";

const LANGAGES = { bash, c, cpp, csharp, css, java, javascript, json, php, python, sql, typescript, xml };
Object.entries(LANGAGES).forEach(([nom, definition]) => hljs.registerLanguage(nom, definition));

const NOMS = {
  bash: "Terminal", c: "C", cpp: "C++", csharp: "C#", css: "CSS", java: "Java", javascript: "JavaScript",
  json: "JSON", php: "PHP", python: "Python", sql: "SQL", typescript: "TypeScript", xml: "HTML",
};

const BLOC = /```[ \t]*([\w+#.-]*)[ \t]*\r?\n([\s\S]*?)\r?\n?```/g;
const EN_LIGNE = /`([^`\n]+)`/g;

function decouper(texte) {
  const morceaux = [];
  let position = 0;
  for (const correspondance of texte.matchAll(BLOC)) {
    if (correspondance.index > position) {
      morceaux.push({ type: "texte", contenu: texte.slice(position, correspondance.index) });
    }
    morceaux.push({ type: "code", langage: correspondance[1].toLowerCase(), contenu: correspondance[2] });
    position = correspondance.index + correspondance[0].length;
  }
  if (position < texte.length) morceaux.push({ type: "texte", contenu: texte.slice(position) });
  return morceaux;
}

function TexteAvecCodeEnLigne({ contenu }) {
  const parties = contenu.split(EN_LIGNE);
  return parties.map((partie, i) =>
    i % 2 === 1 ? <code key={i} className="code-en-ligne">{partie}</code> : partie
  );
}

function BlocCode({ langage, contenu }) {
  const [copie, setCopie] = useState(false);
  const code = contenu.replace(/\s+$/, "");

  const definition = langage && hljs.getLanguage(langage);
  const resultat = definition
    ? hljs.highlight(code, { language: langage, ignoreIllegals: true })
    : hljs.highlightAuto(code);
  const nom = definition ? NOMS[Object.keys(LANGAGES).find((n) => hljs.getLanguage(n) === definition)] : "Code";

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const zone = document.createElement("textarea");
      zone.value = code;
      zone.setAttribute("readonly", "");
      zone.style.position = "fixed";
      zone.style.opacity = "0";
      document.body.appendChild(zone);
      zone.select();
      const reussi = document.execCommand("copy");
      zone.remove();
      if (!reussi) return;
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  return (
    <div className="bloc-code">
      <div className="bloc-code__barre">
        <span>{nom}</span>
        <button type="button" onClick={copier}>{copie ? "✓ Copié" : "Copier"}</button>
      </div>
      <pre><code className="hljs" dangerouslySetInnerHTML={{ __html: resultat.value }} /></pre>
    </div>
  );
}

export default function TexteFormate({ texte, className = "" }) {
  return (
    <div className={`texte-formate ${className}`}>
      {decouper(texte).map((morceau, i) =>
        morceau.type === "code" ? (
          <BlocCode key={i} langage={morceau.langage} contenu={morceau.contenu} />
        ) : (
          <p key={i}><TexteAvecCodeEnLigne contenu={morceau.contenu.replace(/^\n+|\n+$/g, "")} /></p>
        )
      )}
    </div>
  );
}

export const sansMiseEnForme = (texte) =>
  texte
    .replace(BLOC, (_, _langage, code) => ` ${code.replace(/\s+/g, " ").trim()} `)
    .replace(EN_LIGNE, "$1")
    .replace(/\s+/g, " ")
    .trim();

export function insererBlocCode(zone, valeur, setValeur) {
  const debut = zone.selectionStart;
  const fin = zone.selectionEnd;
  const selection = valeur.slice(debut, fin);
  const avant = debut > 0 && valeur[debut - 1] !== "\n" ? "\n" : "";
  const bloc = `${avant}\`\`\`\n${selection}\n\`\`\`\n`;
  const curseur = debut + avant.length + 4;
  const placerCurseur = () => zone.setSelectionRange(curseur, curseur + selection.length);

  zone.focus();
  if (document.execCommand("insertText", false, bloc)) {
    placerCurseur();
    return;
  }
  setValeur(valeur.slice(0, debut) + bloc + valeur.slice(fin));
  requestAnimationFrame(() => setTimeout(placerCurseur, 0));
}

export function OutilCode({ zone, valeur, setValeur }) {
  return (
    <div className="outil-code">
      <button type="button" onMouseDown={(e) => e.preventDefault()}
        onClick={() => insererBlocCode(zone.current, valeur, setValeur)}
        title="Insérer un bloc de code (ou entourer le texte sélectionné)">
        &lt;/&gt; Code
      </button>
      <small>
        Le code s’affiche en couleur. Indiquez le langage après les accents : ```python, ```java, ```sql…
      </small>
    </div>
  );
}
