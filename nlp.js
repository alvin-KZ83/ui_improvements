/* =========================================================
   CONFIGURATION AND DICTIONARY LOADING
   ========================================================= */

import { config, lookupJP, lookupEN, stopwords, nlp, tokenizer } from "./core.js";

/* =========================================================
   MAIN FUNCTION: ANALYZE SENTENCE AND CREATE SUB-NOTES
   ========================================================= */

/**
 * Given a keyword chip, analyze its text and create related sub-notes.
 * Each sub-note can be clicked to open a definition popup.
 */
async function analyzeSentenceAndCreateSubBoxes(parentBox, noteArea) {
  const rawtext = parentBox.textContent.trim();
  if (!rawtext) return;

  // Trim the text to remove initial timestamp (e.g. [00:00])
  const text = rawtext.slice(8).trim();

  let results;

  /* --- English Processing --- */
  if (config.language === "en") {
    const tokens = text.split(" ").slice(0, 6);
    results = tokens.filter(t => !stopwords.has(t));
  }

  /* --- Japanese Processing --- */
  else if (config.language === "ja") {
    const tokens = tokenizer.tokenize(text);
    const filtered = tokens.filter(
      t => !["助詞", "助動詞", "記号"].includes(t.pos)
    );
    results = filtered.map(t => t.surface_form);
  }

  // Remove any previous sub-container
  const existing = parentBox.querySelector(".sub-container");
  if (existing) existing.remove();

  // Create container for sub-notes
  const subContainer = document.createElement("div");
  subContainer.className = "sub-container";

  /* --- Generate Sub-Notes --- */
  results.forEach((term) => {
    const subBox = document.createElement("div");
    subBox.className = "keyword-chip sub-note";
    subBox.textContent = term;
    subBox.style.borderColor = "#999";

    /* --- Click: Show definition popup --- */
    subBox.addEventListener("click", async (e) => {
      e.stopPropagation();
      const term = subBox.textContent.trim();

      // Toggle existing popup for this term
      const existingPopup = noteArea.querySelector(`.def-popup[data-term="${term}"]`);
      if (existingPopup) {
        existingPopup.remove();
        return;
      }

      // Remove any other active definition popups
      noteArea.querySelectorAll(".def-popup").forEach(p => p.remove());

      const rect = subBox.getBoundingClientRect();
      const noteRect = noteArea.getBoundingClientRect();

      // Default definition message
      let definitionText = "No definition found.";

      definitionText = (config.language === "en") ? lookupEN(term.toUpperCase()) : lookupJP(term);
      /* --- English definition lookup --- */
      if (config.language === "en") {
        definitionText = lookupEN(term.toUpperCase());
      }
      /* --- Japanese definition lookup --- */
      else if (config.language === "ja") {
        definitionText = lookupJP(term);
      }

      // Create popup element
      const popup = document.createElement("div");
      popup.className = "def-popup";
      popup.dataset.term = term;
      popup.innerHTML = `<p>${definitionText}</p>`;

      // Position popup below sub-note
      const centerX = rect.left + rect.width / 2 - noteRect.left;
      const topY = rect.bottom - noteRect.top + 8;
      popup.style.left = `${centerX}px`;
      popup.style.top = `${topY}px`;

      noteArea.appendChild(popup);
    });

    subContainer.appendChild(subBox);
  });

  parentBox.appendChild(subContainer);
}

/* =========================================================
   EXPORTS
   ========================================================= */
export { analyzeSentenceAndCreateSubBoxes };
