/*
  CORTEX: Case of the Ghost Algorithm
  -----------------------------------
  Game state management and core evaluation logic.

  Responsibilities of this module:
    - Define game phases and the shape of the state object.
    - Provide functions to initialize, read, and update state.
    - Provide helper utilities to look up locations, suspects, and clues.
    - Evaluate the player's final accusation and determine an ending.

  This module deliberately avoids:
    - Direct DOM manipulation (handled in ui.js).
    - Event listener wiring (handled in main.js).

  All functions that need to be used elsewhere are exposed via window.CORTEX_STATE.
*/

/* ==========================================================================
   Precondition: CORTEX_DATA must be loaded
   ========================================================================== */

if (!window.CORTEX_DATA) {
  // This is a hard dependency; if it fails, we want an obvious error.
  throw new Error(
    "CORTEX_STATE: window.CORTEX_DATA is not available. Ensure data.js is loaded before state.js."
  );
}

/* ==========================================================================
   Game Phases
   ========================================================================== */

/**
 * Enumeration of high-level phases the game can be in.
 *
 * These are intentionally coarse-grained; finer-grained steps
 * (e.g., "location_intro") can be represented using flags in state.
 */
const GAME_PHASES = Object.freeze({
  INTRO: "intro", // Pre-investigation; player hasn't started yet.
  INVESTIGATION: "investigation", // Player can move between locations, question suspects, gather clues.
  DEDUCTION: "deduction", // Player reviewing notebook, thinking through the case.
  ACCUSATION: "accusation", // Player has submitted an accusation; evaluation in progress.
  ENDING: "ending", // Displaying narrative ending for the current run.
});

/* ==========================================================================
   Case "Truth" Definition
   ========================================================================== */

/**
 * Canonical "truth" for this case.
 *
 * This represents the correct solution from the game's perspective.
 * The evaluation logic compares the player's accusation against this.
 *
 * NOTE: If you want to create alternate episodes, you can replace this
 * block with data-driven configuration.
 */
const CASE_SOLUTION = Object.freeze({
  culpritId: "rhea", // Rhea Park is the true killer in this scenario.
  motiveId: "coverup", // Corporate Cover-Up: silencing a whistleblower / rewriting the narrative.
  criticalClueIds: [
    "locked_office",
    "badge_log_anomaly",
    "audit_log_redactions",
    "rooftop_argument",
    "victim_exit_request",
  ],
});

/* ==========================================================================
   State Shape and Initialization
   ========================================================================== */

/**
 * Returns a fresh game state object.
 *
 * IMPORTANT:
 *  - This should not be mutated directly outside of this module.
 *    Use the exported helper functions to modify state.
 *  - If we later add persistence (localStorage), this function
 *    becomes the single source of truth for default values.
 */
function createInitialState() {
  // Initialize suspect intro flags and unlocked topics.
  const suspectIntroSeen = {};
  const unlockedTopicsBySuspect = {};
  SUSPECTS.forEach((suspect) => {
    suspectIntroSeen[suspect.id] = false;
    unlockedTopicsBySuspect[suspect.id] = new Set(); // We'll convert to arrays if needed for serialization.
  });

  return {
    // High-level progression
    phase: GAME_PHASES.INTRO,

    // Location tracking
    currentLocationId: null,
    previousLocationId: null,
    visitedLocationIds: [],

    // Clues / evidence
    discoveredClueIds: [],

    // Lab-specific action tracking (per run)
    labActionsUsed: new Set(), // e.g., {"lab_deep_scan": true, ... }

    // Global branching flags (for narrative / scoring nuances)
    flags: {},

    // Dialogue context
    /**
     * The current "dialogue context" indicates what type of
     * narrative is active in the dialogue panel.
     *
     * kind:
     *   - "intro"     -> using INTRO_DIALOGUE
     *   - "location"  -> LOCATION_DIALOGUE[locationId]
     *   - "suspect"   -> SUSPECT_DIALOGUE[suspectId]
     *   - "ending"    -> ENDINGS[endingKey]
     */
    dialogueContext: {
      kind: "intro",
      targetId: null, // locationId, suspectId, or endingKey depending on kind
      index: 0, // index within the relevant dialogue array
    },

    // Suspect-related flags
    suspectIntroSeen,
    unlockedTopicsBySuspect,

    // CORTEX behavior
    cortexHintsEnabled: true,

    // Player's final accusation (once submitted)
    accusation: {
      suspectId: null,
      motiveId: null,
      evidenceId: null, // Single “key evidence” clue selected in the form
    },

    // Evaluation and ending
    endingKey: null, // "perfect" | "close" | "wrong"
    score: {
      // Scores are intentionally simple; they can be expanded later.
      culpritCorrect: false,
      motiveCorrect: false,
      criticalCluesFound: 0,
      criticalCluesTotal: CASE_SOLUTION.criticalClueIds.length,
    },
  };
}

/**
 * Internal mutable state instance.
 * External consumers should access it via getState().
 */
let currentState = createInitialState();

/* ==========================================================================
   Internal Utility Helpers
   ========================================================================== */

/**
 * Returns a location object by id, or undefined if not found.
 */
function findLocationById(locationId) {
  return LOCATIONS.find((loc) => loc.id === locationId);
}

/**
 * Returns a suspect object by id, or undefined if not found.
 */
function findSuspectById(suspectId) {
  return SUSPECTS.find((sus) => sus.id === suspectId);
}

/**
 * Returns a motive object by id, or undefined if not found.
 */
function findMotiveById(motiveId) {
  return MOTIVES.find((mot) => mot.id === motiveId);
}

/**
 * Returns a clue object by id, or undefined if not found.
 */
function findClueById(clueId) {
  return CLUES.find((clue) => clue.id === clueId);
}

/**
 * Adds a value to an array if it is not already present.
 * Returns true if the value was added, false if it was already present.
 */
function addUniqueToArray(arr, value) {
  if (!arr.includes(value)) {
    arr.push(value);
    return true;
  }
  return false;
}

/* ==========================================================================
   Public State Accessors
   ========================================================================== */

/**
 * Returns the current state object.
 *
 * NOTE:
 *  - This returns the actual state reference to keep things simple.
 *  - ui.js and main.js should treat it as read-only, and use the
 *    mutation helpers defined in this module when changes are needed.
 *
 * If you find accidental direct mutation becoming an issue, you can
 * harden this later by returning a deep-frozen clone instead.
 */
function getState() {
  return currentState;
}

/**
 * Resets the current state to a brand-new game.
 */
function resetGameState() {
  currentState = createInitialState();
}

/* ==========================================================================
   Phase & Location Management
   ========================================================================== */

/**
 * Sets the current game phase.
 * This is the primary way to transition between major screens.
 */
function setPhase(phase) {
  if (!Object.values(GAME_PHASES).includes(phase)) {
    console.warn(`CORTEX_STATE: Attempted to set unknown phase "${phase}".`);
    return;
  }
  currentState.phase = phase;

  // When entering INTRO, reset the dialogue context to the intro sequence.
  if (phase === GAME_PHASES.INTRO) {
    currentState.dialogueContext = {
      kind: "intro",
      targetId: null,
      index: 0,
    };
  }
}

/**
 * Sets the current location during the investigation phase.
 * Also tracks visited locations and updates the dialogue context to
 * the appropriate location intro or repeat lines.
 */
function setCurrentLocation(locationId) {
  const location = findLocationById(locationId);
  if (!location) {
    console.warn(`CORTEX_STATE: Unknown locationId "${locationId}".`);
    return;
  }

  // Record previous location for potential transitions/animations.
  currentState.previousLocationId = currentState.currentLocationId;
  currentState.currentLocationId = locationId;

  // Record as visited (unique).
  const isFirstVisit = addUniqueToArray(
    currentState.visitedLocationIds,
    locationId
  );

  // Update dialogue context for this location.
  currentState.dialogueContext = {
    kind: "location",
    targetId: locationId,
    index: 0, // Start at the beginning of intro/repeat script for this location.
  };

  return { location, isFirstVisit };
}

/**
 * Returns true if the player has visited the given location at least once.
 */
function hasVisitedLocation(locationId) {
  return currentState.visitedLocationIds.includes(locationId);
}

/* ==========================================================================
   Clue Management
   ========================================================================== */

/**
 * Marks the given clue as discovered, if it exists.
 * Returns the clue object if it was newly discovered, or null if it was
 * already known or not found.
 */
function discoverClue(clueId) {
  const clue = findClueById(clueId);
  if (!clue) {
    console.warn(`CORTEX_STATE: Unknown clueId "${clueId}".`);
    return null;
  }

  const added = addUniqueToArray(currentState.discoveredClueIds, clueId);
  return added ? clue : null;
}

/**
 * Returns true if the clue has been discovered.
 */
function hasClue(clueId) {
  return currentState.discoveredClueIds.includes(clueId);
}

/**
 * Returns all discovered clue objects in the order they were found.
 */
function getDiscoveredClues() {
  return currentState.discoveredClueIds
    .map((id) => findClueById(id))
    .filter(Boolean);
}

/**
 * Reveals the next undiscovered "critical" clue from CASE_SOLUTION.criticalClueIds,
 * in the order defined in CASE_SOLUTION.
 *
 * Returns the newly discovered clue object, or null if there are none left.
 */
function revealNextCriticalClue() {
  const remaining = CASE_SOLUTION.criticalClueIds.filter(
    (id) => !currentState.discoveredClueIds.includes(id)
  );
  if (remaining.length === 0) return null;

  const nextId = remaining[0];
  return discoverClue(nextId); // returns the clue object or null
}

/* ==========================================================================
   Suspect & Topic Management
   ========================================================================== */

/**
 * Marks that the intro dialogue for a suspect has been seen.
 */
function markSuspectIntroSeen(suspectId) {
  if (!currentState.suspectIntroSeen.hasOwnProperty(suspectId)) {
    console.warn(
      `CORTEX_STATE: Unknown suspectId "${suspectId}" in intro tracking.`
    );
    return;
  }
  currentState.suspectIntroSeen[suspectId] = true;
}

/**
 * Returns true if the intro for the suspect has been shown.
 */
function isSuspectIntroSeen(suspectId) {
  return !!currentState.suspectIntroSeen[suspectId];
}

/**
 * Unlocks a topic (line of questioning) for a given suspect.
 * Typically used when a clue or event reveals a new angle.
 */
function unlockSuspectTopic(suspectId, topicId) {
  const topicsBySuspect = currentState.unlockedTopicsBySuspect[suspectId];
  if (!topicsBySuspect) {
    console.warn(
      `CORTEX_STATE: Unknown suspectId "${suspectId}" in topic unlock.`
    );
    return;
  }
  topicsBySuspect.add(topicId);
}

/**
 * Returns an array of topic IDs that are unlocked for the suspect.
 */
function getUnlockedTopicsForSuspect(suspectId) {
  const topicsBySuspect = currentState.unlockedTopicsBySuspect[suspectId];
  if (!topicsBySuspect) return [];
  return Array.from(topicsBySuspect);
}

/* ==========================================================================
   Lab Action Tracking
   ========================================================================== */

/**
 * Marks a lab action as used for the current run.
 * actionId should match the data-action-id used in the UI.
 */
function markLabActionUsed(actionId) {
  // Ensure we always work with a Set, even if something reset it.
  if (
    !currentState.labActionsUsed ||
    !(currentState.labActionsUsed instanceof Set)
  ) {
    currentState.labActionsUsed = new Set();
  }

  currentState.labActionsUsed.add(actionId);
}

/**
 * Returns true if the given lab action has been used in this run.
 */
function isLabActionUsed(actionId) {
  const used = currentState.labActionsUsed;
  if (!used || !(used instanceof Set)) return false;
  return used.has(actionId);
}

/* ==========================================================================
   Branching Flag Management
   ========================================================================== */

function setFlag(flagName, value = true) {
  if (!currentState.flags) {
    currentState.flags = {};
  }
  currentState.flags[flagName] = value;
}

function getFlag(flagName) {
  if (!currentState.flags) return false;
  return !!currentState.flags[flagName];
}

function clearFlag(flagName) {
  if (!currentState.flags) return;
  if (flagName in currentState.flags) {
    delete currentState.flags[flagName];
  }
}

/* ==========================================================================
   Dialogue Context Management
   ========================================================================== */

/**
 * Advances the current dialogue context index by one, if possible.
 *
 * Returns:
 *   - "continue" if there are more lines to show in the current context.
 *   - "end" if we've reached the end of the context's lines.
 *
 * The UI layer can use this to decide whether to show more narrative text
 * or wait for player choices.
 */
function advanceDialogueIndex() {
  const ctx = currentState.dialogueContext;

  let dialogueArray;

  switch (ctx.kind) {
    case "intro":
      dialogueArray = INTRO_DIALOGUE;
      break;
    case "location": {
      const locScript = LOCATION_DIALOGUE[ctx.targetId];
      if (!locScript) {
        console.warn(
          `CORTEX_STATE: No LOCATION_DIALOGUE entry for "${ctx.targetId}".`
        );
        return "end";
      }
      // For now, always use the intro script sequence when in a location context.
      dialogueArray = locScript.intro;
      break;
    }
    case "suspect": {
      // For suspects, the UI will likely handle topic-level sequencing,
      // so this context may just be used for intro lines.
      const suspectScript = SUSPECT_DIALOGUE[ctx.targetId];
      if (!suspectScript) {
        console.warn(
          `CORTEX_STATE: No SUSPECT_DIALOGUE entry for "${ctx.targetId}".`
        );
        return "end";
      }
      dialogueArray = suspectScript.intro;
      break;
    }
    case "ending": {
      const endingScript = ENDINGS[ctx.targetId];
      if (!endingScript) {
        console.warn(`CORTEX_STATE: No ENDINGS entry for "${ctx.targetId}".`);
        return "end";
      }
      dialogueArray = endingScript;
      break;
    }
    default:
      console.warn(
        `CORTEX_STATE: Unknown dialogue context kind "${ctx.kind}".`
      );
      return "end";
  }

  if (!dialogueArray || dialogueArray.length === 0) {
    return "end";
  }

  const nextIndex = ctx.index + 1;
  if (nextIndex < dialogueArray.length) {
    currentState.dialogueContext.index = nextIndex;
    return "continue";
  }

  // Already at the end of this dialogue sequence.
  return "end";
}

/**
 * Sets the dialogue context explicitly.
 * Useful when switching between intro, location, suspect, and ending sequences.
 */
function setDialogueContext(kind, targetId, index = 0) {
  currentState.dialogueContext = { kind, targetId, index };
}

/* ==========================================================================
   CORTEX Behavior
   ========================================================================== */

/**
 * Toggles whether CORTEX hints are enabled.
 */
function toggleCortexHints() {
  currentState.cortexHintsEnabled = !currentState.cortexHintsEnabled;
  return currentState.cortexHintsEnabled;
}

/* ==========================================================================
   Accusation & Evaluation
   ========================================================================== */

/**
 * Records the player's final accusation before evaluation.
 */
function setAccusation({ suspectId, motiveId, evidenceId }) {
  // Basic sanity checking; allow null values but warn.
  if (suspectId && !findSuspectById(suspectId)) {
    console.warn(
      `CORTEX_STATE: setAccusation received unknown suspectId "${suspectId}".`
    );
  }
  if (motiveId && !findMotiveById(motiveId)) {
    console.warn(
      `CORTEX_STATE: setAccusation received unknown motiveId "${motiveId}".`
    );
  }
  if (evidenceId && !findClueById(evidenceId)) {
    console.warn(
      `CORTEX_STATE: setAccusation received unknown evidenceId "${evidenceId}".`
    );
  }

  currentState.accusation = { suspectId, motiveId, evidenceId };
}

/**
 * Evaluates the current accusation against the case solution, computes a score,
 * and determines which ending to show.
 *
 * Returns the updated score object and ending key.
 */
function evaluateAccusation() {
  const { suspectId, motiveId } = currentState.accusation;

  const culpritCorrect = suspectId === CASE_SOLUTION.culpritId;
  const motiveCorrect = motiveId === CASE_SOLUTION.motiveId;

  const criticalFoundCount = CASE_SOLUTION.criticalClueIds.filter((id) =>
    currentState.discoveredClueIds.includes(id)
  ).length;

  const criticalTotal = CASE_SOLUTION.criticalClueIds.length;

  // Determine ending tier based on correctness and thoroughness.
  let endingKey = "wrong";

  if (culpritCorrect && motiveCorrect && criticalFoundCount === criticalTotal) {
    endingKey = "perfect";
  } else if (
    culpritCorrect &&
    (motiveCorrect || criticalFoundCount >= Math.ceil(criticalTotal / 2))
  ) {
    endingKey = "close";
  } else {
    endingKey = "wrong";
  }

  currentState.score = {
    culpritCorrect,
    motiveCorrect,
    criticalCluesFound: criticalFoundCount,
    criticalCluesTotal: criticalTotal,
  };

  currentState.endingKey = endingKey;
  currentState.phase = GAME_PHASES.ENDING;

  // Set dialogue context to the chosen ending script.
  currentState.dialogueContext = {
    kind: "ending",
    targetId: endingKey,
    index: 0,
  };

  return {
    score: currentState.score,
    endingKey,
  };
}

/* ==========================================================================
   Export Surface
   ========================================================================== */

/**
 * Attach the state API to the global window object so ui.js and main.js
 * can orchestrate behavior without reaching into internals.
 */
window.CORTEX_STATE = {
  // Metadata and enums
  GAME_METADATA,
  GAME_PHASES,

  // Core state access
  getState,
  resetGameState,

  // Lookup helpers
  findLocationById,
  findSuspectById,
  findMotiveById,
  findClueById,

  // Phase & location
  setPhase,
  setCurrentLocation,
  hasVisitedLocation,

  // Clues
  discoverClue,
  hasClue,
  getDiscoveredClues,
  revealNextCriticalClue,

  // Suspects/topics
  markSuspectIntroSeen,
  isSuspectIntroSeen,
  unlockSuspectTopic,
  getUnlockedTopicsForSuspect,

  // Lab actions
  markLabActionUsed,
  isLabActionUsed,

  // Dialogue context
  advanceDialogueIndex,
  setDialogueContext,

  // CORTEX behavior
  toggleCortexHints,

  // Branching flags
  setFlag,
  getFlag,
  clearFlag,

  // Accusation/evaluation
  setAccusation,
  evaluateAccusation,
};
