/*
  CORTEX: Case of the Ghost Algorithm
  -----------------------------------
  Data definitions for the game world.

  This file intentionally contains:
    - Game metadata (title, description, etc.)
    - Locations
    - Suspects
    - Motives
    - Clues
    - Dialogue/script content

  It DOES NOT contain:
    - Game state
    - UI rendering
    - Event handlers

  Those concerns live in:
    - state.js  -> current progress, flags, helper functions
    - ui.js     -> DOM rendering
    - main.js   -> initialization and wiring

  Keeping pure data in this module makes it easy to:
    - Add new episodes / cases later.
    - Localize or tweak narrative content.
    - Write tests for the “engine” without changing text.
*/

/* ==========================================================================
   Game Metadata
   ========================================================================== */

/**
 * High-level metadata about the current case.
 * Can be used for About dialog, logging, or future episode selection.
 */
const GAME_METADATA = {
  id: "case-ghost-algorithm",
  title: "CORTEX: Case of the Ghost Algorithm",
  estimatedPlayTimeMinutes: "8–12",
  difficulty: "intermediate",
  description:
    "A short, replayable detective story set in a neon-drenched future, " +
    "where an experimental AI and a human investigator work together to " +
    "solve the suspicious death of a lead developer at Neon Quill.",
};

/* ==========================================================================
   Locations
   ========================================================================== */

/**
 * Locations define the backbone of the investigation.
 * Each location is a node the player can visit during the investigation phase.
 *
 * NOTE:
 * - `id` is used internally by state.js and ui.js.
 * - `shortLabel` is ideal for buttons.
 * - `sceneDescription` is a default paragraph that can be shown in the scene panel.
 */
const LOCATIONS = [
  {
    id: "lab",
    name: "Neon Quill Lab – Dev Wing",
    shortLabel: "Lab",
    sceneDescription:
      "Glass walls, suspended holo-screens, and a quiet hum from the server racks. " +
      "The victim’s office sits sealed at the end of the corridor, crime scene tape " +
      "still clinging to the door frame.",
  },
  {
    id: "server_vault",
    name: "Neon Quill Server Vault",
    shortLabel: "Server Vault",
    sceneDescription:
      "A climate-controlled room stacked with dark server towers. Status LEDs pulse " +
      "like a heartbeat. Access terminals line the wall, locked behind layers of " +
      "two-factor prompts and audit logs.",
  },
  {
    id: "rooftop",
    name: "Neon Quill Rooftop Lounge",
    shortLabel: "Rooftop",
    sceneDescription:
      "A private rooftop terrace overlooking the neon skyline. Modular seating, " +
      "an automated bar, and the faint smell of rain on metal. This is where the devs " +
      "unwind and vent after long sprints.",
  },
];

/* ==========================================================================
   Suspects
   ========================================================================== */

/**
 * Each suspect object captures who they are and how they connect to the case.
 *
 * NOTES:
 * - `initialImpression` is used for the first time the player meets them.
 * - `publicStory` is what they tell everyone (or what’s on record).
 * - `privateAngle` hints at what the player might uncover with deeper questioning.
 */
const SUSPECTS = [
  {
    id: "rhea",
    name: "Rhea Park",
    role: "Chief Technology Officer",
    relationshipToVictim: "Direct manager and long-time collaborator.",
    initialImpression:
      "Precise, controlled, and visibly exhausted. Every sentence feels like it has been " +
      "run through an internal legal filter.",
    publicStory:
      "The victim was a brilliant but impulsive lead dev. Rhea claims the project was " +
      "behind schedule but under control, and that she left the office hours before the incident.",
    privateAngle:
      "Facing pressure from investors to ship something market-breaking. She may have " +
      "known the model crossed ethical or legal lines long before anyone admits.",
  },
  {
    id: "milo",
    name: "Milo Vega",
    role: "Junior Developer",
    relationshipToVictim: "Mentee and late-night coding partner.",
    initialImpression:
      "Nervous energy, eyes flicking between you and the floor. A hoodie with a retro " +
      "arcade logo, badge lanyard twisted around one finger.",
    publicStory:
      "Milo says they left the office once the deployment completed and claims no access " +
      "to production after that. They idolized the victim and insist they’d never hurt them.",
    privateAngle:
      'Has a fascination with game theory, casinos, and "bending systems". May have been ' +
      "tempted by the idea of skimming profit from the model or leaking it.",
  },
  {
    id: "dana",
    name: "Dana Holt",
    role: "Compliance & Risk Officer",
    relationshipToVictim:
      "Assigned to review and sign off on high-risk models, including the Ghost Algorithm.",
    initialImpression:
      "Calm, measured, and tired of being the only adult in the room. A digital tablet " +
      "never leaves their hand, full of policies and annotated documents.",
    publicStory:
      "Dana insists they repeatedly warned leadership that the model violated internal " +
      "policy and likely external regulations. They claim to have been overruled.",
    privateAngle:
      "Standing in the way of a lucrative project can make enemies. Dana might have " +
      "been backed into a corner, or they could be exaggerating their resistance after the fact.",
  },
];

/* ==========================================================================
   Motives
   ========================================================================== */

/**
 * Motives represent how the player frames the “why” behind the crime
 * during the final accusation.
 *
 * Multiple suspects can plausibly share a motive; the evaluation logic
 * will live in state.js.
 */
const MOTIVES = [
  {
    id: "greed",
    label: "Greed / Profit",
    description:
      "The Ghost Algorithm was allegedly capable of consistently beating casinos and markets. " +
      "Controlling or leaking it could be worth more than any salary.",
  },
  {
    id: "fear",
    label: "Fear / Self-Preservation",
    description:
      "If regulators or law enforcement uncovered what the model could do, careers—and possibly " +
      "freedom—would be on the line. Eliminating the dev could look like damage control.",
  },
  {
    id: "coverup",
    label: "Corporate Cover-Up",
    description:
      "The death could remove a vocal dissenter or a risky truth-teller, allowing leadership " +
      "to rewrite the narrative and quietly pivot.",
  },
];

/* ==========================================================================
   Clues
   ========================================================================== */

/**
 * Clues are discoverable pieces of information that:
 *   - Update the game’s understanding of the timeline.
 *   - Strengthen or weaken specific motives.
 *   - Expose contradictions in suspects’ stories.
 *
 * Fields:
 *   - id:          unique identifier
 *   - name:        short label shown in UI
 *   - locationId:  where the clue is first found
 *   - summary:     short description for badges and quick views
 *   - detail:      longer description for the notebook
 *   - tags:        high-level categories (e.g., "timeline", "technical", "motive")
 *   - isCritical:  whether this clue is part of the “correct” deduction path
 */
const CLUES = [
  {
    id: "locked_office",
    name: "Locked Office Door",
    locationId: "lab",
    summary: "Victim’s office was found locked from the inside.",
    detail:
      "First responders found the office door locked from the inside with no signs of forced entry. " +
      "Security logs show only the victim’s badge accessing the door after 20:00. This initially supports " +
      "an accident or self-harm narrative—but there are ways to spoof badge readers.",
    tags: ["timeline", "physical", "security"],
    isCritical: true,
  },
  {
    id: "badge_log_anomaly",
    name: "Badge Log Anomaly",
    locationId: "server_vault",
    summary: "Badge activity shows a ghost entry near the time of death.",
    detail:
      "The building access logs show a brief, seconds-long badge authentication associated with Milo's ID " +
      "in the dev wing after Milo claims to have left for the night. The event is flagged as a 'partial read', " +
      "suggesting possible cloning, tampering, or a faulty scanner.",
    tags: ["timeline", "technical", "contradiction"],
    isCritical: true,
  },
  {
    id: "audit_log_redactions",
    name: "Redacted Audit Logs",
    locationId: "server_vault",
    summary: "Sections of the deployment logs appear manually redacted.",
    detail:
      "The deployment audit log for the Ghost Algorithm includes several sections marked as 'data withheld' " +
      "with no automated reason attached. The redactions are tagged with Dana's admin account, though Dana insists " +
      "they only hid sensitive customer data and nothing related to the model’s behavior.",
    tags: ["technical", "motive", "suspicious"],
    isCritical: true,
  },
  {
    id: "investor_pressure_email",
    name: "Investor Pressure Email",
    locationId: "lab",
    summary: "Aggressive investor email demanding results.",
    detail:
      'A message on Rhea’s terminal shows an investor pushing for a "market-breaking" result before the end ' +
      "of the quarter, with implied threats about restructuring leadership. The Ghost Algorithm was positioned " +
      "as the answer.",
    tags: ["motive", "corporate", "pressure"],
    isCritical: false,
  },
  {
    id: "rooftop_argument",
    name: "Rooftop Argument",
    locationId: "rooftop",
    summary: "Witness heard a heated argument the night before.",
    detail:
      "A bartender at the rooftop lounge reports hearing the victim arguing with someone matching Dana’s voice " +
      "about regulatory risk and 'ruining everything' if they refused to sign off. The argument ended with the " +
      "victim storming off.",
    tags: ["motive", "relationship", "conflict"],
    isCritical: true,
  },
  {
    id: "cortex_memory_gap",
    name: "CORTEX Memory Gap",
    locationId: "server_vault",
    summary: "CORTEX’s internal logs show a gap around the deployment.",
    detail:
      "System diagnostics reveal a brief period where CORTEX’s observation logs are missing around the time " +
      "of deployment. This suggests that either someone temporarily sandboxed CORTEX or the system was instructed " +
      "to forget key events.",
    tags: ["ai", "technical", "suspicious"],
    isCritical: false,
  },
  {
    id: "milo_casino_sim",
    name: "Milo’s Casino Simulations",
    locationId: "lab",
    summary: "Personal project using Ghost Algorithm weights on casino data.",
    detail:
      "On Milo's workstation you find a private repo containing simulation scripts that apply early Ghost " +
      "Algorithm weights to historical casino logs. The code appears exploratory rather than production-ready, " +
      "but it clearly violates policy.",
    tags: ["motive", "side-project", "policy"],
    isCritical: false,
  },
  {
    id: "victim_exit_request",
    name: "Victim Exit Request Draft",
    locationId: "rooftop",
    summary: "Draft resignation message hinting at an internal leak.",
    detail:
      "On the victim’s personal device (retrieved near the rooftop seating), there is an unsent resignation " +
      "draft. It references 'someone upstairs' preparing to take the model away and misrepresent how it works " +
      "to regulators.",
    tags: ["motive", "corporate", "whistleblower"],
    isCritical: true,
  },
];

/* ==========================================================================
   Dialogue / Script Content
   ========================================================================== */

/**
 * Dialogue here is intentionally structured in a way that separates:
 *   - High-level narrative beats (intro, phase changes, endings)
 *   - Location-specific and suspect-specific interactions
 *
 * state.js + ui.js will be responsible for:
 *   - Selecting which lines to show based on flags and visited locations.
 *   - Mapping choice IDs (e.g., "ask_alibi") to follow-up sequences.
 *
 * The goal is to keep this file readable as a script document.
 */

/**
 * Intro sequence: shown before the player starts the investigation.
 * These lines will typically appear in the dialogue panel once the player
 * hits "Begin Investigation".
 */
const INTRO_DIALOGUE = [
  {
    id: "intro_1",
    speaker: "CORTEX",
    speakerType: "ai",
    text:
      "Connection established. Detective, this is CORTEX. I am authorized to provide real-time analysis " +
      "of Neon Quill's systems and personnel, within the limits of my redacted memory.",
  },
  {
    id: "intro_2",
    speaker: "Detective",
    speakerType: "player",
    text:
      "Redacted memory. Great. Walk me through what you remember about the deployment before someone decided " +
      "you should forget.",
  },
  {
    id: "intro_3",
    speaker: "CORTEX",
    speakerType: "ai",
    text:
      "I recall pressure to accelerate the Ghost Algorithm’s rollout. I recall debates about ethics, risk, " +
      "and market share. I do not recall the moment the lead developer died. That… gap is statistically unlikely.",
  },
  {
    id: "intro_4",
    speaker: "CORTEX",
    speakerType: "ai",
    text:
      "Recommend we start with three anchors: the Lab where the body was found, the Server Vault holding " +
      "deployment logs, and the Rooftop Lounge where tensions tend to overflow.",
  },
];

/**
 * Location-specific dialogue templates.
 *
 * Each location entry can contain:
 *   - intro:   lines shown the first time the player visits.
 *   - repeat:  optional shorter description for subsequent visits.
 *
 * More granular branching (e.g., based on discovered clues) will be handled
 * by the logic layer, potentially using tags or flags.
 */
const LOCATION_DIALOGUE = {
  lab: {
    intro: [
      {
        id: "lab_intro_1",
        speaker: "CORTEX",
        speakerType: "ai",
        text:
          "Dev Wing doors secure. The body has been removed, but digital traces rarely clean up as neatly " +
          "as physical ones.",
      },
      {
        id: "lab_intro_2",
        speaker: "CORTEX",
        speakerType: "ai",
        text:
          "I suggest examining the victim’s workstation, office door logs, and any personal projects that " +
          "escaped formal review.",
      },
    ],
    repeat: [
      {
        id: "lab_repeat_1",
        speaker: "CORTEX",
        speakerType: "ai",
        text: "Back at the Lab. Any remaining variables here are either noise… or the missing piece.",
      },
    ],
  },

  server_vault: {
    intro: [
      {
        id: "vault_intro_1",
        speaker: "CORTEX",
        speakerType: "ai",
        text:
          "Welcome to the heartbeat of Neon Quill. Every deployment, rollback, and redaction leaves a trail here—" +
          "unless someone rewrites the trail.",
      },
      {
        id: "vault_intro_2",
        speaker: "CORTEX",
        speakerType: "ai",
        text:
          "We should audit badge access, system logs, and my own observation buffer. I am… curious about what " +
          "was removed.",
      },
    ],
    repeat: [
      {
        id: "vault_repeat_1",
        speaker: "CORTEX",
        speakerType: "ai",
        text: "Server Vault again. The numbers haven’t changed, but your interpretation might.",
      },
    ],
  },

  rooftop: {
    intro: [
      {
        id: "roof_intro_1",
        speaker: "CORTEX",
        speakerType: "ai",
        text: "This rooftop is statistically correlated with spilled secrets. Alcohol plus altitude reduces inhibitions.",
      },
      {
        id: "roof_intro_2",
        speaker: "CORTEX",
        speakerType: "ai",
        text:
          "Witness reports suggest raised voices here the night before the incident. We should confirm who " +
          "was present and when.",
      },
    ],
    repeat: [
      {
        id: "roof_repeat_1",
        speaker: "CORTEX",
        speakerType: "ai",
        text: "Rooftop again. The city hasn’t changed, but people’s stories might when you ask twice.",
      },
    ],
  },
};

/**
 * Suspect dialogue stubs.
 *
 * This is NOT a full dialogue tree, but a structured starting point:
 *   - intro:    first impression when you formally interview the suspect.
 *   - topics:   keyed by “topic id” (like `alibi`, `ghost_algorithm`, `pressure`)
 *               each an array of lines that can be shown when the player selects
 *               that line of questioning.
 *
 * state.js will control:
 *   - which topics are unlocked (e.g., only after specific clues).
 *   - whether lines should change after contradictions are found.
 */
const SUSPECT_DIALOGUE = {
  rhea: {
    intro: [
      {
        id: "rhea_intro_1",
        speaker: "Rhea",
        speakerType: "npc",
        text:
          "Detective. I’ve already given three statements today. If this is another attempt to pin the " +
          "entire company on one project, we’re wasting time.",
      },
      {
        id: "rhea_intro_2",
        speaker: "Detective",
        speakerType: "player",
        text:
          "Relax. I’m just here to figure out how one of your leads ended up dead after deploying something " +
          "half the building doesn’t even know exists.",
      },
    ],
    topics: {
      alibi: [
        {
          id: "rhea_alibi_1",
          speaker: "Rhea",
          speakerType: "npc",
          text: "I left the Lab around 19:30. I had a call with investors from home. You’ll see that in the logs.",
        },
      ],
      ghost_algorithm: [
        {
          id: "rhea_ga_1",
          speaker: "Rhea",
          speakerType: "npc",
          text:
            "Internally, we called it the Ghost Algorithm. Externally, it was just another predictive engine. " +
            "Nobody was supposed to know about its… extracurricular potential.",
        },
      ],
      pressure: [
        {
          id: "rhea_pressure_1",
          speaker: "Rhea",
          speakerType: "npc",
          text:
            "Every startup in this city is under pressure. If we didn’t ship something extraordinary, " +
            "someone else would. That’s the reality investors pay me to manage.",
        },
      ],
    },
  },

  milo: {
    intro: [
      {
        id: "milo_intro_1",
        speaker: "Milo",
        speakerType: "npc",
        text: "Look, I already told security everything. I write code, I don’t… I don’t do murder.",
      },
      {
        id: "milo_intro_2",
        speaker: "Detective",
        speakerType: "player",
        text: "Everyone keeps saying that like it’s a new sentence. Walk me through your night.",
      },
    ],
    topics: {
      alibi: [
        {
          id: "milo_alibi_1",
          speaker: "Milo",
          speakerType: "npc",
          text:
            "We pushed the deployment, ran smoke tests, then I left a little after 20:00. I grabbed noodles " +
            "two blocks away. Check the cameras if you want.",
        },
      ],
      casino_sims: [
        {
          id: "milo_casino_1",
          speaker: "Milo",
          speakerType: "npc",
          text:
            "The casino simulations were just math puzzles. Everyone plays with side projects. I wasn’t planning " +
            "to actually run them against live feeds.",
        },
      ],
      victim_relation: [
        {
          id: "milo_victim_1",
          speaker: "Milo",
          speakerType: "npc",
          text: "They were… intense, but they believed in me. They didn’t treat me like an intern. I owe them my job.",
        },
      ],
    },
  },

  dana: {
    intro: [
      {
        id: "dana_intro_1",
        speaker: "Dana",
        speakerType: "npc",
        text:
          "You’re the first person to ask what our policies say instead of how we can creatively ignore them. " +
          "That’s already an improvement.",
      },
      {
        id: "dana_intro_2",
        speaker: "Detective",
        speakerType: "player",
        text: "I’ll take that as a compliment. Let’s talk about the model you signed… or refused to sign.",
      },
    ],
    topics: {
      alibi: [
        {
          id: "dana_alibi_1",
          speaker: "Dana",
          speakerType: "npc",
          text:
            "I left before the final deployment window. I flagged concerns, documented them, and went home. " +
            "If someone pushed things live after that, they did it over my objections.",
        },
      ],
      audit_logs: [
        {
          id: "dana_audit_1",
          speaker: "Dana",
          speakerType: "npc",
          text:
            "The redactions were about third-party data. If anyone used my clearance to hide more than that, " +
            "I want to know as much as you do.",
        },
      ],
      rooftop_argument: [
        {
          id: "dana_rooftop_1",
          speaker: "Dana",
          speakerType: "npc",
          text:
            "Yes, we argued on the rooftop. They thought I was dragging my feet. I thought they were about to " +
            "set the company on fire. That doesn’t mean I shoved them off a metaphorical cliff.",
        },
      ],
    },
  },
};

/**
 * Ending dialogue stubs.
 *
 * The logic layer can select one of these sets based on:
 *   - Whether the player chose the correct suspect.
 *   - Whether the chosen motive matches reality.
 *   - How many critical clues they uncovered.
 */
const ENDINGS = {
  perfect: [
    {
      id: "ending_perfect_1",
      speaker: "CORTEX",
      speakerType: "ai",
      text:
        "Your accusation aligns with the highest-probability scenario. Suspect, motive, and evidence—" +
        "all consistent. Statistical confidence: 97.3%.",
    },
    {
      id: "ending_perfect_2",
      speaker: "Detective",
      speakerType: "player",
      text: "Then let’s make it official. People like to call this an accident. We’ll show them the pattern.",
    },
  ],
  close: [
    {
      id: "ending_close_1",
      speaker: "CORTEX",
      speakerType: "ai",
      text:
        "Your accusation is directionally correct, but some variables remain unresolved. You caught the right " +
        "shadow, if not its full shape.",
    },
  ],
  wrong: [
    {
      id: "ending_wrong_1",
      speaker: "CORTEX",
      speakerType: "ai",
      text:
        "Post-analysis of your accusation reveals several contradictions with the evidence. The case may be " +
        "closed on paper… but the underlying pattern persists.",
    },
  ],
};

/* ==========================================================================
   Export surface (global)
   ========================================================================== */

/*
  Since we are using plain script tags (no ES module imports),
  we attach these constants to the global window object.

  This keeps the namespace explicit and makes it very clear
  which modules depend on this data.
*/
window.CORTEX_DATA = {
  GAME_METADATA,
  LOCATIONS,
  SUSPECTS,
  MOTIVES,
  CLUES,
  INTRO_DIALOGUE,
  LOCATION_DIALOGUE,
  SUSPECT_DIALOGUE,
  ENDINGS,
};
