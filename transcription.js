/* =========================================================
   CONFIGURATION LOADING
   ========================================================= */

import { config, stopwords, nlp, tokenizer } from "./core.js";

/* =========================================================
   SPEECH RECOGNITION INITIALIZATION
   ========================================================= */

// Initialize Web Speech API (Chrome / Edge)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

// Configure recognition behavior
recognition.continuous = true;        // Keep listening until manually stopped
recognition.interimResults = true;    // Provide live (non-final) results
recognition.lang = config.languages[config.language].speechLang;

/* =========================================================
   TRANSCRIPTION STATE MANAGEMENT
   ========================================================= */

// Persistent transcript and metadata
let finalTranscript = "";             // Stores finalized text
let transcriptSegments = [];          // [{ time, text }] for metadata export

// DOM reference for transcript output
const transcriptContainer = document.getElementById("live-transcript");

// Create an italic “interim” span for live partial text
let interimSpan = document.createElement("span");
interimSpan.id = "interim-span";
interimSpan.style.opacity = "0.6";
interimSpan.style.fontStyle = "italic";
transcriptContainer.appendChild(interimSpan);

// Timing and accumulation variables
const AUTO_FINALIZE_INTERVAL = 2500;  // Force finalize after 2.5s inactivity
let autoFinalizeTimer = null;         // Timer handle for auto-finalization
let accumulatedText = "";             // Combined finalized content (for overlap tracking)

/* =========================================================
   SPEECH RECOGNITION EVENT HANDLER
   ========================================================= */

/**
 * Handles streaming recognition results.
 * Auto-finalizes interim text after a delay, and tracks timestamps for each segment.
 */
recognition.onresult = (event) => {
  let interimText = "";

  // Iterate over all recognition results
  for (let i = event.resultIndex; i < event.results.length; ++i) {
    const transcript = event.results[i][0].transcript;

    if (event.results[i].isFinal) {
      // Final result — commit immediately
      finalizeSegment(transcript);
      accumulatedText += transcript + " ";
      interimSpan.textContent = "";
    } else {
      // Interim (live) text — build progressively
      interimText += transcript;
    }
  }

  // Remove already finalized content from interim to avoid duplication
  if (interimText.startsWith(accumulatedText.trim())) {
    interimText = interimText.slice(accumulatedText.trim().length).trimStart();
  }

  // Display interim text
  interimSpan.textContent = interimText;

  // Reset and restart the auto-finalize timer
  clearTimeout(autoFinalizeTimer);
  if (interimText.trim()) {
    autoFinalizeTimer = setTimeout(() => {
      const textToFinalize = interimSpan.textContent.trim();
      if (textToFinalize) {
        finalizeSegment(textToFinalize);
        accumulatedText += " " + textToFinalize;
      }
      interimSpan.textContent = "";
    }, AUTO_FINALIZE_INTERVAL);
  }
};

/* =========================================================
   FINALIZATION HELPER
   ========================================================= */

/**
 * Converts final or auto-finalized text into a permanent transcript segment.
 * Each segment is timestamped and added as a <span> for highlighting and referencing.
 */
function finalizeSegment(text) {
  if (!text) return;
  text = text.trim();
  if (!text) return;

  // --- Overlap prevention ---
  const overlapIndex = finalTranscript.lastIndexOf(text.slice(0, Math.min(10, text.length)));
  if (overlapIndex !== -1) {
    const existingTail = finalTranscript.slice(overlapIndex).trim();
    if (text.startsWith(existingTail)) {
      text = text.slice(existingTail.length).trim();
    }
  }

  if (!text) return; // Skip empty or duplicated segments

  // --- Create and insert span ---
  const time = getElapsedTime();
  const span = document.createElement("span");
  span.textContent = text + " ";
  span.dataset.time = time;
  span.className = "final-span";

  // Ensure interim span remains in DOM
  if (!transcriptContainer.contains(interimSpan)) {
    transcriptContainer.appendChild(interimSpan);
  }

  // Insert finalized segment before interim text
  transcriptContainer.insertBefore(span, interimSpan);

  // Record metadata
  transcriptSegments.push({ time, text });
  finalTranscript += text + " ";

  console.log("Auto-segment:", time, text);
}

/* =========================================================
   ERROR HANDLING
   ========================================================= */

recognition.onerror = (e) => console.error("Speech recognition error:", e);

/* =========================================================
   TRANSCRIPTION CONTROL
   ========================================================= */

/**
 * Starts speech recognition and the recording timer.
 * Clears any previous transcript content.
 */
function startTranscription() {
  finalTranscript = "";
  transcriptContainer.textContent = "";

  // Ensure interim span exists (in case of reinitialization)
  if (!transcriptContainer.contains(interimSpan)) {
    transcriptContainer.appendChild(interimSpan);
  }

  startTimer();
  recognition.start();
}

/**
 * Stops speech recognition, timer, and triggers keyword export.
 */
function stopTranscription() {
  recognition.stop();
  stopTimer();
  document.getElementById("status").textContent = "";
  exportKeywordsToJSON();
}

/* =========================================================
   DEBUG / SIMULATION MODE
   ========================================================= */

/**
 * Adds sample sentences to simulate transcription (no mic required).
 */
const sample = [
  "The water cycle is a continuous process that moves water through the atmosphere, land, and oceans. ",
  "It begins with evaporation, when the sun heats bodies of water like lakes and rivers, causing water to change into vapor. ",
  "This vapor then rises and condenses into clouds in the atmosphere. ",
  "Eventually, precipitation returns water to the earth in the form of rain, snow, or hail."
];

let sid = 0;
function debugTest() {
  if (sid < sample.length) {
    transcriptContainer.textContent += sample[sid];
    sid += 1;
  }
}

/* =========================================================
   RECORDING TIMER UTILITIES
   ========================================================= */

let timerInterval = null;
let startTime = null;

/**
 * Converts milliseconds → mm:ss format.
 */
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * Starts a timer that updates the recording duration on-screen.
 */
function startTimer() {
  startTime = Date.now();
  const status = document.getElementById("status");

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    status.textContent = `Recording ${formatTime(elapsed)}`;
  }, 1000);
}

/**
 * Stops and resets the recording timer.
 */
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  startTime = null;
}

/**
 * Returns the current elapsed recording time in mm:ss format.
 */
function getElapsedTime() {
  if (!startTime) return "00:00";
  const elapsed = Date.now() - startTime;
  return formatTime(elapsed);
}

/* =========================================================
   KEYWORD EXPORT TO JSON
   ========================================================= */

/**
 * Extracts all saved keyword chips and sub-notes, then downloads as a JSON file.
 */
function exportKeywordsToJSON() {
  const noteArea = document.getElementById("note-area");
  const chips = noteArea.querySelectorAll(".keyword-chip");

  // Build export structure
  const data = Array.from(chips).map((chip) => {
    const text = chip.textContent.trim();
    const match = text.match(/^\[(\d{2}:\d{2})\]\s*(.*)$/); // [00:23] Keyword
    const time = match ? match[1] : "??:??";
    const content = match ? match[2] : text;

    let results;

    if (config.language === "en") {
      const tokens = content.split(" ").slice(0, 6);
      results = tokens.filter((t) => !stopwords.has(t));
    } else if (config.language === "ja") {
      const tokens = tokenizer.tokenize(content);
      const filtered = tokens.filter(
        (t) => !["助詞", "助動詞", "記号"].includes(t.pos)
      );
      results = filtered.map((t) => t.surface_form);
    }

    return { time, keyword: content, results };
  });

  // Convert to JSON and trigger download
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;

  // Include lecture title in filename
  const lectureTitle = document
    .getElementById("lecture-title")
    .textContent.trim()
    .replace(/\s+/g, "_");
  const filename = `${lectureTitle}_keywords.json`;

  link.download = filename;
  link.click();

  // Clean up temporary blob URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   EXPORTS
   ========================================================= */

export {
  startTranscription,
  stopTranscription,
  debugTest,
  getElapsedTime,
  transcriptSegments,
};
