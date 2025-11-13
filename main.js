/* =========================================================
   MODULE IMPORTS
   ========================================================= */
import {
  startTranscription,
  stopTranscription,
  debugTest,
  getElapsedTime,
  transcriptSegments
} from "./transcription.js";

import { analyzeSentenceAndCreateSubBoxes } from "./nlp.js";

/* =========================================================
   GLOBAL BEHAVIOR
   ========================================================= */

// Disable right-click context menus globally
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Expose transcription control functions to window (for inline HTML calls)
window.startTranscription = startTranscription;
window.stopTranscription = stopTranscription;
window.debugTest = debugTest;

/* =========================================================
   TRANSCRIPTION AREA (DRAG & DROP)
   ========================================================= */

// Area where live text appears
const subtitleArea = document.getElementById("transcription");
let timestamp; // used to hold the segment time for the dragged text

/**
 * Capture selected transcript text and find its original timestamp.
 * This runs when the user starts dragging highlighted text.
 */
subtitleArea.addEventListener("dragstart", (e) => {
  const selection = window.getSelection().toString().trim();
  if (!selection) return;

  const selectionWords = selection.split(/\s+/).filter(Boolean);

  let bestMatch = null;
  let bestScore = 0;

  for (const seg of transcriptSegments) {
    const segText = seg.text.toLowerCase();
    let score = 0;

    // Count how many words from the selection appear in this segment
    for (const word of selectionWords) {
      if (segText.includes(word)) score++;
    }

    // Keep segment with highest overlap score
    if (score > bestScore) {
      bestScore = score;
      bestMatch = seg;
    }
  }

  // Assign timestamp from best matching segment, if any
  timestamp = bestMatch ? bestMatch.time : "??:??";

  // You could optionally store the text in the drag data if needed:
  // e.dataTransfer.setData("text/plain", selection);
});

/* =========================================================
   DROP TARGET (KEYWORD FOOTER)
   ========================================================= */

const dropArea = document.getElementById("keyword-footer");
const noteArea = document.getElementById("note-area");
const guideMsg = document.getElementById("guide-msg");

// Allow dragging over the drop zone
dropArea.addEventListener("dragover", (e) => e.preventDefault());

/**
 * Handle dropping of a keyword into the note area.
 * Creates a movable "keyword chip" element with a timestamp.
 */
dropArea.addEventListener("drop", (e) => {
  e.preventDefault();

  const text = e.dataTransfer.getData("text/plain");
  if (!text) return;

  // Position chip relative to the drop area
  // const rect = noteArea.getBoundingClientRect();
  // const x = e.clientX - rect.left;
  // const y = e.clientY - rect.top;

  // Create the keyword chip
  const box = document.createElement("div");
  box.className = "keyword-chip";
  box.textContent = `[${timestamp}] ${text}`;
  // box.style.left = `${x}px`;
  // box.style.top = `${y}px`;

  noteArea.appendChild(box);
  guideMsg.remove(); // Hide the instructional message

  /* --- Context menu behavior (right-click) --- */
  box.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    const existing = box.querySelector(".sub-container");

    // Remove existing sub-boxes if open, otherwise generate new ones
    if (existing) {
      existing.querySelectorAll(".def-popup").forEach(p => p.remove());
      existing.remove();
    } else {
      analyzeSentenceAndCreateSubBoxes(box, noteArea);
    }
  });

  /* --- Drag and reposition chip behavior --- */
  box.addEventListener("mousedown", (e) => {
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseFloat(box.style.left);
    const startTop = parseFloat(box.style.top);

    function moveAt(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      box.style.left = `${startLeft + dx}px`;
      box.style.top = `${startTop + dy}px`;
    }

    function stopDrag() {
      document.removeEventListener("mousemove", moveAt);
      document.removeEventListener("mouseup", stopDrag);
      box.style.cursor = "grab";
    }

    box.style.cursor = "grabbing";
    document.addEventListener("mousemove", moveAt);
    document.addEventListener("mouseup", stopDrag);
  });
});

/* =========================================================
   CAMERA FUNCTIONALITY
   ========================================================= */

const cameraBtn = document.getElementById("camera-btn");
const cameraPopup = document.getElementById("camera-popup");
const video = document.getElementById("camera-stream");
const canvas = document.getElementById("snapshot");
const captureBtn = document.getElementById("capture-btn");

let stream = null;

/**
 * Open camera popup and start video stream
 */
cameraBtn.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    cameraPopup.classList.remove("hidden");
  } catch (err) {
    console.error("Camera access denied or unavailable:", err);
  }
});

/**
 * Capture image from video, name it with timestamp + lecture title,
 * and automatically download it.
 */
captureBtn.addEventListener("click", () => {
  if (!stream) return;

  // Draw current frame to canvas
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  // Build filename using elapsed recording time + lecture title
  const elapsed = getElapsedTime();
  const lectureTitle = document
    .getElementById("lecture-title")
    .textContent.trim()
    .replace(/\s+/g, "_");

  const filename = `${lectureTitle}_${elapsed.replace(":", "-")}.png`;

  // Convert canvas to image blob and trigger download
  canvas.toBlob((blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    // Release memory after short delay
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, "image/png");

  // Stop camera and close popup
  stream.getTracks().forEach((track) => track.stop());
  setTimeout(() => {
    cameraPopup.classList.add("hidden");
    canvas.classList.add("hidden");
  }, 500);
});
