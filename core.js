// core.js
let config = null;
let jmIndex = null;
let jpDict = null;
let enDict = null;

const stopwords = new Set([
  "is", "it", "a", "an", "the", "and", "or", "but", "to",
  "in", "on", "of", "at", "with", "for", "as", "by"
]);

async function loadConfig() {
  if (config) return config;
  const res = await fetch('./config.json');
  config = await res.json();
  console.log(`Loaded language: ${config.language}`);
  return config;
}

async function loadLocalJMDict() {
  if (!jpDict) jpDict = await fetch('./jmdict.json').then(r => r.json());
  if (!jmIndex) jmIndex = buildJMDictIndex(jpDict.words);
  return jpDict.words;
}

async function loadLocalENDict() {
  if (!enDict) enDict = await fetch('./dictionary.json').then(r => r.json());
  return enDict;
}

function buildJMDictIndex(entries) {
  const byKanji = new Map();
  const byKana = new Map();

  for (const e of entries) {
    for (const k of e.kanji || []) if (k?.text) byKanji.set(k.text, e);
    for (const k of e.kana || []) if (k?.text) byKana.set(k.text, e);
  }
  return { byKanji, byKana };
}

function formatJP(entry, fallbackTerm) {
  if (!entry) return "No definition found in local JMdict.";

  const head =
    entry.kanji?.find(k => k.common)?.text ||
    entry.kanji?.[0]?.text ||
    entry.kana?.[0]?.text ||
    fallbackTerm;

  const reading = entry.kana?.[0]?.text ? `（${entry.kana[0].text}）` : "";

  // Collect up to 3 English glosses
  const glosses = [];
  for (const s of entry.sense || []) {
    for (const g of s.gloss || []) {
      if (g.lang === "eng" && g.text) glosses.push(g.text);
    }
  }

  const defs = glosses.slice(0, 3).join(", ");
  return `<strong>${head}${reading}</strong>: ${defs || "No English gloss"}`;
}

function findJP(term) {
  if (!jmIndex) return null;

  // 1) Exact match (kanji or kana)
  if (jmIndex.byKanji.has(term)) return jmIndex.byKanji.get(term);
  if (jmIndex.byKana.has(term)) return jmIndex.byKana.get(term);

  // 2) Fallback: first entry containing the term
  const entries = jpDict.words;
  return (
    entries.find(
      e =>
        e.kanji?.some(k => k.text?.includes(term)) ||
        e.kana?.some(k => k.text?.includes(term))
    ) || null
  );
}

function lookupJP(term) {
  const entry = findJP(term);
    const definitionText = entry
        ? formatJP(entry, term)
        : "No definition found in local JMdict.";
    return definitionText
}

function lookupEN(term) {
    const def = enDict[term.toUpperCase()] || null;
    const definitionText = def
          ? `<strong>${term}</strong>: ${def}`
          : "No definition found in local English dictionary.";
    return definitionText
}

config = await loadConfig()
jpDict = await loadLocalJMDict();
enDict = await loadLocalENDict();

let nlp = null;        // English NLP (Compromise)
let tokenizer = null;  // Japanese tokenizer (Kuromoji)

if (config.language === "en") {
  const module = await import("https://esm.sh/compromise");
  nlp = module.default;

  console.log("Compromise module ready!");
} else if (config.language === "ja") {
  // Load Kuromoji tokenizer dynamically
  const kuromoji = await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js";
    script.onload = () => resolve(window.kuromoji);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  tokenizer = await new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict" })
      .build((err, t) => (err ? reject(err) : resolve(t)));
  });

  console.log("Kuromoji tokenizer ready!");
}

export { config, lookupJP, lookupEN, stopwords, nlp, tokenizer };
