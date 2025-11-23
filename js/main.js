/*
  CORTEX: Case of the Ghost Algorithm
  -----------------------------------
  App bootstrap and event wiring.

  Responsibilities:
    - Listen for user interactions (buttons, clicks).
    - Call into CORTEX_STATE to update game state.
    - Call into CORTEX_UI to re-render after changes.
*/

(function bootstrap() {
  if (!window.CORTEX_STATE || !window.CORTEX_UI || !window.CORTEX_DATA) {
    console.error(
      "MAIN: Missing one of CORTEX_STATE, CORTEX_UI, or CORTEX_DATA. Check script load order."
    );
    return;
  }

  const STATE = window.CORTEX_STATE;
  const UI = window.CORTEX_UI;
  const DATA = window.CORTEX_DATA;
  const PHASES = STATE.GAME_PHASES;

  /* -----------------------------------------------------------------------
     DOM references (defensive: check before using)
  ----------------------------------------------------------------------- */

  const beginButton = document.getElementById("begin-investigation");
  const locationButtonsContainer = document.getElementById("location-buttons");
  const notebookToggleButton = document.getElementById(
    "notebook-toggle-button"
  );
  const restartButton = document.getElementById("restart-case-button");
  const dialogueArea = document.getElementById("dialogue-area");
  const notebookModal = document.getElementById("notebook-modal");
  const closeNotebookButton = document.getElementById("close-notebook-button");
  const toggleHintsButton = document.getElementById("toggle-hints-button");
  const accusationForm = document.getElementById("accusation-form");

  /* -----------------------------------------------------------------------
     Helper: safe addEventListener
  ----------------------------------------------------------------------- */

  function on(el, event, handler) {
    if (!el) return;
    el.addEventListener(event, handler);
  }

  /* -----------------------------------------------------------------------
     Core actions
  ----------------------------------------------------------------------- */

  function startInvestigation() {
    // Move from INTRO to INVESTIGATION, set initial location, and reset dialogue.
    STATE.setPhase(PHASES.INVESTIGATION);

    // Default starting location: Lab.
    const firstLoc = DATA.LOCATIONS[0];
    if (firstLoc) {
      STATE.setCurrentLocation(firstLoc.id);
    }

    // Dialogue context: the first intro line has already been shown on intro screen,
    // so we switch to a location-based context.
    STATE.setDialogueContext("location", firstLoc ? firstLoc.id : null, 0);

    UI.addCortexMessage(
      "Investigation initialized. Locations unlocked: Lab, Server Vault, Rooftop.",
      "normal"
    );
    UI.renderAll();
  }

  function goToLocation(locationId) {
    if (!locationId) return;

    const result = STATE.setCurrentLocation(locationId);
    if (!result) return;

    const { location, isFirstVisit } = result;

    if (isFirstVisit) {
      UI.addCortexMessage(
        `New location visited: ${location.name}. Observing environment...`,
        "normal"
      );
    }

    // Reset dialogue context for this location.
    STATE.setDialogueContext("location", locationId, 0);
    UI.renderAll();
  }

  function advanceDialogue() {
    const outcome = STATE.advanceDialogueIndex();

    if (outcome === "continue") {
      UI.renderAll();
      return;
    }

    // outcome === "end": in a real branching system we’d now present choices
    // or wait for the player to pick a location / suspect.
    // For now, just leave the last line on screen.
  }

  function openNotebook() {
    if (!notebookModal) return;
    UI.renderNotebook();
    notebookModal.classList.add("notebook--open");
  }

  function closeNotebook() {
    if (!notebookModal) return;
    notebookModal.classList.remove("notebook--open");
  }

  function restartCase() {
    STATE.resetGameState();
    UI.addCortexMessage("Case reset. Returning to briefing.", "alert");
    UI.renderAll();
  }

  function toggleHints() {
    const enabled = STATE.toggleCortexHints();
    UI.addCortexMessage(
      enabled ? "CORTEX hints enabled." : "CORTEX hints muted.",
      enabled ? "normal" : "alert"
    );
    UI.renderAll();
  }

  function handleAccusationSubmit(event) {
    if (!accusationForm) return;
    event.preventDefault();

    const formData = new FormData(accusationForm);

    const suspectId = formData.get("suspect") || null;
    const motiveId = formData.get("motive") || null;
    const evidenceId = formData.get("evidence") || null;

    STATE.setAccusation({ suspectId, motiveId, evidenceId });

    const { score, endingKey } = STATE.evaluateAccusation();

    UI.addCortexMessage(
      `Accusation recorded. Evaluating evidence... Outcome tier: ${endingKey}.`,
      "critical"
    );
    UI.renderAll();

    // Optionally, you could also show score details in CORTEX feed:
    UI.addCortexMessage(
      `Culprit correct: ${score.culpritCorrect ? "yes" : "no"}; ` +
        `motive correct: ${score.motiveCorrect ? "yes" : "no"}; ` +
        `critical clues: ${score.criticalCluesFound}/${score.criticalCluesTotal}.`,
      "normal"
    );
  }

  /* -----------------------------------------------------------------------
     Event wiring
  ----------------------------------------------------------------------- */

  // Begin Investigation button on intro screen
  on(beginButton, "click", startInvestigation);

  // Location buttons (event delegation)
  on(locationButtonsContainer, "click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const locId = target.dataset.locationId;
    if (!locId) return;

    goToLocation(locId);
  });

  // Dialogue click-to-advance
  on(dialogueArea, "click", advanceDialogue);

  // Notebook open / close
  on(notebookToggleButton, "click", openNotebook);
  on(closeNotebookButton, "click", closeNotebook);

  // Restart
  on(restartButton, "click", restartCase);

  // Hints toggle
  on(toggleHintsButton, "click", toggleHints);

  // Accusation form submit (inside notebook)
  on(accusationForm, "submit", handleAccusationSubmit);

  /* -----------------------------------------------------------------------
     Initial render on load
  ----------------------------------------------------------------------- */

  // On first load, make sure state is clean and UI matches it.
  STATE.resetGameState();
  UI.renderAll();

  // Optionally seed the CORTEX feed with a welcome line.
  UI.addCortexMessage(
    "CORTEX online. Awaiting your decision to begin the investigation.",
    "normal"
  );
})();
