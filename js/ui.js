/*
  CORTEX: Case of the Ghost Algorithm
  -----------------------------------
  UI rendering and DOM manipulation layer.

  Responsibilities:
    - Render current game state into the interface.
    - Show/hide screens based on phase.
    - Render dialogue, scene descriptions, choices, clues, and CORTEX feed.
    - Do NOT handle game logic or state transitions (main.js handles events).
*/

if (!window.CORTEX_STATE || !window.CORTEX_DATA) {
  throw new Error(
    "UI: CORTEX_STATE or CORTEX_DATA missing. Ensure data.js and state.js are loaded before ui.js."
  );
}

/**
 * Local aliases for clarity and to avoid redeclaring global identifiers.
 */
const STATE = window.CORTEX_STATE;
const DATA = window.CORTEX_DATA;
const UI_GAME_PHASES = STATE.GAME_PHASES;

/* ==========================================================================
   Cached DOM References
   ========================================================================== */

const screens = {
  intro: document.getElementById("intro-screen"),
  game: document.getElementById("game-screen"),
};

const endingScreen = {
  root: document.getElementById("ending-screen"),
  title: document.getElementById("ending-title"),
  tagline: document.getElementById("ending-tagline"),
  details: document.getElementById("ending-details"),
};

const header = {
  aboutButton: document.getElementById("about-button"),
  helpButton: document.getElementById("help-button"),
};

const scenePanel = {
  title: document.getElementById("scene-title"),
  subtitle: document.getElementById("scene-subtitle"),
  description: document.getElementById("scene-description"),
  locationButtonsContainer: document.getElementById("location-buttons"),
};

const dialoguePanel = {
  phaseLabel: document.getElementById("dialogue-phase-label"),
  speakerName: document.getElementById("speaker-name"),
  text: document.getElementById("dialogue-text"),
  choicesContainer: document.getElementById("choices-panel"),
};

const cortexPanel = {
  feed: document.getElementById("cortex-feed"),
  status: document.getElementById("cortex-status"),
  toggleHintsButton: document.getElementById("toggle-hints-button"),
};

const clueBar = document.getElementById("clue-bar");

const notebook = {
  modal: document.getElementById("notebook-modal"),
  closeButton: document.getElementById("close-notebook-button"),
  cluesList: document.getElementById("notebook-clues-list"),
  suspectsList: document.getElementById("notebook-suspects-list"),
  accusationForm: document.getElementById("accusation-form"),
  accusedSuspectSelect: document.getElementById("accused-suspect-select"),
  accusedMotiveSelect: document.getElementById("accused-motive-select"),
  accusedEvidenceSelect: document.getElementById("accused-evidence-select"),
};

const endingBreakdownEl = document.getElementById("ending-breakdown");

/* ==========================================================================
   Screen Management
   ========================================================================== */

/**
 * Shows the appropriate main screen based on the current game phase.
 */
function renderScreens() {
  const { phase } = STATE.getState();

  const isIntro = phase === UI_GAME_PHASES.INTRO;
  const isEnding = phase === UI_GAME_PHASES.ENDING;
  const isGame = !isIntro && !isEnding; // everything in-between

  // Intro screen
  if (screens.intro) {
    screens.intro.classList.toggle("screen--active", isIntro);
    screens.intro.classList.toggle("screen--hidden", !isIntro);
    screens.intro.hidden = !isIntro;
  }

  // Main game screen
  if (screens.game) {
    screens.game.classList.toggle("screen--active", isGame);
    screens.game.classList.toggle("screen--hidden", !isGame);
    screens.game.hidden = !isGame;
  }

  // Ending screen
  if (endingScreen.root) {
    endingScreen.root.classList.toggle("screen--active", isEnding);
    endingScreen.root.classList.toggle("screen--hidden", !isEnding);
    endingScreen.root.hidden = !isEnding;
  }
}

/* ==========================================================================
   Dialogue Rendering
   ========================================================================== */

/**
 * Returns the current dialogue line to display based on state.dialogueContext.
 */
function getCurrentDialogueLine() {
  const state = STATE.getState();
  const ctx = state.dialogueContext;

  switch (ctx.kind) {
    case "intro":
      return DATA.INTRO_DIALOGUE[ctx.index] || null;

    case "location": {
      const script = DATA.LOCATION_DIALOGUE[ctx.targetId];
      if (!script) return null;

      // IMPORTANT:
      // I always use the "intro" sequence for locations right now.
      // This matches what advanceDialogueIndex() in state.js uses.
      const arr = script.intro;
      return arr[ctx.index] || null;
    }

    case "suspect": {
      const script = DATA.SUSPECT_DIALOGUE[ctx.targetId];
      if (!script) return null;

      // If a topic is active, use that topic's script; otherwise use the intro.
      if (ctx.topicId && script.topics && script.topics[ctx.topicId]) {
        return script.topics[ctx.topicId][ctx.index] || null;
      }

      return script.intro[ctx.index] || null;
    }

    case "ending": {
      const script = DATA.ENDINGS[ctx.targetId];
      if (!script) return null;
      return script[ctx.index] || null;
    }

    default:
      return null;
  }
}

/**
 * Renders the current dialogue line into the dialogue panel.
 */
function renderDialogue() {
  const line = getCurrentDialogueLine();
  if (!line) return;

  dialoguePanel.speakerName.textContent = line.speaker;
  dialoguePanel.text.textContent = line.text;

  // Update phase label
  renderPhaseLabel();

  // Clear existing choices every time we re-render dialogue
  if (dialoguePanel.choicesContainer) {
    dialoguePanel.choicesContainer.innerHTML = "";
  }

  const state = STATE.getState();
  const ctx = state.dialogueContext;

  // Only show choices during the Investigation phase
  if (state.phase !== UI_GAME_PHASES.INVESTIGATION) {
    return;
  }

  if (ctx.kind === "location") {
    // Lab/other location-specific decision buttons
    renderLocationChoices();
  } else if (ctx.kind === "suspect") {
    // Topic buttons for the active suspect
    renderSuspectTopics();
  }
}

/**
 * Renders any location-specific choice buttons (e.g. Lab actions)
 * into the dialogue choices panel.
 */
function renderLocationChoices() {
  const state = STATE.getState();
  const ctx = state.dialogueContext;

  // We only show Lab actions while in the Lab during investigation.
  if (
    state.phase !== UI_GAME_PHASES.INVESTIGATION ||
    state.currentLocationId !== "lab" ||
    ctx.kind !== "location"
  ) {
    return;
  }

  const actions = DATA.LOCATION_ACTIONS.lab || [];
  if (!actions.length) return;

  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-button dialogue-choice-button";
    btn.dataset.actionId = action.id;
    btn.textContent = action.label;

    // If this action has already been used in this run, dim/disable it.
    if (STATE.isLabActionUsed(action.id)) {
      btn.disabled = true;
      btn.classList.add("dialogue-choice-button--used");
    }

    dialoguePanel.choicesContainer.appendChild(btn);
  });
}

function renderSuspectTopics() {
  const state = STATE.getState();
  const ctx = state.dialogueContext;

  if (ctx.kind !== "suspect") return;

  const suspectId = ctx.targetId;
  if (!suspectId) return;

  const script = DATA.SUSPECT_DIALOGUE[suspectId];
  if (!script || !script.topics) return;

  const container = dialoguePanel.choicesContainer;
  if (!container) return;

  // Friendly labels for topic IDs
  const topicLabelMap = {
    alibi: "Alibi / Timeline",
    ghost_algorithm: "The Ghost Algorithm",
    pressure: "Investor Pressure",
    casino_sims: "Casino Simulations",
    victim_relation: "Relationship with the Victim",
    audit_logs: "Audit Logs & Redactions",
    rooftop_argument: "The Rooftop Argument",
  };

  Object.keys(script.topics).forEach((topicId) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-button dialogue-choice-button";
    btn.dataset.topicId = topicId;
    btn.textContent = topicLabelMap[topicId] || topicId.replace(/_/g, " ");

    container.appendChild(btn);
  });
}

function renderPhaseLabel() {
  const state = STATE.getState();
  const phase = state.phase;

  if (!dialoguePanel.phaseLabel) return;

  switch (phase) {
    case UI_GAME_PHASES.INTRO:
      dialoguePanel.phaseLabel.textContent = "Briefing";
      break;
    case UI_GAME_PHASES.INVESTIGATION:
      dialoguePanel.phaseLabel.textContent = "Investigation";
      break;
    case UI_GAME_PHASES.DEDUCTION:
      dialoguePanel.phaseLabel.textContent = "Deduction";
      break;
    case UI_GAME_PHASES.ACCUSATION:
      dialoguePanel.phaseLabel.textContent = "Accusation Submitted";
      break;
    case UI_GAME_PHASES.ENDING:
      dialoguePanel.phaseLabel.textContent =
        "Outcome: " + (state.endingKey || "unknown").toUpperCase();
      break;
    default:
      dialoguePanel.phaseLabel.textContent = "";
  }
}

/* ==========================================================================
   Scene Panel Rendering
   ========================================================================== */

/**
 * Renders the current scene panel title/subtitle/description.
 */
function renderScenePanel() {
  const state = STATE.getState();
  const locId = state.currentLocationId;

  if (!locId) {
    scenePanel.title.textContent = "Choose a Location";
    scenePanel.subtitle.textContent = "";
    scenePanel.description.textContent = "";
    return;
  }

  const loc = STATE.findLocationById(locId);
  if (!loc) {
    scenePanel.title.textContent = "Unknown Location";
    scenePanel.subtitle.textContent = "";
    scenePanel.description.textContent = "";
    return;
  }

  scenePanel.title.textContent = loc.name;
  scenePanel.subtitle.textContent = loc.shortLabel;
  scenePanel.description.textContent = loc.sceneDescription;
}

/**
 * Renders the row of location buttons.
 */
function renderLocationButtons() {
  const container = scenePanel.locationButtonsContainer;
  const state = STATE.getState();

  container.innerHTML = "";

  DATA.LOCATIONS.forEach((loc) => {
    const btn = document.createElement("button");
    btn.className = "location-button";
    btn.textContent = loc.shortLabel;
    btn.dataset.locationId = loc.id;

    if (state.currentLocationId === loc.id) {
      btn.classList.add("location-button--active");
    }

    container.appendChild(btn);
  });
}

/* ==========================================================================
   Clue Bar Rendering
   ========================================================================== */

/**
 * Renders the clue badges in the HUD footer.
 */
function renderClues() {
  const clues = STATE.getDiscoveredClues();
  clueBar.innerHTML = "";

  clues.forEach((clue) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "clue-badge";
    el.textContent = clue.name;
    el.title = clue.summary;
    clueBar.appendChild(el);
  });
}

/* ==========================================================================
   CORTEX Feed Rendering
   ========================================================================== */

/**
 * Appends a message to the CORTEX feed panel.
 */
function addCortexMessage(text, variant = "normal") {
  const msg = document.createElement("div");
  msg.className = "cortex-feed__entry";

  if (variant === "alert") msg.classList.add("cortex-feed__entry--alert");
  if (variant === "critical") msg.classList.add("cortex-feed__entry--critical");

  msg.textContent = text;
  cortexPanel.feed.appendChild(msg);
  cortexPanel.feed.scrollTop = cortexPanel.feed.scrollHeight;
}

/**
 * Clears all messages from the CORTEX feed panel.
 */
function clearCortexFeed() {
  if (cortexPanel.feed) {
    cortexPanel.feed.innerHTML = "";
    cortexPanel.feed.scrollTop = 0;
  }
}

/**
 * Renders the CORTEX status pill (Online / Muted).
 */
function renderCortexStatus() {
  const enabled = STATE.getState().cortexHintsEnabled;
  cortexPanel.status.textContent = enabled ? "Online" : "Muted";

  cortexPanel.status.classList.toggle(
    "cortex-header__status--warning",
    !enabled
  );
}

function renderEndingScreen() {
  const state = STATE.getState();
  if (!endingScreen.root) return;

  // Only populate when we're actually in the ENDING phase
  if (state.phase !== UI_GAME_PHASES.ENDING) {
    return;
  }

  const { endingKey, score } = state;

  let title = "Case Result";
  let tagline = "";

  // Did the player push CORTEX with the forbidden scan?
  const usedForbiddenScan =
    typeof STATE.getFlag === "function" &&
    STATE.getFlag("lab_forbidden_scan_used");

  switch (endingKey) {
    case "perfect":
      title = "Case Closed: Perfect Reconstruction";

      if (usedForbiddenScan) {
        tagline =
          "Suspect, motive, and all critical clues aligned—but you pushed CORTEX past its safe limits. This run is logged as both a reference pattern and a cautionary tale.";
      } else {
        tagline =
          "Suspect, motive, and all critical clues aligned. CORTEX marks this run as a clean reference pattern.";
      }
      break;

    case "close":
      title = "Case Mostly Solved";
      tagline =
        "You caught the right shadow, but some variables stayed fuzzy. Another pass might lock it in.";
      break;

    default:
      title = "Case Unresolved";
      tagline =
        "Your accusation conflicts with too much of the evidence. Officially closed, but the pattern persists.";
      break;
  }

  endingScreen.title.textContent = title;
  endingScreen.tagline.textContent = tagline;

  // --- Performance breakdown line ---
  if (endingBreakdownEl && score) {
    const {
      culpritCorrect,
      motiveCorrect,
      criticalCluesFound,
      criticalCluesTotal,
    } = score;

    endingBreakdownEl.textContent =
      `Culprit correct: ${culpritCorrect ? "yes" : "no"} • ` +
      `Motive correct: ${motiveCorrect ? "yes" : "no"} • ` +
      `Critical clues: ${criticalCluesFound}/${criticalCluesTotal}`;
  }

  // Build a simple score summary
  let detailsHtml = "";

  if (score) {
    detailsHtml += `<p><strong>Culprit correct:</strong> ${
      score.culpritCorrect ? "YES" : "NO"
    }</p>`;
    detailsHtml += `<p><strong>Motive correct:</strong> ${
      score.motiveCorrect ? "YES" : "NO"
    }</p>`;
    detailsHtml += `<p><strong>Critical clues found:</strong> ${score.criticalCluesFound} / ${score.criticalCluesTotal}</p>`;
  }

  detailsHtml += `
    <p class="ending-details__hint">
      Try a different path through the Lab, Server Vault, and Rooftop to see how the pattern shifts.
    </p>
  `;

  endingScreen.details.innerHTML = detailsHtml;
}

/* ==========================================================================
   Notebook Rendering
   ========================================================================== */

/**
 * Renders the notebook modal contents (clues & suspects).
 */
function renderNotebook() {
  const discovered = STATE.getDiscoveredClues();

  // ----- Clues -----
  notebook.cluesList.innerHTML = "";

  if (!discovered.length) {
    const empty = document.createElement("p");
    empty.className = "notebook-empty";
    empty.textContent =
      "No formal clues logged yet. Explore each location and watch CORTEX for anomalies.";
    notebook.cluesList.appendChild(empty);
  } else {
    discovered.forEach((clue) => {
      const item = document.createElement("div");
      item.className = "notebook-card";
      item.innerHTML = `
        <h4>${clue.name}</h4>
        <p>${clue.detail}</p>
        <p><strong>Tags:</strong> ${clue.tags.join(", ")}</p>
      `;
      notebook.cluesList.appendChild(item);
    });
  }

  // ----- Suspects -----
  notebook.suspectsList.innerHTML = "";
  DATA.SUSPECTS.forEach((sus) => {
    const item = document.createElement("div");
    item.className = "notebook-card";
    item.innerHTML = `
      <h4>${sus.name}</h4>
      <p><strong>Role:</strong> ${sus.role}</p>
      <p><strong>Relation:</strong> ${sus.relationshipToVictim}</p>
      <p>${sus.initialImpression}</p>
      <button
        type="button"
        class="notebook-suspect__interview-button"
        data-suspect-id="${sus.id}"
      >
        Interview ${sus.name}
      </button>
    `;
    notebook.suspectsList.appendChild(item);
  });

  // ----- Accusation selects -----
  // Suspects
  if (notebook.accusedSuspectSelect) {
    notebook.accusedSuspectSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select suspect --";
    notebook.accusedSuspectSelect.appendChild(placeholder);

    DATA.SUSPECTS.forEach((sus) => {
      const opt = document.createElement("option");
      opt.value = sus.id; // assumes each suspect has an "id"
      opt.textContent = sus.name;
      notebook.accusedSuspectSelect.appendChild(opt);
    });
  }

  // Motives – simple static list for now
  if (notebook.accusedMotiveSelect) {
    notebook.accusedMotiveSelect.innerHTML = "";
    const motivePlaceholder = document.createElement("option");
    motivePlaceholder.value = "";
    motivePlaceholder.textContent = "-- Select motive --";
    notebook.accusedMotiveSelect.appendChild(motivePlaceholder);

    const motives = [
      { id: "greed", label: "Greed / Profit" },
      { id: "fear", label: "Fear / Self-Preservation" },
      { id: "coverup", label: "Corporate Cover-Up" },
    ];

    motives.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      notebook.accusedMotiveSelect.appendChild(opt);
    });
  }

  // Evidence – based on discovered clues
  if (notebook.accusedEvidenceSelect) {
    notebook.accusedEvidenceSelect.innerHTML = "";
    const evPlaceholder = document.createElement("option");
    evPlaceholder.value = "";
    evPlaceholder.textContent = "-- Select key evidence --";
    notebook.accusedEvidenceSelect.appendChild(evPlaceholder);

    discovered.forEach((clue) => {
      const opt = document.createElement("option");
      opt.value = clue.id;
      opt.textContent = clue.name;
      notebook.accusedEvidenceSelect.appendChild(opt);
    });
  }
  // ----- Narrow options when player is "close" -----
  const state = STATE.getState();

  if (
    state.score &&
    state.score.culpritCorrect &&
    state.score.criticalCluesFound < state.score.criticalCluesTotal
  ) {
    // CORTEX is confident in the culprit: lock the suspect field.
    if (notebook.accusedSuspectSelect) {
      notebook.accusedSuspectSelect.value = state.accusation.suspectId || "";
      notebook.accusedSuspectSelect.disabled = true;
      notebook.accusedSuspectSelect.title =
        "CORTEX confidence high: culprit locked. Refine motive and key evidence.";
    }
  } else {
    // Otherwise keep it editable
    if (notebook.accusedSuspectSelect) {
      notebook.accusedSuspectSelect.disabled = false;
      notebook.accusedSuspectSelect.title = "";
    }
  }
}

/* ==========================================================================
   Global Render Entrypoint
   ========================================================================== */

/**
 * Renders all major UI components based on the current state.
 * This should be called after any state-changing action.
 */
function renderAll() {
  renderScreens();
  renderScenePanel();
  renderLocationButtons();
  renderDialogue(); // <- handles phase label + choices
  renderClues();
  renderCortexStatus();
  renderEndingScreen();
}

/* ==========================================================================
   Export UI API
   ========================================================================== */

window.CORTEX_UI = {
  renderAll,
  renderNotebook,
  renderClues,
  renderDialogue,
  addCortexMessage,
  clearCortexFeed,
};
