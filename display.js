function loadCapturedImages() {
    const stored = JSON.parse(localStorage.getItem("capturedImages") || "[]");

    const captured = stored.map(img => {
        const time = img.time || extractTimeFromFilename(img.filename);

        return {
            type: "image",
            url: img.dataUrl,          // base64 image source
            time: time,
            seconds: parseTimeToSeconds(time)
        };
    });

    return captured;
}

function loadCapturedPhrases() {
    return JSON.parse(localStorage.getItem("capturedPhrases") || "[]")
        .map(item => ({
            type: "phrase",
            time: item.time,
            text: item.keyword,
            results: item.results,
            seconds: parseTimeToSeconds(item.time)
        }));
}

/* ============================
   ZOOM SETTINGS
============================ */
let timelineZoom = 1.0;
const ZOOM_STEP = 0.25;
const ZOOM_MAX = 3.0;
const ZOOM_MIN = 1.0;

/* ============================
   DATA STORAGE
============================ */
let jsonPhrases = loadCapturedPhrases();
let imageEvents = loadCapturedImages();

/* ===========================
   FILTER FUNCTION
============================ */
let currentFilter = "all";


/* ============================
   LOADERS
============================ */
function parseTimeToSeconds(t) {
    const parts = t.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}

function extractTimeFromFilename(name) {
    const match = name.match(/(\d{2})-(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : "00:00";
}

/* ============================
   EVENT LISTENERS
============================ */
document.getElementById("jsonUpload").addEventListener("change", async evt => {
    const file = evt.target.files[0];
    if (!file) return;

    const data = JSON.parse(await file.text());
    jsonPhrases = data.map(item => ({
        type: "phrase",
        time: item.time,
        seconds: parseTimeToSeconds(item.time),
        text: item.keyword,
        tokens: item.results
    }));
});

// document.getElementById("imageUpload").addEventListener("change", evt => {
//     imageEvents = [...evt.target.files].map(file => {
//         const time = extractTimeFromFilename(file.name);
//         return {
//             type: "image",
//             file,
//             url: URL.createObjectURL(file),
//             time,
//             seconds: parseTimeToSeconds(time)
//         };
//     });
// });

document.getElementById("imageUpload").addEventListener("change", evt => {
    const uploaded = [...evt.target.files].map(file => {
        const time = extractTimeFromFilename(file.name);

        return {
            type: "image",
            url: URL.createObjectURL(file),
            time,
            seconds: parseTimeToSeconds(time)
        };
    });

    // merge uploaded images + stored camera images
    imageEvents = [
        ...loadCapturedImages(),
        ...uploaded
    ];
});


/* ============================
   OVERLAP PREVENTION
============================ */
function avoidOverlap(events, minSpacing = 2) {
    events.sort((a, b) => a.position - b.position);
    for (let i = 1; i < events.length; i++) {
        if (events[i].position - events[i - 1].position < minSpacing) {
            events[i].position = events[i - 1].position + minSpacing;
        }
    }
    return events;
}

/* ============================
   MAP 0–100% → 10–90%
============================ */
function mapTo80PercentRange(p) {
    return 10 + p * 0.80;
}

function highlightFilter(activeId) {
    const chips = document.querySelectorAll(".filter-chip");

    chips.forEach(chip => {
        if (chip.id === activeId) {
            chip.classList.remove("bg-gray-200", "dark:bg-slate-gray/50");
            chip.classList.add("bg-primary", "text-white");
        } else {
            chip.classList.remove("bg-primary", "text-white");
            chip.classList.add("bg-gray-200", "dark:bg-slate-gray/50");
        }
    });
}

/* ============================
   BUILD TIMELINE
============================ */
function buildTimeline() {
    const container = document.getElementById("timelineContainer");
    container.innerHTML = "";

    // let events = [...jsonPhrases, ...imageEvents];
    // if (events.length === 0) return;

    let events;

    if (currentFilter === "all") {
        events = [...jsonPhrases, ...imageEvents];
    } else if (currentFilter === "images") {
        events = [...imageEvents];
    } else if (currentFilter === "phrases") {
        events = [...jsonPhrases];
    }

    if (events.length === 0) {
        container.innerHTML = "<p class='text-center text-gray-500 dark:text-gray-400'>No events found.</p>";
        return;
    }


    events.sort((a, b) => a.seconds - b.seconds);

    const total = events.at(-1).seconds || 1;

    // Compute linear base position
    events.forEach(ev => {
        ev.basePosition = (ev.seconds / total) * 100;
        ev.position = Math.min(100, ev.basePosition * timelineZoom);
    });

    const laneImages = avoidOverlap(events.filter(e => e.type === "image"));
    const lanePhrases = avoidOverlap(events.filter(e => e.type === "phrase"));

    /* Timeline wrapper */
    const wrapper = document.createElement("div");
    wrapper.className = "timeline-wrapper relative min-w-[800px] h-48";
    wrapper.style.width = `${80 * timelineZoom}%`;
    wrapper.style.margin = "0 auto";

    /* Timeline bar */
    const bar = document.createElement("div");
    bar.className = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-1.5 bg-gray-200 dark:bg-slate-gray rounded-full";
    wrapper.appendChild(bar);

    /* IMAGE EVENTS */
    laneImages.forEach(ev => {
        const x = mapTo80PercentRange(ev.position);

        const item = document.createElement("div");
        item.className = "absolute bottom-1/2 mb-3 -translate-x-1/2 flex flex-col items-center gap-2";
        item.style.left = `${x}%`;

        const imgWrap = document.createElement("div");
        imgWrap.className = "relative";

        const img = document.createElement("img");
        img.className = "h-20 w-32 object-cover rounded-lg shadow-lg";
        img.src = ev.url;

        const badge = document.createElement("div");
        badge.className = "absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded";
        badge.textContent = ev.time;

        const line = document.createElement("div");
        line.className = "w-px h-3 bg-gray-300 dark:bg-gray-600";

        const dot = document.createElement("div");
        dot.className = "w-2.5 h-2.5 rounded-full bg-orange-500";

        imgWrap.appendChild(img);
        imgWrap.appendChild(badge);

        item.appendChild(imgWrap);
        item.appendChild(line);
        item.appendChild(dot);

        wrapper.appendChild(item);
    });

    /* PHRASE EVENTS */
    lanePhrases.forEach(ev => {
        const x = mapTo80PercentRange(ev.position);

        const item = document.createElement("div");
        item.className = "absolute top-1/2 mt-3 -translate-x-1/2 flex flex-col items-center gap-2";
        item.style.left = `${x}%`;

        const chip = document.createElement("div");
        chip.className = "bg-gray-200 dark:bg-slate-gray/50 text-slate-gray dark:text-gray-300 text-sm italic px-3 py-1 rounded-full";
        chip.textContent = ev.text;

        const line = document.createElement("div");
        line.className = "w-px h-3 bg-gray-300 dark:bg-gray-600";

        const dot = document.createElement("div");
        dot.className = "w-2.5 h-2.5 rounded-full bg-gray-500";

        item.appendChild(chip);
        item.appendChild(line);
        item.appendChild(dot);

        wrapper.appendChild(item);
    });

    // /* TIMESTAMP MARKERS */
    // const labelRow = document.createElement("div");
    // labelRow.className = "relative min-w-[800px] h-6 mt-1";

    // const seg = 6;
    // for (let i = 0; i <= seg; i++) {
    //     const pct = (i / seg) * 100;
    //     const zoomed = Math.min(100, pct * timelineZoom);
    //     const left = mapTo80PercentRange(zoomed);

    //     const t = Math.floor(total * (i / seg));
    //     const mm = String(Math.floor(t / 60)).padStart(2, "0");
    //     const ss = String(t % 60).padStart(2, "0");

    //     const label = document.createElement("div");
    //     label.className = "absolute text-xs text-gray-500 dark:text-gray-400";
    //     label.style.left = `${left}%`;
    //     label.style.transform = "translateX(-50%)";
    //     label.textContent = `${mm}:${ss}`;

    //     labelRow.appendChild(label);
    // }

    container.appendChild(wrapper);
    // container.appendChild(labelRow);
}

/* ============================
   ZOOM BUTTONS
============================ */
document.getElementById("zoomIn").addEventListener("click", () => {
    timelineZoom = Math.min(ZOOM_MAX, timelineZoom + ZOOM_STEP);
    buildTimeline();
});

document.getElementById("zoomOut").addEventListener("click", () => {
    timelineZoom = Math.max(ZOOM_MIN, timelineZoom - ZOOM_STEP);
    buildTimeline();
});

/* ===========================
   FILTER BUTTONS
=========================== */
document.getElementById("filterAll").addEventListener("click", () => {
    currentFilter = "all";
    highlightFilter("filterAll");
    buildTimeline();
});

document.getElementById("filterImages").addEventListener("click", () => {
    currentFilter = "images";
    highlightFilter("filterImages");
    buildTimeline();
});

document.getElementById("filterPhrases").addEventListener("click", () => {
    currentFilter = "phrases";
    highlightFilter("filterPhrases");
    buildTimeline();
});

/* ============================
   MANUAL BUILD TRIGGER
============================ */
document.getElementById("buildTimeline").addEventListener("click", buildTimeline);
