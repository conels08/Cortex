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
};

/* ==========================================================================
   Screen Management
   ========================================================================== */

/**
 * Shows the appropriate main screen based on the current game phase.
 */
function renderScreens() {
  const { phase } = STATE.getState();
  const introActive = phase === UI_GAME_PHASES.INTRO;

  if (screens.intro) {
    screens.intro.classList.toggle("screen--active", introActive);
    screens.intro.classList.toggle("screen--hidden", !introActive);
    screens.intro.hidden = !introActive;
  }

  if (screens.game) {
    screens.game.classList.toggle("screen--active", !introActive);
    screens.game.classList.toggle("screen--hidden", introActive);
    screens.game.hidden = introActive;
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
      return DATA.INTRO_DIALOGUE[ctx.index];

    case "location": {
      const script = DATA.LOCATION_DIALOGUE[ctx.targetId];
      if (!script) return null;

      const firstVisit = !state.visitedLocationIds.includes(ctx.targetId);
      const arr = firstVisit ? script.intro : script.repeat;
      return arr[ctx.index] || null;
    }

    case "suspect": {
      const script = DATA.SUSPECT_DIALOGUE[ctx.targetId];
      if (!script) return null;
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

  const phase = STATE.getState().phase;
  dialoguePanel.phaseLabel.textContent =
    {
      [UI_GAME_PHASES.INTRO]: "Introduction",
      [UI_GAME_PHASES.INVESTIGATION]: "Investigation",
      [UI_GAME_PHASES.DEDUCTION]: "Deduction",
      [UI_GAME_PHASES.ENDING]: "Conclusion",
    }[phase] || "";

  // Choices will be injected later by main.js when we add branching.
  dialoguePanel.choicesContainer.innerHTML = "";
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

/* ==========================================================================
   Notebook Rendering
   ========================================================================== */

/**
 * Renders the notebook modal contents (clues & suspects).
 */
function renderNotebook() {
  // Clues
  notebook.cluesList.innerHTML = "";
  const discovered = STATE.getDiscoveredClues();
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

  // Suspects
  notebook.suspectsList.innerHTML = "";
  DATA.SUSPECTS.forEach((sus) => {
    const item = document.createElement("div");
    item.className = "notebook-card";
    item.innerHTML = `
      <h4>${sus.name}</h4>
      <p><strong>Role:</strong> ${sus.role}</p>
      <p><strong>Relation:</strong> ${sus.relationshipToVictim}</p>
      <p>${sus.initialImpression}</p>
    `;
    notebook.suspectsList.appendChild(item);
  });
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
  renderDialogue();
  renderClues();
  renderCortexStatus();
}

/* ==========================================================================
   Export UI API
   ========================================================================== */

window.CORTEX_UI = {
  renderAll,
  renderNotebook,
  addCortexMessage,
};
