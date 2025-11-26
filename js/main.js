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

  console.log("CORTEX main bootstrap running");

  const STATE = window.CORTEX_STATE;
  const UI = window.CORTEX_UI;
  const DATA = window.CORTEX_DATA;
  const PHASES = STATE.GAME_PHASES;

  /* -----------------------------------------------------------------------
     DOM references
  ----------------------------------------------------------------------- */

  const beginButton = document.getElementById("begin-investigation");
  const locationButtonsContainer = document.getElementById("location-buttons");

  const dialogueTextEl = document.getElementById("dialogue-text");
  const choicesPanelEl = document.getElementById("choices-panel");

  const notebookToggleButton = document.getElementById(
    "notebook-toggle-button"
  );
  const restartButton = document.getElementById("restart-case-button");
  const toggleHintsButton = document.getElementById("toggle-hints-button");

  const notebookModal = document.getElementById("notebook-modal");
  const closeNotebookButton = document.getElementById("close-notebook-button");
  const accusationForm = document.getElementById("accusation-form");

  const aboutButton = document.getElementById("about-button");
  const aboutModal = document.getElementById("about-modal");
  const closeAboutButton = document.getElementById("close-about-button");

  const helpButton = document.getElementById("help-button");
  const helpModal = document.getElementById("help-modal");
  const closeHelpButton = document.getElementById("close-help-button");

  /* -----------------------------------------------------------------------
     Small helpers
  ----------------------------------------------------------------------- */

  function on(el, event, handler) {
    if (!el) return;
    el.addEventListener(event, handler);
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove("modal--hidden");
    modalEl.hidden = false;
    // Ensure it is actually visible even if base .modal is display:none
    modalEl.style.display = "flex";
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add("modal--hidden");
    modalEl.hidden = true;
    modalEl.style.display = "none";
  }

  // Wrapper around UI.addCortexMessage that respects the CORTEX hints toggle.
  // - When hints are OFF, we still show "alert" and "critical" messages,
  //   but we suppress normal chatter.
  function cortexLog(text, severity = "normal") {
    const state = STATE.getState();
    const hintsEnabled = state.cortexHintsEnabled;

    // Always allow critical/alert
    if (!hintsEnabled && severity === "normal") {
      return;
    }

    UI.addCortexMessage(text, severity);
  }

  // Computes a pseudo-probability (0–100%) based on how strong the accusation is.
  // Weighted: culprit is 60%, motive 20%, clues 20%.
  function computeConfidencePercentage(score) {
    const clueFraction = score.criticalCluesTotal
      ? score.criticalCluesFound / score.criticalCluesTotal
      : 0;

    let value =
      (score.culpritCorrect ? 0.6 : 0) +
      (score.motiveCorrect ? 0.2 : 0) +
      clueFraction * 0.2;

    value = Math.max(0, Math.min(1, value));
    return (value * 100).toFixed(1); // e.g. "93.4"
  }

  // Auto-discover clues based on how many unique locations have been visited.
  // Returns an array of newly discovered clue objects.
  function maybeAutoDiscoverCluesAfterLocationChange() {
    const state = STATE.getState();
    const visitedCount = state.visitedLocationIds.length;
    const gained = [];

    const addIfNew = (clueId) => {
      if (!STATE.hasClue(clueId)) {
        const clue = STATE.discoverClue(clueId);
        if (clue) gained.push(clue);
      }
    };

    // After visiting at least 1 unique location
    if (visitedCount >= 1) {
      addIfNew("locked_office");
    }

    // After visiting at least 2 unique locations
    if (visitedCount >= 2) {
      addIfNew("badge_log_anomaly");
      addIfNew("audit_log_redactions");
    }

    // After visiting all 3 locations
    if (visitedCount >= 3) {
      addIfNew("rooftop_argument");
      addIfNew("victim_exit_request");
    }

    return gained;
  }

  /* -----------------------------------------------------------------------
     Core actions
  ----------------------------------------------------------------------- */

  function startInvestigation() {
    STATE.resetGameState(); // clean slate
    STATE.setPhase(PHASES.INVESTIGATION);

    // Default starting location: first in DATA.LOCATIONS
    const firstLoc = DATA.LOCATIONS[0];
    if (firstLoc) {
      STATE.setCurrentLocation(firstLoc.id);
      STATE.setDialogueContext("location", firstLoc.id, 0);
    }

    // Auto-discover any clues tied to initial visit count.
    const newClues = maybeAutoDiscoverCluesAfterLocationChange();
    newClues.forEach((clue) => {
      UI.addCortexMessage(`Clue logged: ${clue.name}.`, "normal");
    });

    cortexLog(
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
      cortexLog(`New location visited: ${location.name}.`, "normal");
    } else {
      cortexLog(`Revisiting ${location.name}.`, "normal");
    }

    // Auto-discover any clues unlocked by this visit.
    const newClues = maybeAutoDiscoverCluesAfterLocationChange();
    newClues.forEach((clue) => {
      cortexLog(`Clue logged: ${clue.name}.`, "normal");
    });

    STATE.setDialogueContext("location", locationId, 0);
    UI.renderAll();
  }

  function handleDialogueTextClick(event) {
    // Only advance when the user actually clicks the text area,
    // not if something weird bubbles in here.
    if (event.target !== dialogueTextEl) return;

    const result = STATE.advanceDialogueIndex();

    if (result === "continue") {
      UI.renderDialogue();
    } else if (result === "end") {
      // For now, we don't auto-transition on end-of-sequence.
      // You can later hook in phase changes here if desired.
    }
  }

  function openNotebook() {
    UI.renderNotebook();
    openModal(notebookModal);
  }

  function closeNotebook() {
    closeModal(notebookModal);
  }

  function restartCase() {
    STATE.resetGameState();
    STATE.setPhase(PHASES.INTRO);
    cortexLog("Case reset. Returning to briefing.", "alert");
    UI.renderAll();
  }

  function toggleHints() {
    const enabled = STATE.toggleCortexHints();
    cortexLog(
      enabled ? "CORTEX hints enabled." : "CORTEX hints muted.",
      enabled ? "normal" : "alert"
    );
    UI.renderAll();
  }

  function handleAccusationSubmit(event) {
    if (event) event.preventDefault();
    if (!accusationForm) return;

    const formData = new FormData(accusationForm);

    const suspectId = formData.get("suspect") || null;
    const motiveId = formData.get("motive") || null;
    const evidenceId = formData.get("evidence") || null;

    STATE.setAccusation({ suspectId, motiveId, evidenceId });

    const { score, endingKey } = STATE.evaluateAccusation();
    const confidence = computeConfidencePercentage(score); // "93.4"

    // Core result line
    cortexLog(`Accusation recorded. Outcome tier: ${endingKey}.`, "critical");

    // Confidence + breakdown
    cortexLog(
      `CORTEX confidence: ${confidence}% | culprit correct: ${
        score.culpritCorrect ? "yes" : "no"
      }; motive correct: ${
        score.motiveCorrect ? "yes" : "no"
      }; critical clues: ${score.criticalCluesFound}/${
        score.criticalCluesTotal
      }.`,
      "normal"
    );

    // If the player is close but not perfect, offer a "final insight"
    if (
      endingKey === "close" &&
      score.criticalCluesFound < score.criticalCluesTotal &&
      typeof STATE.revealNextCriticalClue === "function"
    ) {
      const newClue = STATE.revealNextCriticalClue();
      if (newClue) {
        cortexLog(
          `Pattern variance below threshold. Unlocking latent clue: "${newClue.name}". ` +
            `Re-open the notebook and refine your motive and key evidence.`,
          "normal"
        );
      }
    }

    UI.renderAll();
    closeNotebook();
  }

  /* -----------------------------------------------------------------------
     About / Help actions
  ----------------------------------------------------------------------- */

  function openAbout() {
    openModal(aboutModal);
  }

  function closeAbout() {
    closeModal(aboutModal);
  }

  function openHelp() {
    openModal(helpModal);
  }

  function closeHelp() {
    closeModal(helpModal);
  }

  /* -----------------------------------------------------------------------
     Event wiring
  ----------------------------------------------------------------------- */

  // Intro → Investigation
  on(beginButton, "click", startInvestigation);

  // Location navigation (event delegation)
  on(locationButtonsContainer, "click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const locId = target.dataset.locationId;
    if (!locId) return;
    goToLocation(locId);
  });

  // Notebook open/close
  on(notebookToggleButton, "click", openNotebook);
  on(closeNotebookButton, "click", closeNotebook);

  // Restart
  on(restartButton, "click", restartCase);

  // Hints toggle
  on(toggleHintsButton, "click", toggleHints);

  // Dialogue click to advance
  on(dialogueTextEl, "click", handleDialogueTextClick);

  // Accusation form
  on(accusationForm, "submit", handleAccusationSubmit);

  // About modal
  on(aboutButton, "click", openAbout);
  on(closeAboutButton, "click", closeAbout);

  // Help modal
  on(helpButton, "click", openHelp);
  on(closeHelpButton, "click", closeHelp);

  /* -----------------------------------------------------------------------
     Initial render
  ----------------------------------------------------------------------- */

  STATE.resetGameState();
  STATE.setPhase(PHASES.INTRO);
  UI.renderAll();

  cortexLog(
    "CORTEX online. Awaiting your decision to begin the investigation.",
    "normal"
  );
})();
