/* ── slack.js ── Synko Slack Workspace
 *
 * The Slack-side experience for Synko. Pet lives here:
 *   /init     — hatch the project pet (modal: project setup → species → hatch)
 *   /zoom     — open the meeting popup to start a live meeting
 *   /feed     — feed the next treat to the pet
 *   /pet      — focus the right-rail PetHome
 *   /help     — list commands
 *
 * Pet state persists to localStorage under `mp_initiated_pet` so the Chrome
 * extension popup + live-meeting screens can read it (and post-meeting treats
 * flow back into this Slack via `mp_pending_zoom_report`).
 */

// ── Storage helper (works in extension + browser preview) ─────────────────────
const isExtension = typeof chrome !== 'undefined' && chrome.storage;

const Store = {
  get(key) {
    if (isExtension) return new Promise(res => chrome.storage.local.get(key, res));
    try { return Promise.resolve({ [key]: JSON.parse(localStorage.getItem(key)) }); }
    catch { return Promise.resolve({ [key]: null }); }
  },
  set(obj) {
    if (isExtension) return new Promise(res => chrome.storage.local.set(obj, res));
    Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    return Promise.resolve();
  },
  remove(key) {
    if (isExtension) return new Promise(res => chrome.storage.local.remove(key, res));
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};

// Mirror: also write to localStorage so non-extension contexts can read.
function persistInitiatedPet(state) {
  localStorage.setItem('mp_initiated_pet', JSON.stringify(state));
  if (isExtension) chrome.storage.local.set({ mp_initiated_pet: state });
}
function loadInitiatedPet() {
  try { return JSON.parse(localStorage.getItem('mp_initiated_pet') || 'null'); }
  catch { return null; }
}

// ── Pet species coaching content (mirror of slack-pet/content/pets.ts) ────────
// Indexed identically to PET_SPRITES in pets.js.
const PET_META = [
  { kind: 'yellow cat',    intro: "I'll be around. Mostly when you've written more than you needed to.", coachingFocus: "Helps over-explainers tighten messages. Constraint first, context after." },
  { kind: 'purple cat',    intro: "I see what you don't say. I'll only mention it when it matters.", coachingFocus: "Helps people who hedge, strategize their phrasing, or hide uncertainty." },
  { kind: 'brown dog',     intro: "Took me a while to come out. That's how I am. We can go at your speed. Or slower.", coachingFocus: "Helps quiet operators ask sooner instead of grinding solo for too long." },
  { kind: 'pink dog',      intro: "I run hot. I'll tell you straight and I'll mean it kindly. That's the deal.", coachingFocus: "Helps people who hedge or soften too much to say the real thing kindly." },
  { kind: 'purple dog',    intro: "I'm new here. I'm going to push you to ask for help more than your instinct says to.", coachingFocus: "Helps people who default to solo execution to reach for teammates earlier." },
  { kind: 'capybara',      intro: "I take it slow. I'll show up when the team's pace is running ahead of its breath.", coachingFocus: "Helps teams running anxious or frantic ease the cadence — same momentum, less heat." },
  { kind: 'orange beaver', intro: "I build. I'll point at the load-bearing pieces when things start sagging.", coachingFocus: "Helps teams turn loose work into visible milestones and shared rhythms." },
  { kind: 'pink beaver',   intro: "Soft on the outside, sturdy underneath. Lean on me when the work's getting heavy.", coachingFocus: "Helps teams keep warmth in the build — checking in on people, not just tasks." },
  { kind: 'baby capybara', intro: "Still figuring it out — same as you. We can take this slow together.", coachingFocus: "Helps small or new teams find a steady pace before patterns harden." },
];

// ── Slash commands ────────────────────────────────────────────────────────────
const COMMANDS = [
  { name: '/init',     desc: 'Hatch the project pet (leader sets the project up)' },
  { name: '/zoom',     desc: 'Open the meeting popup to start a live meeting' },
  { name: '/feed',     desc: 'Feed the next treat to the pet' },
  { name: '/pet',      desc: 'Focus the pet home panel on the right' },
  { name: '/help',     desc: 'Show this list' },
  // ── Demo conversations ──
  { name: '/standup',  desc: 'Demo: morning standup — team posts status updates' },
  { name: '/blocker',  desc: 'Demo: someone hits a blocker; team rallies in real time' },
  { name: '/launch',   desc: 'Demo: chaotic launch-day thread (lots of vague messages)' },
  { name: '/scenario', desc: 'Demo: Lesley sends a vague ask — coach yourself' },
  // ── AI replies ──
  { name: '/ai',       desc: 'Toggle AI teammate replies on/off (uses your Anthropic key)' },
];

// ── Treats library (matches treats.js) ────────────────────────────────────────
const SLACK_TREATS = {
  apple:     { emoji: '🍎', name: 'Apple',     meaning: 'Clarifying question' },
  cake:      { emoji: '🎂', name: 'Cake',      meaning: 'Deadline named' },
  cookie:    { emoji: '🍪', name: 'Cookie',    meaning: 'Process question' },
  carrot:    { emoji: '🥕', name: 'Carrot',    meaning: 'Jargon translated' },
  star:      { emoji: '⭐', name: 'Star',      meaning: 'Action item defined' },
  candy:     { emoji: '🍬', name: 'Candy',     meaning: 'Cross-team alignment' },
  blueberry: { emoji: '🫐', name: 'Blueberry', meaning: 'Follow-up scheduled' },
  gem:       { emoji: '💎', name: 'Gem',       meaning: 'Problem resolved' },
};

// ── Teammates ────────────────────────────────────────────────────────────────
const TEAMMATES = {
  Lesley: { avatar: 'L', color: '#C060FF' },
  Steve:  { avatar: 'S', color: '#FFD040' },
  Alex:   { avatar: 'A', color: '#40E080' },
  Mary:   { avatar: 'M', color: '#7c3aed' },
  Devon:  { avatar: 'D', color: '#0ea5e9' },
};

// ── Channel data (existing scripted content) ─────────────────────────────────
const CHANNELS = {
  'proj-pomegranate': {
    name: '# proj-pomegranate',
    topic: 'Q3 launch — pet lives here',
    messages: [
      { user: 'Mary',   avatar: 'M', color: TEAMMATES.Mary.color,   time: '10:01 AM', text: "kicking off proj-pomegranate today. let's gooo 🍅" },
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '10:03 AM', text: 'Welcome team! Big week — copy + visuals + budget all need to land.' },
      { user: 'Steve',  avatar: 'S', color: TEAMMATES.Steve.color,  time: '10:05 AM', text: "I'll handle the social copy this week." },
      { user: 'Alex',   avatar: 'A', color: TEAMMATES.Alex.color,   time: '10:08 AM', text: "Mockups going up in #design. Looking for sign-off by Thursday EOD." },
    ],
    replies: [
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, delay: 2200, text: "Thanks for jumping in! Let us know when it's done so we can mark it off." },
      { user: 'Mary',   avatar: 'M', color: TEAMMATES.Mary.color,   delay: 5500, text: "Great. I'll loop in eng on the timing once copy lands." },
    ],
  },
  general: {
    name: '# general',
    topic: 'Team announcements and watercooler chat',
    messages: [
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '8:58 AM', text: 'Good morning everyone! 👋 Quick heads-up — Q3 campaign brief is due this Friday.' },
      { user: 'Steve',  avatar: 'S', color: TEAMMATES.Steve.color,  time: '9:00 AM', text: 'Thanks for the reminder. Do we have a shared doc for it yet?' },
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '9:01 AM', text: "Yes! I dropped the link in #marketing yesterday. Alex, you're handling the visuals section, right?" },
      { user: 'Alex',   avatar: 'A', color: TEAMMATES.Alex.color,   time: '9:02 AM', text: "Yep, I've already got the hero banner done. Will add the rest of the assets by Thursday noon." },
      { user: 'Steve',  avatar: 'S', color: TEAMMATES.Steve.color,  time: '9:08 AM', text: 'I can draft it. @You, can you review it before I send? Takes 5 mins.' },
    ],
    replies: [
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, delay: 2200, text: "Thanks for jumping in! Let us know when it's done so we can mark it off." },
      { user: 'Alex',   avatar: 'A', color: TEAMMATES.Alex.color,   delay: 4500, text: "Appreciate it 🙌 I'll make sure my design section is ready before your copy review is done." },
    ],
  },
  marketing: {
    name: '# marketing',
    topic: 'Q3 campaign planning, briefs, and assets',
    messages: [
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '8:30 AM', text: "Morning team! I've opened up the Q3 brief doc." },
      { user: 'Alex',   avatar: 'A', color: TEAMMATES.Alex.color,   time: '8:32 AM', text: "Got it, opening now. Looks like the social copy section is still blank." },
      { user: 'Steve',  avatar: 'S', color: TEAMMATES.Steve.color,  time: '8:36 AM', text: "Not yet. I can do it." },
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '8:42 AM', text: "@You — are you able to take the budget update? You have the latest numbers from the finance sync." },
    ],
    replies: [
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, delay: 2000, text: "Great, thank you! Once the budget is updated, I'll send it to finance for sign-off." },
    ],
  },
  design: {
    name: '# design',
    topic: 'Mockups, assets, and creative direction',
    messages: [
      { user: 'Alex',   avatar: 'A', color: TEAMMATES.Alex.color,   time: '9:45 AM', text: "Hey team! I've uploaded the updated banner mockups to Figma — three variations." },
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '9:48 AM', text: "Oh these look really clean! I love variation B the most." },
      { user: 'Steve',  avatar: 'S', color: TEAMMATES.Steve.color,  time: '9:50 AM', text: "Agreed, B is strong. The typography feels more on-brand than A." },
      { user: 'Alex',   avatar: 'A', color: TEAMMATES.Alex.color,   time: '9:51 AM', text: "Glad you like it! @You — what do you think? You've seen the client brand guidelines most recently." },
    ],
    replies: [
      { user: 'Alex',   avatar: 'A', color: TEAMMATES.Alex.color,   delay: 1800, text: "Great feedback! I'll move forward with variation B then." },
    ],
  },
  dev: {
    name: '# dev',
    topic: 'Engineering, sprints, and deployments',
    messages: [
      { user: 'Steve',  avatar: 'S', color: TEAMMATES.Steve.color,  time: '10:55 AM', text: "Hey devs — PR #42 is up for review. It's the analytics event fix we discussed Monday." },
      { user: 'Alex',   avatar: 'A', color: TEAMMATES.Alex.color,   time: '10:58 AM', text: "On it! I'll review by 2 PM and leave inline comments." },
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '11:07 AM', text: '@You — are you able to run the 3 PM staging deployment while Steve monitors the logs?' },
    ],
    replies: [
      { user: 'Steve',  avatar: 'S', color: TEAMMATES.Steve.color,  delay: 2000, text: "Awesome, thank you! I'll be on standby in this channel from 2:45 PM in case anything comes up." },
    ],
  },
  'dm-synko': {
    name: 'Synko',
    topic: 'Just you and Synko',
    messages: [], // populated dynamically once pet exists
    replies: [],
    isDM: true,
    isSynkoDM: true,
  },
  'dm-lesley': {
    name: 'Lesley',
    topic: 'Direct message',
    messages: [
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '8:15 AM', text: 'Hey! Hope you had a good weekend 😊' },
      { user: 'You',    avatar: '▸', color: '#C060FF', time: '8:20 AM', text: 'Hey! Yeah it was great, thanks. Ready for the Q3 push this week?' },
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, time: '8:21 AM', text: "Quick thing — the client asked for a status email by EOD today. Would you be able to review Steve's draft before it goes out?" },
    ],
    replies: [
      { user: 'Lesley', avatar: 'L', color: TEAMMATES.Lesley.color, delay: 2000, text: "Perfect! Also — just a heads up, the client specifically asked about the timeline for the banner designs." },
    ],
  },
  'dm-steve': {
    name: 'Steve',
    topic: 'Direct message',
    messages: [
      { user: 'Steve', avatar: 'S', color: TEAMMATES.Steve.color, time: '9:30 AM', text: 'Hey — did you get a chance to look at the Q3 brief yet?' },
      { user: 'You',   avatar: '▸', color: '#C060FF', time: '9:35 AM', text: "Not yet, been in back-to-back meetings. I'll get to it." },
    ],
    replies: [
      { user: 'Steve', avatar: 'S', color: TEAMMATES.Steve.color, delay: 2500, text: "Appreciate it! I'll send you the draft as soon as it's ready. Probably around noon." },
    ],
  },
  'dm-alex': {
    name: 'Alex',
    topic: 'Direct message',
    messages: [
      { user: 'Alex', avatar: 'A', color: TEAMMATES.Alex.color, time: '10:10 AM', text: "Hey! I just shared the new mockups in #design — would love your take 🎨" },
      { user: 'You',  avatar: '▸', color: '#C060FF', time: '10:15 AM', text: "Ooh exciting! I'll check them out now." },
    ],
    replies: [
      { user: 'Alex', avatar: 'A', color: TEAMMATES.Alex.color, delay: 2000, text: "Love it! Also — do you happen to have the updated brand colour hex codes?" },
    ],
  },
};

// ── Collaboration pattern detection (preserved from earlier slack.js) ────────
function hasSpecifics(t) {
  return /\b(by\s+\w|before\s+\w|no later than|at\s+\d|\d+(:\d\d)?\s*(am|pm)\b|on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)|tomorrow|tonight|this\s+(morning|afternoon|evening|friday|monday|tuesday|wednesday|thursday)|end of (day|week|month)|eod|eow|noon|midnight|next\s+(week|monday|tuesday|wednesday|thursday|friday)|\d+\s*(days?|hours?|mins?|minutes?)\s*(from now)?)\b/i.test(t);
}

const COLLAB_PATTERNS = [
  {
    type: 'VAGUE COMMITMENT',
    test: (t) => {
      if (hasSpecifics(t)) return false;
      const l = t.trim().toLowerCase();
      return (
        /\b(i'?ll|i\s+will|i'?m\s+going\s+to|i\s+am\s+going\s+to)\s+\w/i.test(t) ||
        /\bi'?m\s+(working|looking|handling|dealing|taking\s+care|getting\s+(to|on\s+top)|sorting|fixing|drafting|writing|finishing|completing|following\s+up|reaching\s+out|waiting)\b/i.test(t) ||
        /\bi\s+(can|could|should|might|may)\s+(do|handle|take|send|write|fix|check|review|update|finish|complete|submit|schedule|reach|follow|look|get|sort|deal|run|lead|cover|own|manage|prepare|draft|book|set|help|assist|tackle|address|pick\s+up|work\s+on)\b/i.test(t) ||
        /\b(i'?ll|i\s+will)\s+(take\s+care\s+of|get\s+on\s+top\s+of|get\s+around\s+to|get\s+to\s+(it|that|this)?|follow\s+up\s+on|look\s+into|look\s+at|get\s+back\s+(to\s+you)?\s*(on)?|deal\s+with|work\s+on|pick\s+up|tackle|address|handle|sort\s+(it\s+)?out|figure\s+(it\s+)?out)\b/i.test(t) ||
        /^(will do|on it|got it|i got (it|this)|leave it to me|sure\.?|sure thing|yep\.?|yup\.?|ok\.?|okay\.?|k\.?|sounds good\.?|no problem\.?|np\.?|noted\.?|consider it done|working on it|looking into it|handling it|on my list|i'?ll do it|i'?ll handle it|i'?ll check|i'?ll follow up|i'?ll get to it|i'?ll get (it\s+)?done|i'?ll sort it( out)?|i'?ll look into it|i'?ll reach out|i'?ll think about it|i'?ll try|trying|trying to|i'll see what i can do)[.!]?$/i.test(l) ||
        /\b(i'?ll|i\s+will)\s+(try(\s+to)?|attempt(\s+to)?|do\s+my\s+best|see\s+what\s+i\s+can\s+do)\b/i.test(t) ||
        /\b(it'?s?\s+(almost|nearly)\s+(done|ready|finished|complete)|it\s+(will|should|'ll)\s+be\s+(done|ready|finished|sent|updated|completed))\b/i.test(t)
      );
    },
    suggest: (t) => {
      if (/review|look at|check/i.test(t)) return `I'll review this by [date] at [time] and share my feedback in this thread.`;
      if (/send|email|message|reach out|contact/i.test(t)) return `I'll send [specific thing] to [person] by [date] at [time] and CC the team here.`;
      if (/fix|resolve|debug|patch/i.test(t)) return `I'll fix this by [date] at [time] — I'll push the update and post a confirmation in this channel.`;
      if (/update|edit|revise|change/i.test(t)) return `I'll update [specific doc/thing] by [date] and share the link in this channel when done.`;
      if (/write|draft|prepare|create/i.test(t)) return `I'll draft [specific deliverable] and post it in this channel by [date] at [time].`;
      if (/schedule|book|set up/i.test(t)) return `I'll schedule [specific meeting] for [date/time] and send calendar invites to [names].`;
      if (/follow up|circle back|get back/i.test(t)) return `I'll follow up with [person] by [specific date/time] and share their response here.`;
      if (/handle|take care|manage|own|lead|cover/i.test(t)) return `I'll handle [specific task] — I'll have it done by [date] and post the result in this channel.`;
      if (/finish|complete|submit/i.test(t)) return `I'll finish [specific deliverable] and submit it to [person] by [date] at [time].`;
      return `I'll [specific task] by [date/time] and share the result in [channel].`;
    },
  },
  {
    type: 'VAGUE REFERRAL',
    test: (t) => /\b(ask|talk\s+to|check\s+with|reach\s+out\s+to|contact|ping|message|dm|loop\s+in|cc|speak\s+to|speak\s+with)\s+(steve|lesley|alex|mary|him|her|them|the\s+(team|dev|design|marketing|engineering|product|finance|legal|hr|sales))\b/i.test(t),
    suggest: (t) => {
      const m = t.match(/\b(ask|talk to|check with|reach out to|contact|ping|message|dm|loop in|speak to)\s+(\w+)/i);
      const name = m ? m[2] : '[name]';
      const cap = name.charAt(0).toUpperCase() + name.slice(1);
      return `Tag @${cap} directly here with a specific ask — "Hey @${cap}, can you [specific task] by [date]?" — so everyone sees the answer.`;
    },
  },
  {
    type: 'UNCLEAR OWNERSHIP',
    test: (t) => /\b(someone\s+(should|can|needs?\s+to|has\s+to|will|must|please)|anyone\s+(can|want\s+to|wants?\s+to|should|able\s+to|free\s+to)|whoever\s+(can|wants?|is\s+free|has\s+time)|who('?s|\s+is)\s+(going\s+to|handling|doing|taking\s+care\s+of|responsible|in\s+charge)|the\s+team\s+(should|needs?\s+to|has\s+to|will|must)|this\s+(needs?\s+to|should|has\s+to|must)\s+be\s+(done|handled|updated|reviewed|sent|fixed|completed))\b/i.test(t),
    suggest: () => `Let's assign this now — @[name], can you take ownership of [specific task] and have it done by [date]? Please confirm here so we can track it.`,
  },
  {
    type: 'VAGUE TIMELINE',
    test: (t) => /\b(later|soon|sometime|eventually|in\s+a\s+bit|in\s+a\s+few\s+(days?|hours?)|at\s+some\s+point|asap|a\.s\.a\.p\.?|as\s+soon\s+as\s+possible|whenever|sometime\s+this\s+(week|month)|in\s+a\s+while|when\s+i\s+can|end\s+of\s+(the\s+)?day|next\s+week|this\s+week|shortly|when\s+possible)\b/i.test(t),
    suggest: () => `I'll have this done by [day] at [time] and post a confirmation here.`,
  },
  {
    type: 'PASSIVE MESSAGE',
    test: (t) => /\b(let\s+me\s+know(\s+if|\s+when|\s+what|\s+your\s+thoughts)?|lmk|just\s+(ping|dm|message|slack)\s+me|feel\s+free\s+to\s+(reach\s+out|message|contact|dm)|keep\s+(me|us)\s+(posted|updated|in\s+the\s+loop)|we\s+('?ll|will|should|need\s+to)\s+(sync|touch\s+base|talk|chat|catch\s+up|discuss|circle\s+back|connect|meet|regroup)|circle\s+back|touch\s+base|thoughts\??|any\s+(thoughts|feedback|opinions|ideas|input))\b/i.test(t),
    suggest: () => `@[name], please [specific action] by [date] and post the result here.`,
  },
];

function analyzeText(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const pattern of COLLAB_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: pattern.type, original: trimmed, suggestion: pattern.suggest(trimmed) };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────────────────────
let initiatedPet = null;        // { speciesIndex, petName, project, health, treats[], createdAt }
let currentChannel = 'proj-pomegranate';
let pendingSuggestion = null;
let _bypassCheck = false;
let _petTriggerMode = 'quiet';
let _liveDismissedFor = null;
let petHomeKindMode = 'compliment';

// ── DOM refs ─────────────────────────────────────────────────────────────────
const messagesArea       = document.getElementById('messages-area');
const composerInput      = document.getElementById('composer-input');
const btnSend            = document.getElementById('btn-send');
const slashDropdown      = document.getElementById('slash-dropdown');
const slashDropdownList  = document.getElementById('slash-dropdown-list');
const channelHeaderName  = document.getElementById('channel-header-name');
const channelHeaderTopic = document.getElementById('channel-header-topic');

const petAssistant       = document.getElementById('pet-assistant');
const petBubble          = document.getElementById('pet-bubble');
const petLabel           = document.getElementById('pet-label');
const petNotification    = document.getElementById('pet-notification');
const notifOriginal      = document.getElementById('notif-original');
const notifSuggestion    = document.getElementById('notif-suggestion');
const notifTypeBadge     = document.getElementById('notif-type-badge');
const btnUseSuggestion   = document.getElementById('btn-use-suggestion');
const btnDismissNotif    = document.getElementById('btn-dismiss-notif');

const petHome            = document.getElementById('pet-home');
const petHomeStage       = document.getElementById('pet-home-stage');
const petHomeEmpty       = document.getElementById('pet-home-empty');
const petHomePet         = document.getElementById('pet-home-pet');
const petHomeCanvas      = document.getElementById('pet-home-canvas');
const petHomePetName     = document.getElementById('pet-home-pet-name');
const petHomeDragHint    = document.getElementById('pet-home-drag-hint');
const petHomeHealthFill  = document.getElementById('pet-home-health-fill');
const petHomeHealthLabel = document.getElementById('pet-home-health-label');
const petHomeTreats      = document.getElementById('pet-home-treats');
const petHomeTreatsCount = document.getElementById('pet-home-treats-count');
const petHomeTreatsHint  = document.getElementById('pet-home-treats-hint');
const petHomeTitle       = document.getElementById('pet-home-title');
const petHomeCollapseBtn = document.getElementById('pet-home-collapse');
const petHomeHandle      = document.getElementById('pet-home-expand');
const petHomeCollapsedCanvas = document.getElementById('pet-home-collapsed-canvas');
const petTheText         = document.getElementById('pet-home-pet-the-pet-text');
const petTheSend         = document.getElementById('pet-home-pet-the-pet-send');

const modalOverlay       = document.getElementById('modal-overlay');
const modalClose         = document.getElementById('modal-close');
const modalTitle         = document.getElementById('modal-title');
const modalBody          = document.getElementById('modal-body');

const dmSynkoLabel       = document.getElementById('dm-synko-label');
const btnBackPopup       = document.getElementById('btn-back-popup');

// ── Utility ─────────────────────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

// ── Animated pet sprite helpers ─────────────────────────────────────────────
const _petAnimFrames = new Map(); // canvas → rafId
function startPetCanvasAnimation(canvas, petIndex, pixelSize = 3) {
  const old = _petAnimFrames.get(canvas);
  if (old) cancelAnimationFrame(old);
  let frame = 0;
  function loop() {
    renderPetAnimated(canvas, petIndex, pixelSize, frame++);
    _petAnimFrames.set(canvas, requestAnimationFrame(loop));
  }
  loop();
}
function stopPetCanvasAnimation(canvas) {
  const id = _petAnimFrames.get(canvas);
  if (id) cancelAnimationFrame(id);
  _petAnimFrames.delete(canvas);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MESSAGES — render
// ─────────────────────────────────────────────────────────────────────────────
function renderMessages(channelId) {
  const ch = CHANNELS[channelId];
  if (!ch) return;
  messagesArea.innerHTML = '';

  const divider = document.createElement('div');
  divider.className = 'day-divider';
  divider.innerHTML = `<div class="day-divider-line"></div>
    <div class="day-divider-text">TODAY</div>
    <div class="day-divider-line"></div>`;
  messagesArea.appendChild(divider);

  ch.messages.forEach(msg => messagesArea.appendChild(buildMessageEl(msg)));
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function buildMessageEl(msg) {
  // System message (joined a Zoom call etc.)
  if (msg.kind === 'system') {
    const el = document.createElement('div');
    el.className = 'system-message';
    el.textContent = msg.text;
    return el;
  }

  // Synko ephemeral (only-you-can-see)
  if (msg.kind === 'synko-ephemeral') {
    const el = document.createElement('div');
    el.className = 'synko-ephemeral';
    el.innerHTML = `
      <div class="ephemeral-card">
        <div class="ephemeral-icon" id="eph-icon-${uid()}"></div>
        <div class="ephemeral-body">
          <div class="ephemeral-tag">Only visible to you · from Synko</div>
          <div class="ephemeral-content">${msg.html || escapeHtml(msg.text || '')}</div>
        </div>
      </div>`;
    const iconWrap = el.querySelector('.ephemeral-icon');
    iconWrap.id = '';
    if (initiatedPet) {
      const c = createPetCanvas(initiatedPet.speciesIndex, 1.5);
      iconWrap.appendChild(c);
    } else {
      iconWrap.innerHTML = '<span style="font-size:18px">🐾</span>';
    }
    return el;
  }

  // Synko public (a real channel post from Synko)
  if (msg.kind === 'synko-public') {
    const time = msg.time || nowTime();
    const el = document.createElement('div');
    el.className = 'message-group synko-public';
    el.innerHTML = `
      <div class="message-avatar" style="background:transparent"></div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-user" style="color:${initiatedPet?.accent || '#FF8040'}">Synko</span>
          <span class="synko-app-tag">APP</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${msg.html || escapeHtml(msg.text || '')}</div>
      </div>`;
    const avatar = el.querySelector('.message-avatar');
    if (initiatedPet) {
      const c = createPetCanvas(initiatedPet.speciesIndex, 2);
      avatar.appendChild(c);
    } else {
      avatar.innerHTML = '<span style="font-size:14px;color:#fff;font-weight:700">S</span>';
      avatar.style.background = '#FF8040';
    }
    return el;
  }

  // Standard human/you message
  const isYou = msg.user === 'You';
  const flagged = msg._flagged || false;
  const group = document.createElement('div');
  group.className = 'message-group' + (isYou ? ' is-you' : '');
  group.innerHTML = `
    <div class="message-avatar" style="background:${msg.color};color:#fff">${escapeHtml(msg.avatar || '')}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-user" style="color:${msg.color}">${escapeHtml(msg.user)}</span>
        <span class="message-time">${escapeHtml(msg.time || '')}</span>
      </div>
      <div class="message-text${flagged ? ' flagged' : ''}">
        ${escapeHtml(msg.text)}${flagged ? ' <span class="flag-badge">IMPROVED</span>' : ''}
      </div>
    </div>`;
  return group;
}

function postMessage(channelId, msg) {
  CHANNELS[channelId].messages.push(msg);
  if (channelId === currentChannel) {
    messagesArea.appendChild(buildMessageEl(msg));
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }
}

// ── Typing indicator + auto replies (preserved) ─────────────────────────────
function showTyping(teammate) {
  const id = 'typing-' + teammate.replace(/\s/g, '');
  if (document.getElementById(id)) return;
  const t = TEAMMATES[teammate] || { avatar: teammate[0], color: '#8060AA' };
  const el = document.createElement('div');
  el.id = id;
  el.className = 'message-group typing-indicator';
  el.innerHTML = `
    <div class="message-avatar" style="background:${t.color};color:#fff">${t.avatar}</div>
    <div class="message-content">
      <div class="message-header"><span class="message-user" style="color:${t.color}">${teammate}</span></div>
      <div class="message-text typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  messagesArea.appendChild(el);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}
function hideTyping(teammate) {
  const el = document.getElementById('typing-' + teammate.replace(/\s/g, ''));
  if (el) el.remove();
}

let _replyTimers = [];
function cancelReplies() {
  _replyTimers.forEach(clearTimeout);
  _replyTimers = [];
  messagesArea.querySelectorAll('.typing-indicator').forEach(el => el.remove());
}
function scheduleReplies(channelId) {
  const ch = CHANNELS[channelId];
  if (!ch.replies || !ch.replies.length) return;
  const pool = ch._replyPool ?? (ch._replyPool = [...ch.replies]);
  if (pool.length === 0) return;
  const reply = pool.shift();
  const typingDelay = Math.max(0, reply.delay - 1000);
  _replyTimers.push(setTimeout(() => showTyping(reply.user), typingDelay));
  _replyTimers.push(setTimeout(() => {
    hideTyping(reply.user);
    if (currentChannel !== channelId) return;
    const msg = { user: reply.user, avatar: reply.avatar, color: reply.color, time: nowTime(), text: reply.text };
    postMessage(channelId, msg);
  }, reply.delay));
}

// ─────────────────────────────────────────────────────────────────────────────
//  PET ASSISTANT (live coach)
// ─────────────────────────────────────────────────────────────────────────────
function showNotification(data) {
  pendingSuggestion = data;
  notifTypeBadge.textContent  = data.type;
  notifOriginal.textContent   = data.original;
  notifSuggestion.textContent = data.suggestion;
  petNotification.classList.remove('hidden');
  petBubble.classList.remove('has-suggestion');
  petBubble.style.transform = 'translateY(-4px)';
  setTimeout(() => { petBubble.style.transform = ''; }, 400);
}
function hideNotification() {
  petNotification.classList.add('hidden');
  pendingSuggestion = null;
  petBubble.classList.remove('has-suggestion');
}
function armPetBubble(hit) {
  pendingSuggestion = hit;
  petBubble.classList.add('has-suggestion');
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPOSER + slash commands
// ─────────────────────────────────────────────────────────────────────────────
function renderSlashDropdown() {
  const text = composerInput.value;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    slashDropdown.classList.add('hidden');
    return;
  }
  const q = trimmed.toLowerCase();
  const matches = COMMANDS.filter(c => c.name.startsWith(q));
  if (matches.length === 0) {
    slashDropdown.classList.add('hidden');
    return;
  }
  slashDropdownList.innerHTML = '';
  matches.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<code>${c.name}</code><span class="desc">${c.desc}</span>`;
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      composerInput.value = c.name + ' ';
      composerInput.focus();
      slashDropdown.classList.add('hidden');
    });
    slashDropdownList.appendChild(li);
  });
  slashDropdown.classList.remove('hidden');
}

function runCommand(raw) {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0];
  switch (cmd) {
    case '/help':
      postHelpEphemeral();
      return true;
    case '/init':
      openInitModal();
      return true;
    case '/zoom':
      runZoomCommand();
      return true;
    case '/pet':
      uncollapsePetHome();
      postMessage(currentChannel, { kind: 'synko-ephemeral', html: 'Pet panel is right there →' });
      return true;
    case '/feed': {
      if (!initiatedPet) {
        postMessage(currentChannel, { kind: 'synko-ephemeral', html: 'Hatch a pet first with <code>/init</code>.' });
      } else if (!initiatedPet.treats || initiatedPet.treats.length === 0) {
        postMessage(currentChannel, { kind: 'synko-ephemeral', html: 'No treats yet — start a live meeting from the Synko popup to earn some.' });
      } else {
        feedTreat(initiatedPet.treats[0]);
      }
      return true;
    }

    // ── Demo conversations: scripted multi-turn teammate threads ──
    case '/standup':  runDemoConversation(DEMO_STANDUP);  return true;
    case '/blocker':  runDemoConversation(DEMO_BLOCKER);  return true;
    case '/launch':   runDemoConversation(DEMO_LAUNCH);   return true;
    case '/scenario': runDemoConversation(DEMO_SCENARIO); return true;

    // ── AI teammate replies: live, contextual responses to your messages ──
    case '/ai': {
      const arg = (parts[1] || '').toLowerCase();
      if (arg === 'on')       setAiReplies(true);
      else if (arg === 'off') setAiReplies(false);
      else                    setAiReplies(!aiRepliesEnabled);
      return true;
    }

    default:
      postMessage(currentChannel, {
        kind: 'synko-ephemeral',
        html: `Unknown command <code>${escapeHtml(cmd)}</code> — type <code>/help</code> to see what's available.`,
      });
      return true;
  }
}

function postPetCoachingEphemeral(hit) {
  const petName = initiatedPet?.petName || 'Synko';
  postMessage(currentChannel, {
    kind: 'synko-ephemeral',
    html: `
      <div style="font-weight:700;margin-bottom:4px">🍎 ${escapeHtml(petName)} noticed: ${escapeHtml(hit.type)}</div>
      <div style="font-size:12px;color:#616061;margin-bottom:6px">Your message read as ${hit.type.toLowerCase()}.</div>
      <div style="background:#fff;border-left:3px solid #FF8040;padding:8px 10px;border-radius:0 6px 6px 0;font-size:13px;color:#1d1c1d;line-height:1.5">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;color:#b46808;margin-bottom:3px">Try this instead</div>
        ${escapeHtml(hit.suggestion)}
      </div>
      <div style="font-size:11px;color:#616061;font-style:italic;margin-top:6px">Click the pulsing pet (bottom-right) to use this directly in your composer.</div>
    `,
  });
}

function postHelpEphemeral() {
  const items = COMMANDS.map(c => `<li><code>${c.name}</code> <span style="color:#616061">${c.desc}</span></li>`).join('');
  postMessage(currentChannel, {
    kind: 'synko-ephemeral',
    html: `
      <div style="font-weight:700;margin-bottom:4px">Synko commands</div>
      <ul class="help-list" style="padding:0;margin:0">${items}</ul>
      <p class="help-list-tip">Tip: also try the panel on the right — feed treats, leave anonymous compliments or feedback for the team.</p>
    `,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  /zoom — opens the Synko meeting popup so the user can start a live meeting
// ─────────────────────────────────────────────────────────────────────────────
function runZoomCommand() {
  if (!initiatedPet) {
    postMessage(currentChannel, {
      kind: 'synko-ephemeral',
      html: 'Hatch a pet first with <code>/init</code>.',
    });
    return;
  }
  postMessage(currentChannel, {
    kind: 'synko-ephemeral',
    html: 'Opening the Synko meeting popup — start a live meeting and your pet will listen in.',
  });
  if (isExtension && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
  } else {
    window.open('popup.html', '_blank');
  }
}

function zoomReportHtml({ title, bullets, treatCount }) {
  return `
    <div class="meeting-recap">
      <div class="meeting-recap-title">📞 Meeting recap · ${escapeHtml(title)}</div>
      <p style="margin:4px 0 6px 0">I listened in. Here's what I noticed:</p>
      <ul class="meeting-recap-list">
        ${bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
      <div class="meeting-recap-foot">
        ${treatCount} treats earned — they're in my home (panel right). Anyone on the team can feed me with them when there's a moment.
      </div>
    </div>
  `;
}

// Used by the live-meeting → slack handoff.
function postLiveMeetingReport({ title, bullets, treatCount }) {
  postMessage(currentChannel, {
    kind: 'system',
    text: `📞 Live meeting "${title}" wrapped up. Synko shipped its report.`,
  });
  setTimeout(() => {
    postMessage(currentChannel, {
      kind: 'synko-public',
      time: nowTime(),
      html: zoomReportHtml({ title, bullets, treatCount }),
    });
  }, 600);
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEMO CONVERSATIONS — scripted teammate threads with realistic timing
// ─────────────────────────────────────────────────────────────────────────────
//
// Each demo is an array of "beats". A beat is either:
//   { user, text, delay, typingMs }   — a teammate posts a message
//   { kind:'system', text, delay }    — a faux system note
// `delay` is ms FROM THE START of the demo. Beats fire in order; we show the
// teammate typing for `typingMs` (default 900) before the message lands.
//
// Tone is meant to be realistic and varied — some beats land vague phrasing
// the user can practice coaching on, others are crisp.

const DEMO_STANDUP = {
  intro: '☀️ Morning standup',
  beats: [
    { user: 'Lesley', text: 'morning team! drop a quick standup when you have a sec 👋',                                        delay: 0     },
    { user: 'Mary',   text: "y'day: finished the eval rubric draft. today: review with Devon. blocker: still waiting on the dataset",   delay: 2200, typingMs: 1100 },
    { user: 'Alex',   text: "hero banner is in figma — variation B. need design sign-off this morning so I can ship the rest by EOD",   delay: 4800, typingMs: 1300 },
    { user: 'Steve',  text: "I'll handle the social copy",                                                                              delay: 7400, typingMs: 800  },
    { user: 'Lesley', text: "thanks all 🙏 @You — anything from your side? blockers?",                                                  delay: 10000, typingMs: 1100 },
  ],
};

const DEMO_BLOCKER = {
  intro: '🚧 Live blocker thread',
  beats: [
    { user: 'Devon',  text: "uh — staging broke after the last merge. anyone seen the deploy logs?",                                    delay: 0,     typingMs: 1100 },
    { user: 'Steve',  text: "was about to push PR #42. holding off until we know what's up.",                                           delay: 2400, typingMs: 1200 },
    { user: 'Mary',   text: "is it the migration we talked about Monday? same shape as last quarter's incident",                       delay: 4900, typingMs: 1400 },
    { user: 'Devon',  text: "yeah looks like it. logs say the schema change didn't apply on staging.",                                  delay: 7800, typingMs: 1300 },
    { user: 'Lesley', text: "ok — let's not rerun the migration blindly. someone should pull the recovery steps from the postmortem",  delay: 10800, typingMs: 1500 },
    { user: 'Devon',  text: "I'll look into it",                                                                                        delay: 13800, typingMs: 700  },
  ],
};

const DEMO_LAUNCH = {
  intro: '🔥 Launch-day chaos',
  beats: [
    { user: 'Lesley', text: "okay team — we go live in 4 hours. status check pls",                                                      delay: 0,     typingMs: 1100 },
    { user: 'Alex',   text: "visuals are live in the CMS. uploaded all 12 variants.",                                                   delay: 2200, typingMs: 1100 },
    { user: 'Steve',  text: "copy review almost done. give me 30 min.",                                                                 delay: 4400, typingMs: 1000 },
    { user: 'Mary',   text: "the dashboard's still showing yesterday's data — someone should look at that",                             delay: 6800, typingMs: 1400 },
    { user: 'Lesley', text: "@You can you take that?",                                                                                  delay: 9100, typingMs: 800  },
    { user: 'Devon',  text: "also flagging — the email send isn't queuing. might be the auth header thing again",                       delay: 11600, typingMs: 1500 },
    { user: 'Lesley', text: "ugh ok — keep me posted",                                                                                  delay: 14200, typingMs: 900  },
  ],
};

const DEMO_SCENARIO = {
  intro: '🎯 Scenario: vague ask from Lesley',
  beats: [
    { user: 'Lesley', text: "hey @You — quick favor: can you look into the budget thing when you get a chance? thx",                   delay: 0,     typingMs: 1300 },
    { kind: 'synko-ephemeral', html: "Lesley sent a vague ask. Try a reply that asks back for specifics — deadline, what 'the budget thing' actually means, where to post the result. I'll watch for clarity 🍎", delay: 1800 },
  ],
};

let _demoTimers = [];
function cancelDemo() {
  _demoTimers.forEach(clearTimeout);
  _demoTimers = [];
  // Also clear any leftover typing indicators
  messagesArea.querySelectorAll('.typing-indicator').forEach(el => el.remove());
}

function runDemoConversation(demo) {
  cancelDemo();
  const channelId = currentChannel;
  postMessage(channelId, { kind: 'system', text: demo.intro });

  for (const beat of demo.beats) {
    const delay = Math.max(0, beat.delay || 0);
    const typingMs = beat.typingMs ?? 900;

    if (beat.kind === 'synko-ephemeral') {
      _demoTimers.push(setTimeout(() => {
        if (currentChannel !== channelId) return;
        postMessage(channelId, { kind: 'synko-ephemeral', html: beat.html });
      }, delay));
      continue;
    }

    // Show typing dots first, then the message lands typingMs later.
    const typingStart = Math.max(0, delay - typingMs);
    _demoTimers.push(setTimeout(() => {
      if (currentChannel !== channelId) return;
      showTyping(beat.user);
    }, typingStart));

    _demoTimers.push(setTimeout(() => {
      hideTyping(beat.user);
      if (currentChannel !== channelId) return;
      const t = TEAMMATES[beat.user] || { avatar: beat.user[0], color: '#8060AA' };
      postMessage(channelId, {
        user:   beat.user,
        avatar: t.avatar,
        color:  t.color,
        time:   nowTime(),
        text:   beat.text,
      });
    }, delay));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AI TEAMMATE REPLIES — when enabled, after you send a message a teammate
//  replies in-character via the Anthropic API. Uses the key already stored
//  by the Chrome extension setup flow (chrome.storage.local: `apiKey`).
// ─────────────────────────────────────────────────────────────────────────────
let aiRepliesEnabled = false;
let _aiInflight = false;

async function setAiReplies(on) {
  // Try to verify a key is present — only matters when turning ON.
  if (on) {
    const { apiKey } = await Store.get('apiKey');
    if (!apiKey || !apiKey.trim()) {
      postMessage(currentChannel, {
        kind: 'synko-ephemeral',
        html: 'AI replies need an Anthropic API key. Set one in the extension Settings, then run <code>/ai on</code> again.',
      });
      return;
    }
  }
  aiRepliesEnabled = !!on;
  postMessage(currentChannel, {
    kind: 'synko-ephemeral',
    html: aiRepliesEnabled
      ? "AI teammate replies <b>on</b>. After your messages, one of Lesley/Mary/Steve/Alex/Devon will jump in. Toggle off with <code>/ai off</code>."
      : 'AI teammate replies <b>off</b>.',
  });
}

// Build a compact transcript of the last ~12 channel messages for context.
function recentChannelContextForAi(channelId) {
  const ch = CHANNELS[channelId];
  if (!ch) return '';
  const recent = ch.messages.slice(-12).filter(m => !m.kind || m.kind === undefined || m.user);
  return recent
    .filter(m => m.user) // skip synko-public/ephemeral and system msgs
    .map(m => `${m.user}: ${m.text}`)
    .join('\n');
}

const AI_PERSONAS = {
  Lesley: 'project lead, warm but direct, keeps the team accountable. tends to ask "what does done look like?" and pin down deadlines.',
  Mary:   'PM. analytical, asks clarifying questions, references past patterns. medium-formal.',
  Steve:  'VP marketing. confident, sometimes overcommits without specifics. casual lowercase.',
  Alex:   'design lead. collaborative, visual thinker, polite. uses occasional emoji.',
  Devon:  'engineer. terse, technical, lowercase. flags blockers fast.',
};

function pickPersona() {
  // Weighted-ish random pick — Lesley/Mary slightly more likely (they drive threads).
  const keys = ['Lesley','Lesley','Mary','Mary','Alex','Steve','Devon'];
  return keys[Math.floor(Math.random() * keys.length)];
}

async function maybeTriggerAiReply(userText) {
  if (!aiRepliesEnabled) return;
  if (_aiInflight) return;
  const channelId = currentChannel;

  const persona = pickPersona();
  const personaDesc = AI_PERSONAS[persona];
  const context = recentChannelContextForAi(channelId);

  const systemPrompt = `You are ${persona}, a teammate in a Slack channel called #${channelId}. Persona: ${personaDesc}. Reply to the user's most recent message naturally, as if continuing a real Slack thread. Stay in character. Keep it 1-2 short sentences. Slack-casual tone, lowercase ok. Don't add a name prefix or quote marks. Don't roleplay as the user. If asked about anything you don't have context for, make a plausible team-context guess and keep it light.`;

  const userPrompt =
`Recent channel transcript:
${context || '(empty so far)'}

You: ${userText}

Now reply as ${persona}.`;

  _aiInflight = true;
  showTyping(persona);

  try {
    const { apiKey } = await Store.get('apiKey');
    if (!apiKey) throw new Error('missing api key');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 160,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim();
    hideTyping(persona);
    if (!text) throw new Error('empty reply');
    if (currentChannel !== channelId) return;

    const t = TEAMMATES[persona] || { avatar: persona[0], color: '#8060AA' };
    postMessage(channelId, {
      user:   persona,
      avatar: t.avatar,
      color:  t.color,
      time:   nowTime(),
      text,
    });
  } catch (e) {
    hideTyping(persona);
    postMessage(channelId, {
      kind: 'synko-ephemeral',
      html: `AI reply failed: ${escapeHtml(e.message || 'unknown error')}. Toggle off with <code>/ai off</code> if it keeps happening.`,
    });
  } finally {
    _aiInflight = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AI COACHING — the pet's authoritative on-send classifier. Reads the user's
//  message + recent channel context, and returns either a smart suggestion
//  (a real rewrite they could actually send) or nothing if the message is
//  already clear. The regex-based analyzeText() is kept only as the cheap
//  live-typing pulse signal; this AI pass overrides it on send.
// ─────────────────────────────────────────────────────────────────────────────
const COACH_SYSTEM_PROMPT =
`You are a Slack communication coach for the Synko pet. You read a message
the user is about to send and decide whether it could be more specific.

Flag a message ONLY if it lands with one of these problems:
- VAGUE COMMITMENT  — promises/confirmations without owner+deliverable+timing
                      ("I'll handle it", "on it", "I'll get to it")
- VAGUE REFERRAL    — "ask Steve" / "talk to design" with no specific question
                      or concrete way for the person to act on it
- UNCLEAR OWNERSHIP — "someone should...", "we need to...", "this needs doing"
                      with no named owner
- VAGUE TIMELINE    — soft timing words ("soon", "later", "asap", "this week"
                      with no concrete day/time)
- PASSIVE MESSAGE   — "let me know", "thoughts?", "circle back", "we should
                      sync" with no clear next step or commitment

DO NOT flag:
- Clear questions that genuinely seek information ("can I clarify what we
  mean by deliverables this week?" is GREAT — it's a clarifying question,
  not a vague timeline. The phrase "this week" is a SCOPE here, not a soft
  promise to do something later.)
- Messages that already include a concrete deadline, owner, or deliverable
- Greetings, acknowledgments, social messages, jokes
- Messages where flagging would feel pedantic or condescending

When in doubt, do not flag. The pet should feel insightful, not annoying.

Reply with ONLY one JSON object, no prose:
{"flag": true, "type": "<one type from above>", "suggestion": "<a concrete rewrite the user could actually paste — fix the specific problem, use real specifics from the channel context (real names, real days, real deliverables) instead of [bracket placeholders]>"}
or
{"flag": false}`;

async function analyzeMessageWithAI(text, channelId) {
  if (!text || text.trim().length < 4) return null;
  const { apiKey } = await Store.get('apiKey');
  if (!apiKey || !apiKey.trim()) return null;

  const context = recentChannelContextForAi(channelId) || '(empty so far)';
  const userPrompt = `Recent channel transcript:\n${context}\n\nMessage to judge:\n"${text}"`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 220,
        system: COACH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await res.json();
    const raw = data?.content?.[0]?.text?.trim();
    if (!raw) return null;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    let parsed;
    try { parsed = JSON.parse(match[0]); } catch { return null; }
    if (!parsed?.flag) return null;
    if (!parsed.type || !parsed.suggestion) return null;
    return {
      type: String(parsed.type).toUpperCase(),
      original: text,
      suggestion: String(parsed.suggestion),
    };
  } catch {
    return null;
  }
}

// Hooked into sendMessage. Async — updates the bubble + posts the inline
// coaching ephemeral when the AI verdict comes back.
async function coachMessageWithAI(text, channelId) {
  const aiHit = await analyzeMessageWithAI(text, channelId);
  // If channel changed or pet vanished while we were waiting, bail.
  if (!initiatedPet) return;
  if (currentChannel !== channelId) return;

  if (aiHit) {
    // Upgrade pendingSuggestion to the AI-generated one — replaces any
    // regex-based suggestion that may have armed the bubble during typing.
    pendingSuggestion = aiHit;
    armPetBubble(aiHit);
    postPetCoachingEphemeral(aiHit);
    if (_petTriggerMode === 'active') showNotification(aiHit);
  } else {
    // AI says the message was fine — clear any regex false-positive that
    // had armed the bubble (silences the pulse so we don't lie to the user).
    petBubble.classList.remove('has-suggestion');
    if (pendingSuggestion?.original === text) pendingSuggestion = null;
    if (!petNotification.classList.contains('hidden')) hideNotification();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AMBIENT TREAT REWARDS — the pet's AI watches every message you send and
//  awards a treat when you demonstrate genuinely good async communication.
//  Runs whenever a pet exists + an Anthropic key is set; independent of /ai.
// ─────────────────────────────────────────────────────────────────────────────
const TREAT_TYPE_GUIDE = {
  apple:     'apple — asks a real clarifying question that reduces ambiguity (not a vague "thoughts?")',
  cake:      'cake — names a concrete deadline (e.g. "by Thursday EOD", "by 3pm Friday")',
  cookie:    'cookie — asks an explicit process or ownership question ("who owns X?", "what\'s the approval path?")',
  carrot:    'carrot — translates jargon between teams or pins down what a term means in this thread',
  star:      'star — defines a SPECIFIC action item: owner + deliverable + when (e.g. "I\'ll send the doc to Mary by Friday 5pm")',
  candy:     'candy — names cross-team alignment in writing (e.g. "Eng + Design are aligned on launch on the 12th")',
  blueberry: 'blueberry — schedules a concrete follow-up ("let\'s meet Wed at 2pm", with a specific time)',
  gem:       'gem — explicitly resolves a problem or names a root cause + fix in writing',
};

let _rewardCooldownUntil = 0; // throttle so we don't fire-hose treats

async function maybeAwardTreat(text) {
  if (!initiatedPet) return;
  if (Date.now() < _rewardCooldownUntil) return;
  // Skip very short messages — too little signal for a meaningful reward.
  if (text.trim().length < 18) return;
  // Skip messages that the rule-based coach already flagged as vague.
  if (analyzeText(text)) return;

  const { apiKey } = await Store.get('apiKey');
  if (!apiKey || !apiKey.trim()) return; // silent — feature is opt-in via key presence

  const channelId = currentChannel;
  const guideLines = Object.values(TREAT_TYPE_GUIDE).map(g => '- ' + g).join('\n');

  const systemPrompt =
`You judge a single Slack message for genuinely great async communication.

Most messages — even fine ones — are NOT treat-worthy. Only flag a message
as "great" if it CLEARLY and SPECIFICALLY demonstrates one of these moves:

${guideLines}

Hard rules:
- Be conservative. When in doubt, do not award.
- Vague commitments ("I'll handle it", "soon", "let me know") earn NOTHING.
- Generic agreement ("sounds good", "yes", "agreed") earns NOTHING.
- Cleverness, length, or politeness alone are not enough.
- The move must be in the message itself, not just implied.

Reply with ONLY a single JSON object, no prose:
{"earn": true, "treat": "<one of: apple|cake|cookie|carrot|star|candy|blueberry|gem>", "reason": "<one short sentence quoting the specific move>"}
or
{"earn": false}`;

  const userPrompt = `Message to judge:\n"${text}"`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 160,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await res.json();
    const raw = data?.content?.[0]?.text?.trim();
    if (!raw) return;

    // Extract JSON from the model's reply (be permissive).
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;
    let parsed;
    try { parsed = JSON.parse(match[0]); } catch { return; }
    if (!parsed?.earn || !SLACK_TREATS[parsed.treat]) return;

    if (currentChannel !== channelId || !initiatedPet) return;

    // Cooldown so the user can't farm treats by spamming similar messages.
    _rewardCooldownUntil = Date.now() + 30_000;

    const treat = SLACK_TREATS[parsed.treat];
    const granted = {
      id: `t-${uid()}`,
      treatId: parsed.treat,
      emoji: treat.emoji,
      name: treat.name,
      meaning: treat.meaning,
      source: 'Slack channel',
    };
    grantTreats([granted]);

    const reason = (parsed.reason && String(parsed.reason).trim()) || treat.meaning;
    const petName = initiatedPet?.petName || 'Synko';
    postMessage(channelId, {
      kind: 'synko-ephemeral',
      html: `
        <div style="font-weight:700;margin-bottom:2px">${treat.emoji} ${escapeHtml(petName)} caught a great move — <span style="color:#b46808">${escapeHtml(treat.name)}</span> earned!</div>
        <div style="font-size:12px;color:#1d1c1d">${escapeHtml(reason)}</div>
        <div style="font-size:11px;color:#616061;font-style:italic;margin-top:4px">Treat added to my home — feed me with it later.</div>
      `,
    });
  } catch {
    // Stay silent on classifier failures — this is ambient.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PET HOME (right rail)
// ─────────────────────────────────────────────────────────────────────────────
function renderPetHome() {
  const hasPet = !!initiatedPet;

  // Empty state vs pet state
  petHomeEmpty.classList.toggle('hidden', hasPet);
  petHomePet.classList.toggle('hidden', !hasPet);

  // Title
  petHomeTitle.textContent = hasPet ? `${initiatedPet.petName}'s home` : 'Pet home';

  if (hasPet) {
    // Animated sprite
    stopPetCanvasAnimation(petHomeCanvas);
    startPetCanvasAnimation(petHomeCanvas, initiatedPet.speciesIndex, 6);
    petHomePetName.textContent = initiatedPet.petName;

    // Health
    const h = Math.max(0, Math.min(100, initiatedPet.health || 0));
    petHomeHealthFill.style.width = h + '%';
    petHomeHealthFill.style.background = healthColor(h);
    petHomeHealthLabel.textContent = `${Math.round(h)} / 100`;

    // Treats
    renderTreatsList();
  } else {
    petHomeHealthFill.style.width = '0%';
    petHomeHealthLabel.textContent = '0 / 100';
    petHomeTreats.innerHTML = '<div class="pet-home-treats-empty">No treats yet. Start a live meeting from the Synko popup to earn some.</div>';
    petHomeTreatsCount.textContent = '0';
    petHomeTreatsHint.classList.add('hidden');
  }

  // Pet-the-pet send button enable state
  refreshPetThePetSend();
}

function renderTreatsList() {
  const treats = initiatedPet?.treats || [];
  petHomeTreatsCount.textContent = String(treats.length);
  petHomeTreats.innerHTML = '';
  if (treats.length === 0) {
    petHomeTreats.innerHTML = '<div class="pet-home-treats-empty">No treats yet. Start a live meeting from the Synko popup to earn some.</div>';
    petHomeTreatsHint.classList.add('hidden');
    return;
  }
  petHomeTreatsHint.classList.remove('hidden');
  treats.forEach(t => {
    const li = document.createElement('div');
    li.className = 'pet-home-treat';
    li.draggable = true;
    li.dataset.treatId = t.id;
    li.innerHTML = `
      <span class="pet-home-treat-emoji">${t.emoji}</span>
      <div class="pet-home-treat-info">
        <div class="pet-home-treat-name">${escapeHtml(t.name)}</div>
        <div class="pet-home-treat-meaning">${escapeHtml(t.meaning)}</div>
      </div>
      <button class="pet-home-treat-feed" data-treat-id="${t.id}">Feed</button>
    `;
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-synko-treat-id', t.id);
      e.dataTransfer.effectAllowed = 'copy';
      li.classList.add('dragging');
      petHomeStage.classList.add('drop-target');
      if (initiatedPet) petHomeDragHint.classList.remove('hidden');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      petHomeStage.classList.remove('drop-target');
      petHomeStage.classList.remove('drop-hover');
      petHomeDragHint.classList.add('hidden');
    });
    li.querySelector('.pet-home-treat-feed').addEventListener('click', () => feedTreat(t));
    petHomeTreats.appendChild(li);
  });
}

function healthColor(h) {
  if (h >= 80) return '#2bac76';
  if (h >= 60) return '#7ab800';
  if (h >= 40) return '#ecb22e';
  if (h >= 20) return '#ff8040';
  return '#e01e5a';
}

function grantTreats(newTreats) {
  if (!initiatedPet) return;
  initiatedPet.treats = [...(initiatedPet.treats || []), ...newTreats];
  persistInitiatedPet(initiatedPet);
  renderTreatsList();
}

function feedTreat(treat) {
  if (!initiatedPet) return;
  initiatedPet.treats = (initiatedPet.treats || []).filter(t => t.id !== treat.id);
  initiatedPet.health = Math.min(100, (initiatedPet.health || 0) + 6);
  persistInitiatedPet(initiatedPet);
  renderPetHome();
  postMessage(currentChannel, {
    kind: 'synko-public',
    time: nowTime(),
    html: `Someone just fed me a ${treat.emoji} <b>${escapeHtml(treat.name)}</b> — ${escapeHtml(treat.meaning.toLowerCase())}. Quietly celebrating that with the team 🤍`,
  });
}

// Pet-the-pet form
function refreshPetThePetSend() {
  const enabled = !!initiatedPet && !!petTheText && petTheText.value.trim().length > 0;
  if (petTheSend) petTheSend.disabled = !enabled;
}
function submitPetThePet() {
  const text = (petTheText.value || '').trim();
  if (!text || !initiatedPet) return;
  const kind = petHomeKindMode;
  initiatedPet.health = Math.min(100, (initiatedPet.health || 0) + (kind === 'compliment' ? 3 : 2));
  persistInitiatedPet(initiatedPet);
  renderPetHome();
  petTheText.value = '';
  petTheSend.classList.add('just-sent');
  petTheSend.textContent = 'Sent anonymously';
  setTimeout(() => {
    petTheSend.classList.remove('just-sent');
    petTheSend.textContent = 'Send';
    refreshPetThePetSend();
  }, 2000);
  postMessage(currentChannel, {
    kind: 'synko-public',
    time: nowTime(),
    html: kind === 'compliment'
      ? "Someone on the team noticed something kind today and dropped it in my home. I'll pass that warmth along — anonymously, of course. 🤍"
      : "Got an anonymous note about how communication is going. Logged it. I'll surface a pattern back to the team if I see it more than once.",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  /init — modal flow
// ─────────────────────────────────────────────────────────────────────────────
function openModal({ title, bodyHtml }) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalOverlay.classList.remove('hidden');
}
function closeModal() {
  modalOverlay.classList.add('hidden');
  modalBody.innerHTML = '';
}

const DEFAULT_PROJECT = {
  name: 'Q3 Launch — Pomegranate',
  goal: 'Ship a confident, well-coordinated launch with no last-minute scrambles.',
  context: 'Cross-functional team across product, design, engineering, marketing.',
  deadline: 'September 12, 2026',
};

function openInitModal() {
  const initState = {
    project: { ...DEFAULT_PROJECT },
    speciesIndex: null,
    petName: '',
  };
  renderInitStep1(initState);
  modalOverlay.classList.remove('hidden');
  modalTitle.textContent = "Hatch your project's pet";
}

function renderInitStep1(state) {
  modalBody.innerHTML = `
    <div class="modal-step-tag">Step 1 of 3 · project leader</div>
    <div class="modal-step-title">Set up your project</div>
    <div class="modal-step-sub">You're the project leader. Tell Synko what your team is here to do — this is what shapes the pet that hatches.</div>

    <div class="modal-field">
      <label class="modal-field-label">Project name</label>
      <input id="init-project-name" value="${escapeHtml(state.project.name)}" />
    </div>
    <div class="modal-field">
      <label class="modal-field-label">Project goal</label>
      <textarea id="init-project-goal" rows="2">${escapeHtml(state.project.goal)}</textarea>
    </div>
    <div class="modal-field">
      <label class="modal-field-label">Context the pet should know</label>
      <textarea id="init-project-context" rows="3">${escapeHtml(state.project.context)}</textarea>
    </div>
    <div class="modal-field">
      <label class="modal-field-label">Deadline</label>
      <input id="init-project-deadline" value="${escapeHtml(state.project.deadline)}" />
    </div>

    <div class="modal-actions">
      <button class="modal-btn-primary" id="init-step1-next">Choose your pet →</button>
    </div>
  `;
  document.getElementById('init-step1-next').addEventListener('click', () => {
    state.project.name     = document.getElementById('init-project-name').value.trim() || DEFAULT_PROJECT.name;
    state.project.goal     = document.getElementById('init-project-goal').value.trim();
    state.project.context  = document.getElementById('init-project-context').value.trim();
    state.project.deadline = document.getElementById('init-project-deadline').value.trim();
    if (!state.project.name) return;
    renderInitStep2(state);
  });
}

function renderInitStep2(state) {
  modalBody.innerHTML = `
    <div class="modal-step-tag">Step 2 of 3 · pick &amp; name</div>
    <div class="modal-step-title">Choose your team's pet</div>
    <div class="modal-step-sub">Pick the one your team will raise together. You can name it whatever you want.</div>

    <div class="species-grid" id="species-grid"></div>

    <div id="species-preview-wrap"></div>

    <div class="modal-actions">
      <button class="modal-btn-secondary" id="init-step2-back">← Back</button>
      <button class="modal-btn-primary" id="init-step2-next" disabled>Hatch the pet →</button>
    </div>
  `;
  const grid = document.getElementById('species-grid');
  PET_SPRITES.forEach((p, i) => {
    const cell = document.createElement('button');
    cell.className = 'species-cell';
    cell.type = 'button';
    cell.dataset.idx = String(i);
    const canvas = createPetCanvas(i, 3.5);
    cell.appendChild(canvas);
    const label = document.createElement('div');
    label.className = 'species-cell-name';
    label.textContent = p.name;
    cell.appendChild(label);
    cell.addEventListener('click', () => {
      state.speciesIndex = i;
      // mark selection
      grid.querySelectorAll('.species-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      cell.style.borderColor = p.accent || '#969696';
      renderSpeciesPreview(state);
    });
    grid.appendChild(cell);
  });

  document.getElementById('init-step2-back').addEventListener('click', () => renderInitStep1(state));
  const nextBtn = document.getElementById('init-step2-next');
  nextBtn.addEventListener('click', () => {
    if (state.speciesIndex == null) return;
    if (!state.petName.trim()) return;
    renderInitStep3(state);
  });
}

function renderSpeciesPreview(state) {
  const wrap = document.getElementById('species-preview-wrap');
  if (state.speciesIndex == null) { wrap.innerHTML = ''; return; }
  const sp = PET_SPRITES[state.speciesIndex];
  const meta = PET_META[state.speciesIndex] || {};
  wrap.innerHTML = `
    <div class="species-preview">
      <div class="species-preview-canvas-wrap" style="background:${hexAlpha(sp.accent || '#969696', 0.12)}">
        <canvas id="species-preview-canvas" width="72" height="72"></canvas>
      </div>
      <div class="species-preview-info">
        <div class="species-preview-coaching-label">Coaching focus</div>
        <p class="species-preview-coaching">${escapeHtml(meta.coachingFocus || '')}</p>
        <div class="modal-field">
          <label class="modal-field-label">Give your pet a name</label>
          <input id="init-pet-name" value="${escapeHtml(state.petName)}" placeholder="e.g. Pomi, Bubbles, Mango" maxlength="20" />
        </div>
      </div>
    </div>
  `;
  const canvas = document.getElementById('species-preview-canvas');
  startPetCanvasAnimation(canvas, state.speciesIndex, 4.5);
  const nameInput = document.getElementById('init-pet-name');
  nameInput.addEventListener('input', () => {
    state.petName = nameInput.value;
    document.getElementById('init-step2-next').disabled = !state.petName.trim();
  });
  nameInput.focus();
  document.getElementById('init-step2-next').disabled = !state.petName.trim();
}

function hexAlpha(hex, a) {
  // Normalize 3-digit hex to 6
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function renderInitStep3(state) {
  // Hatch animation
  modalTitle.textContent = 'Hatching…';
  modalBody.innerHTML = `
    <div class="hatch-stage">
      <div class="hatch-egg" id="hatch-egg">🥚</div>
      <div class="hatch-caption" id="hatch-caption">It's stirring…</div>
    </div>
  `;
  const egg = document.getElementById('hatch-egg');
  const cap = document.getElementById('hatch-caption');

  setTimeout(() => {
    egg.classList.add('cracking');
    cap.textContent = 'Cracking open…';
  }, 1800);

  setTimeout(() => {
    const sp = PET_SPRITES[state.speciesIndex];
    const meta = PET_META[state.speciesIndex] || {};
    modalBody.innerHTML = `
      <div class="hatch-stage">
        <div class="hatch-revealed">
          <canvas id="hatch-canvas" width="160" height="160"></canvas>
          <div class="hatch-revealed-name">${escapeHtml(state.petName)}</div>
          <div class="hatch-revealed-intro">Hi, I'm ${escapeHtml(state.petName)}, a ${escapeHtml(meta.kind || sp.name.toLowerCase())}. ${escapeHtml(meta.intro || '')}</div>
          <div class="modal-actions" style="justify-content:center">
            <button class="modal-btn-primary" id="hatch-say-hi">Say hi back</button>
          </div>
        </div>
      </div>
    `;
    startPetCanvasAnimation(document.getElementById('hatch-canvas'), state.speciesIndex, 10);
    document.getElementById('hatch-say-hi').addEventListener('click', () => {
      finalizeHatch(state);
    });
  }, 3400);
}

function finalizeHatch(state) {
  const sp = PET_SPRITES[state.speciesIndex];
  const meta = PET_META[state.speciesIndex] || {};
  initiatedPet = {
    speciesIndex: state.speciesIndex,
    petName: state.petName.trim(),
    speciesName: sp.name,
    accent: sp.accent,
    project: { ...state.project },
    health: 62,
    treats: [],
    createdAt: Date.now(),
  };
  persistInitiatedPet(initiatedPet);
  closeModal();

  // Show pet UI
  applyInitiatedPet();

  // Synko's first channel post
  postMessage(currentChannel, {
    kind: 'synko-public',
    time: nowTime(),
    html: `
      <div style="font-family:'Pixelify Sans',monospace;font-size:18px;font-weight:700;margin-bottom:6px">Hi team — I'm ${escapeHtml(initiatedPet.petName)}, a ${escapeHtml(meta.kind || sp.name.toLowerCase())}.</div>
      <p style="margin:4px 0 6px 0">${escapeHtml(meta.intro || '')}</p>
      <p style="font-size:13px;color:#1d1c1d"><b>What I'll be paying attention to:</b> ${escapeHtml(meta.coachingFocus || '')}</p>
      <p style="font-size:12px;color:#616061;font-style:italic;margin-top:8px">I'll mostly stay quiet. Type <code>/help</code> to see what you can do with me.</p>
    `,
  });
  setTimeout(() => {
    postMessage(currentChannel, { kind: 'system', text: `Pet hatched for project: ${initiatedPet.project.name}` });
  }, 400);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Apply pet to UI (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
function applyInitiatedPet() {
  if (!initiatedPet) {
    petBubble.classList.add('hidden');
    petAssistant.classList.add('no-pet-home');
    dmSynkoLabel.textContent = 'Synko';
    renderPetHome();
    return;
  }
  // Floating pet
  petBubble.classList.remove('hidden');
  petAssistant.classList.remove('no-pet-home');
  petLabel.textContent = (initiatedPet.petName || 'PET').toUpperCase();
  startPetCanvasAnimation(document.getElementById('slack-pet-canvas'), initiatedPet.speciesIndex, 3);

  // Sidebar Synko DM label = pet name
  dmSynkoLabel.textContent = initiatedPet.petName;

  renderPetHome();
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHANNEL SWITCH
// ─────────────────────────────────────────────────────────────────────────────
function switchChannel(channelId) {
  if (!CHANNELS[channelId]) return;
  currentChannel = channelId;

  document.querySelectorAll('.channel-item').forEach(el => {
    el.classList.toggle('active', el.dataset.channel === channelId);
    if (el.dataset.channel === channelId) {
      const dot = el.querySelector('.unread');
      if (dot) dot.remove();
    }
  });

  const ch = CHANNELS[channelId];
  const isDM = channelId.startsWith('dm-');
  channelHeaderName.textContent  = isDM ? (ch.name) : (ch.name);
  channelHeaderTopic.textContent = ch.topic;
  composerInput.placeholder = isDM ? `Message ${ch.name}` : `Message ${ch.name} · try /help`;

  cancelReplies();
  hideNotification();
  renderMessages(channelId);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SEND
// ─────────────────────────────────────────────────────────────────────────────
function sendMessage() {
  const text = composerInput.value.trim();
  if (!text) return;

  if (text.startsWith('/')) {
    runCommand(text);
    composerInput.value = '';
    slashDropdown.classList.add('hidden');
    return;
  }

  // Cheap regex preview only — keeps the bubble pulsing while the AI thinks.
  // The AUTHORITATIVE coach + ephemeral comes from coachMessageWithAI below;
  // if the AI says the message is fine, the bubble disarms again.
  if (initiatedPet && !_bypassCheck) {
    const cheapHit = analyzeText(text);
    if (cheapHit) armPetBubble(cheapHit);
  }
  _bypassCheck = false;

  composerInput.value = '';
  slashDropdown.classList.add('hidden');

  const channelAtSend = currentChannel;
  postMessage(channelAtSend, {
    user: 'You', avatar: '▸', color: '#C060FF', time: nowTime(), text,
  });

  // AI-based coaching (smart, context-aware). Fire-and-forget; this is the
  // only thing that posts the "Try this instead" ephemeral — the regex
  // analyzer was producing template-bracket suggestions on clearly-fine
  // messages (e.g. "this week" inside a clarifying question).
  if (initiatedPet) coachMessageWithAI(text, channelAtSend);

  // Ambient treat reward — pet's AI watches every message for genuinely
  // great async communication and awards a treat when it spots one.
  maybeAwardTreat(text);

  // Teammate replies. Prefer the AI replies whenever a key is present —
  // static auto-replies are obviously canned and break the demo. Only fall
  // back to canned replies when there's no key and AI is disabled.
  if (aiRepliesEnabled) {
    maybeTriggerAiReply(text);
  } else {
    cancelReplies();
    scheduleReplies(channelAtSend);
  }
  composerInput.focus();
}

// ─────────────────────────────────────────────────────────────────────────────
//  EVENT WIRING
// ─────────────────────────────────────────────────────────────────────────────
btnSend.addEventListener('click', sendMessage);
composerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  if (e.key === 'Escape') { slashDropdown.classList.add('hidden'); }
});
composerInput.addEventListener('input', () => {
  _bypassCheck = false;
  renderSlashDropdown();

  const text = composerInput.value;
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('/') || !initiatedPet) {
    if (!petNotification.classList.contains('hidden')) hideNotification();
    petBubble.classList.remove('has-suggestion');
    pendingSuggestion = null;
    return;
  }
  if (_liveDismissedFor === trimmed) return;
  const hit = analyzeText(text);
  if (!hit) {
    if (!petNotification.classList.contains('hidden')) hideNotification();
    petBubble.classList.remove('has-suggestion');
    pendingSuggestion = null;
    return;
  }
  if (_petTriggerMode === 'active') {
    if (!pendingSuggestion || pendingSuggestion.original !== hit.original) showNotification(hit);
  } else {
    armPetBubble(hit);
  }
});

btnUseSuggestion.addEventListener('click', () => {
  if (!pendingSuggestion) return;
  composerInput.value = pendingSuggestion.suggestion;
  hideNotification();
  composerInput.focus();
  composerInput.setSelectionRange(composerInput.value.length, composerInput.value.length);
  _liveDismissedFor = null;
});
btnDismissNotif.addEventListener('click', () => {
  _bypassCheck = true;
  _liveDismissedFor = composerInput.value.trim();
  hideNotification();
  composerInput.focus();
});

petBubble.addEventListener('click', () => {
  if (!petNotification.classList.contains('hidden')) { hideNotification(); return; }
  if (pendingSuggestion) { showNotification(pendingSuggestion); return; }
  // Idle hello
  petNotification.classList.remove('hidden');
  notifTypeBadge.textContent  = 'HELLO!';
  notifOriginal.textContent   = '(no messages flagged yet)';
  const name = initiatedPet?.petName || 'Pet';
  notifSuggestion.textContent = `Hi! I'm ${name}. I'll flag vague messages and suggest clearer alternatives. Try sending a message like "I'll handle it" or "Ask Steve."`;
  btnUseSuggestion.style.display = 'none';
  setTimeout(() => {
    hideNotification();
    btnUseSuggestion.style.display = '';
  }, 4000);
});

// Channel switcher
document.querySelectorAll('.channel-item').forEach(el => {
  el.addEventListener('click', () => switchChannel(el.dataset.channel));
});

// Pet home collapse / expand. "Collapsed" = fully hidden; a small floating
// handle on the right edge is the only affordance to bring it back. The
// floating bubble snaps to right:20px (no-pet-home class) so nothing else
// occupies the right column visually.
function collapsePetHome() {
  petHome.classList.add('hidden');
  petHomeHandle.classList.remove('hidden');
  if (initiatedPet) startPetCanvasAnimation(petHomeCollapsedCanvas, initiatedPet.speciesIndex, 2);
  petAssistant.classList.add('no-pet-home');
}
function uncollapsePetHome() {
  petHome.classList.remove('hidden');
  petHomeHandle.classList.add('hidden');
  stopPetCanvasAnimation(petHomeCollapsedCanvas);
  petAssistant.classList.remove('no-pet-home');
}
petHomeCollapseBtn.addEventListener('click', collapsePetHome);
petHomeHandle.addEventListener('click', uncollapsePetHome);

// Pet-the-pet form
document.querySelectorAll('.pet-home-kind-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    petHomeKindMode = btn.dataset.kind;
    document.querySelectorAll('.pet-home-kind-btn').forEach(b => b.classList.toggle('active', b === btn));
    petTheText.placeholder = petHomeKindMode === 'compliment'
      ? "e.g. Mary's eval write-up made the trade-offs really clear."
      : 'e.g. Long threads keep getting too long before someone summarizes.';
  });
});
petTheText.addEventListener('input', refreshPetThePetSend);
petTheSend.addEventListener('click', submitPetThePet);

// Drag-feed
petHomeStage.addEventListener('dragover', (e) => {
  if (!initiatedPet) return;
  if (Array.from(e.dataTransfer.types).includes('application/x-synko-treat-id')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    petHomeStage.classList.add('drop-hover');
  }
});
petHomeStage.addEventListener('dragleave', () => petHomeStage.classList.remove('drop-hover'));
petHomeStage.addEventListener('drop', (e) => {
  e.preventDefault();
  petHomeStage.classList.remove('drop-hover');
  const id = e.dataTransfer.getData('application/x-synko-treat-id');
  const t = (initiatedPet?.treats || []).find(tt => tt.id === id);
  if (t) feedTreat(t);
});

// Modal close
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// Back to popup
btnBackPopup.addEventListener('click', () => {
  if (isExtension) {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    window.close();
  } else {
    window.location.href = 'popup.html';
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  Pending zoom report (from live meeting handoff)
// ─────────────────────────────────────────────────────────────────────────────
async function handlePendingZoomReport() {
  const stored = localStorage.getItem('mp_pending_zoom_report');
  if (!stored) return;
  let report;
  try { report = JSON.parse(stored); } catch { return; }
  localStorage.removeItem('mp_pending_zoom_report');
  if (!initiatedPet) return; // can't render without pet

  // Apply treats
  if (Array.isArray(report.treats) && report.treats.length) {
    grantTreats(report.treats);
  }
  // Post recap
  postLiveMeetingReport({
    title: report.title || 'Live meeting',
    bullets: report.bullets || [],
    treatCount: (report.treats || []).length,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────────────────────
(async function boot() {
  // Load persisted pet trigger mode
  const tm = await Store.get('petTriggerMode');
  _petTriggerMode = tm.petTriggerMode === 'active' ? 'active' : 'quiet';

  // Load initiated pet
  initiatedPet = loadInitiatedPet();

  // AI teammate replies default ON whenever an Anthropic key is set —
  // the canned "Thanks for jumping in!" replies look obviously scripted and
  // break the demo. Users can still turn it off with `/ai off`.
  const { apiKey } = await Store.get('apiKey');
  if (apiKey && apiKey.trim()) aiRepliesEnabled = true;

  applyInitiatedPet();
  switchChannel('proj-pomegranate');
  refreshPetThePetSend();

  // If we got here from a live meeting, surface its report
  await handlePendingZoomReport();

  // First-run nudge
  if (!initiatedPet) {
    setTimeout(() => {
      postMessage(currentChannel, {
        kind: 'synko-ephemeral',
        html: 'No pet here yet. Type <code>/init</code> in the composer below to hatch one for your team.',
      });
    }, 500);
  }
})();
