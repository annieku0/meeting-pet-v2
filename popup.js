// Popup controller — chrome extension acts as a supplementary live-meeting tool.
// Pet initiation happens in Slack (slack.html). The popup just lets you:
//   • see the team's initiated pet
//   • run a live meeting (transcript → treats)
//   • after the meeting, treats flow back into Slack as a /zoom-style report

// ── Chrome API shim (falls back to localStorage in browser preview) ───────────
const isExtension = typeof chrome !== 'undefined' && chrome.storage;

const Store = {
  async get(key) {
    if (isExtension) return new Promise(res => chrome.storage.local.get(key, res));
    try { return { [key]: JSON.parse(localStorage.getItem(key)) }; }
    catch { return { [key]: null }; }
  },
  async set(obj) {
    if (isExtension) return new Promise(res => chrome.storage.local.set(obj, res));
    Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  },
  async remove(key) {
    if (isExtension) return new Promise(res => chrome.storage.local.remove(key, res));
    localStorage.removeItem(key);
  },
};

function openTab(url) {
  if (isExtension) chrome.tabs.create({ url: chrome.runtime.getURL(url) });
  else window.open(url, '_blank');
}

// ── State ─────────────────────────────────────────────────────────────────────
let animFrameId = null;
let timerInterval = null;
let meetingStartTime = null;

// ── Initiated pet (shared with slack.js via localStorage `mp_initiated_pet`) ──
function loadInitiatedPet() {
  try { return JSON.parse(localStorage.getItem('mp_initiated_pet') || 'null'); }
  catch { return null; }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindNavigation();

  // Skip API key gate in demo mode — go straight to login.
  const user = getStoredUser();
  if (!user) { showScreen('login'); return; }

  // Always start on the home dashboard. Don't auto-jump into the listening
  // window when a session is "active" — the user clicking the extension icon
  // is a navigation gesture and should land on the home screen with the pet
  // status and start/open-slack buttons. They can resume a meeting from here
  // if they want.
  showScreen('home');
  renderHome(user);
});

// ── User / account storage ────────────────────────────────────────────────────
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mp_user') || 'null'); }
  catch { return null; }
}
function saveUser(user) { localStorage.setItem('mp_user', JSON.stringify(user)); }
function clearUser() { localStorage.removeItem('mp_user'); }

function getAccounts() {
  try { return JSON.parse(localStorage.getItem('mp_accounts') || '{}'); }
  catch { return {}; }
}
function saveAccounts(accounts) { localStorage.setItem('mp_accounts', JSON.stringify(accounts)); }

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

// ── Screen navigation ─────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

function bindNavigation() {
  // First-run key setup
  document.getElementById('btn-setup-keys-save').addEventListener('click', handleSetupKeysSave);

  // Settings / Logout
  document.getElementById('btn-settings').addEventListener('click', () => {
    if (isExtension) chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
    else window.open('settings.html', '_blank');
  });
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearUser();
    showScreen('login');
  });

  // Back buttons
  document.getElementById('btn-setup-back').addEventListener('click', () => showScreen('login'));
  document.getElementById('btn-meeting-back').addEventListener('click', () => {
    const user = getStoredUser();
    showScreen('home');
    if (user) renderHome(user);
  });

  // Open Slack
  document.getElementById('btn-go-to-slack').addEventListener('click', () => openTab('slack.html'));

  // Login
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('login-pass-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('login-name-input').addEventListener('input', () => {
    const name = document.getElementById('login-name-input').value.trim();
    const hint = document.getElementById('login-account-hint');
    const err  = document.getElementById('login-error');
    err.textContent = '';
    if (!name) { hint.textContent = ''; return; }
    const accounts = getAccounts();
    if (accounts[name.toLowerCase()]) {
      hint.textContent = 'Welcome back! Enter your password.';
      hint.className = 'login-account-hint returning';
    } else {
      hint.textContent = 'New here — a new account will be created.';
      hint.className = 'login-account-hint new-user';
    }
  });

  // Start live meeting — mode picker
  document.getElementById('btn-start-meeting').addEventListener('click', startLiveMeeting);
  document.getElementById('btn-mode-live').addEventListener('click', startLiveListen);
  document.getElementById('btn-mode-paste').addEventListener('click', startPasteMode);
  document.getElementById('btn-mode-cancel').addEventListener('click', hideModeModal);
  document.getElementById('meeting-mode-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('meeting-mode-modal')) hideModeModal();
  });

  // Reset pet (clears mp_initiated_pet so the user can re-init in Slack)
  document.getElementById('btn-reset-pet').addEventListener('click', handleResetPet);

  // Paste transcript — submit button
  document.getElementById('btn-analyze').addEventListener('click', analyzeTranscript);

  // Live-meeting screen
  document.getElementById('btn-ask-everyone').addEventListener('click', () => startPoll());
  document.getElementById('btn-needs-more').addEventListener('click', () => {
    broadcastNeedsMore();
    flashFeedback(document.getElementById('btn-needs-more'), '🤔 sent');
  });
  document.getElementById('btn-toast-dismiss').addEventListener('click', dismissToast);
  document.getElementById('btn-clarity-reset').addEventListener('click', resetClarity);
  document.getElementById('btn-poll-yes').addEventListener('click', () => castVote('yes'));
  document.getElementById('btn-poll-no').addEventListener('click', () => castVote('no'));
  document.getElementById('btn-poll-dismiss').addEventListener('click', dismissPoll);
  document.getElementById('btn-poll-checkagain').addEventListener('click', startFollowupPoll);
}

// ── First-run key setup ──────────────────────────────────────────────────────
async function handleSetupKeysSave() {
  const dg  = document.getElementById('setup-deepgram-input').value.trim();
  const ant = document.getElementById('setup-anthropic-input').value.trim();
  const err = document.getElementById('setup-keys-error');
  err.textContent = '';

  if (!dg || !ant) {
    err.textContent = 'Please paste both keys to continue.';
    return;
  }
  if (!ant.startsWith('sk-ant-')) {
    err.textContent = 'Anthropic key should start with "sk-ant-".';
    return;
  }

  await Store.set({ apiKey: ant, deepgramKey: dg });

  const user = getStoredUser();
  if (user) {
    showScreen('home');
    renderHome(user);
  } else {
    showScreen('login');
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function handleLogin() {
  const nameInput  = document.getElementById('login-name-input');
  const passInput  = document.getElementById('login-pass-input');
  const errorEl    = document.getElementById('login-error');
  const name = nameInput.value.trim();
  const pass = passInput.value;
  errorEl.textContent = '';
  if (!name) { nameInput.focus(); return; }
  if (!pass) {
    errorEl.textContent = 'Please enter a password.';
    passInput.focus();
    return;
  }

  const accounts = getAccounts();
  const key = name.toLowerCase();
  if (accounts[key]) {
    if (accounts[key].password !== pass) {
      errorEl.textContent = 'Wrong password. Try again.';
      passInput.value = '';
      passInput.focus();
      return;
    }
    const user = { uid: accounts[key].uid, displayName: accounts[key].displayName };
    saveUser(user);
    showScreen('home');
    renderHome(user);
  } else {
    const user = { uid: 'user_' + generateId(), displayName: name };
    accounts[key] = { uid: user.uid, displayName: name, password: pass };
    saveAccounts(accounts);
    saveUser(user);
    showScreen('home');
    renderHome(user);
  }
}

// ── Home ──────────────────────────────────────────────────────────────────────
function renderHome(user) {
  document.getElementById('home-username').textContent = `Hello, ${user.displayName}!`;

  const pet = loadInitiatedPet();
  const initiatedCard = document.getElementById('initiated-pet-card');
  const noPetCard = document.getElementById('no-pet-card');
  const startBtn = document.getElementById('btn-start-meeting');
  const resetBtn = document.getElementById('btn-reset-pet');

  // Always allow starting a meeting — paste mode works without a pet.
  startBtn.disabled = false;

  if (pet) {
    initiatedCard.style.display = 'flex';
    noPetCard.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'inline-block';

    document.getElementById('initiated-pet-name').textContent = (pet.petName || 'Your Pet').toUpperCase();
    document.getElementById('initiated-project-name').textContent = pet.project?.name || 'Team project';
    document.getElementById('initiated-pet-health').textContent = `${Math.round(pet.health || 0)}%`;
    document.getElementById('initiated-pet-treats').textContent = String((pet.treats || []).length);

    const wrap = document.getElementById('initiated-pet-sprite');
    wrap.innerHTML = '';
    wrap.appendChild(createPetCanvas(pet.speciesIndex ?? 0, 3));
  } else {
    initiatedCard.style.display = 'none';
    noPetCard.style.display = 'flex';
    startBtn.disabled = true;
    if (resetBtn) resetBtn.style.display = 'none';
  }
}

// ── Reset pet ────────────────────────────────────────────────────────────────
// Clears the initiated pet (and any pending zoom report) so the user can
// re-init from Slack. Account / login state is preserved.
async function handleResetPet() {
  const pet = loadInitiatedPet();
  const name = pet?.petName || 'your pet';
  const ok = confirm(`Reset ${name}? This clears the team pet so you can hatch a new one in Slack. Your account stays.`);
  if (!ok) return;

  localStorage.removeItem('mp_initiated_pet');
  localStorage.removeItem('mp_pending_zoom_report');
  if (isExtension) {
    try { await chrome.storage.local.remove(['mp_initiated_pet', 'mp_pending_zoom_report', 'currentSession']); } catch {}
  }
  localStorage.removeItem('currentSession');

  const user = getStoredUser();
  if (user) renderHome(user);
}

// ── Start live meeting ────────────────────────────────────────────────────────
// Shows a mode picker: live listen vs paste transcript.
function startLiveMeeting() {
  document.getElementById('meeting-mode-modal').classList.remove('hidden');
}

function hideModeModal() {
  document.getElementById('meeting-mode-modal').classList.add('hidden');
}

async function buildSession() {
  const pet = loadInitiatedPet();  // may be null in demo mode
  const meetingTitle = document.getElementById('meeting-title-input').value.trim() || 'Team Meeting';
  const session = {
    active: true,
    petIndex: pet?.speciesIndex ?? 0,
    petName: pet?.petName ?? 'Synko',
    meetingTitle,
    startTime: Date.now(),
    treats: [],
    moments: [],
    analyzeCount: 0,
  };
  await Store.set({ currentSession: session });
  return session;
}

async function startLiveListen() {
  hideModeModal();
  await buildSession();
  if (isExtension) {
    chrome.windows.create({
      url: chrome.runtime.getURL('listen.html'),
      type: 'popup',
      width: 420,
      height: 720,
      focused: true,
    });
    window.close();
  } else {
    window.open('listen.html', 'synko-listen', 'popup,width=420,height=720');
  }
}

async function startPasteMode() {
  hideModeModal();
  const session = await buildSession();
  showScreen('meeting');
  restoreMeetingScreen(session);
}

function restoreMeetingScreen(session) {
  document.getElementById('meeting-title-display').textContent = session.meetingTitle || 'Team Meeting';
  document.getElementById('active-pet-name-display').textContent = session.petName || '';
  meetingStartTime = session.startTime;
  startTimer();
  startPetAnimation(session.petIndex);
  startClarityPolling();
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}
function updateTimer() {
  const el = document.getElementById('meeting-timer');
  const elapsed = Math.floor((Date.now() - meetingStartTime) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

// ── Pet animation ─────────────────────────────────────────────────────────────
function startPetAnimation(petIndex) {
  cancelAnimationFrame(animFrameId);
  const canvas = document.getElementById('active-pet-canvas');
  let frame = 0;
  function loop() {
    renderPetAnimated(canvas, petIndex, 5, frame++);
    animFrameId = requestAnimationFrame(loop);
  }
  loop();
}

// ── "Needs clarification" broadcast (lives on session, not project) ──────────
function getPassiveKey() { return 'mp_passive_session'; }

function getPassiveData() {
  try { return JSON.parse(localStorage.getItem(getPassiveKey()) || '{"needsMore":0,"lastSignalAt":0}'); }
  catch { return { needsMore: 0, lastSignalAt: 0 }; }
}

let _lastSeenSignalAt = 0;

function broadcastNeedsMore() {
  const key = getPassiveKey();
  const data = getPassiveData();
  data.needsMore = (data.needsMore || 0) + 1;
  data.lastSignalAt = Date.now();
  localStorage.setItem(key, JSON.stringify(data));
  _lastSeenSignalAt = data.lastSignalAt;
  renderPassiveTally(data);
  showToast();
}
function resetClarity() {
  localStorage.setItem(getPassiveKey(), JSON.stringify({ needsMore: 0, lastSignalAt: 0 }));
  _lastSeenSignalAt = 0;
  dismissToast();
  renderPassiveTally({ needsMore: 0 });
  localStorage.removeItem(getPollKey());
  hidePollOverlay();
}
function renderPassiveTally(data) {
  const el = document.getElementById('meeting-needs-count');
  if (el) el.textContent = data.needsMore || 0;
}

// ── Group poll (real-time check-in) ──────────────────────────────────────────
let _mainPollId  = null;
let _pollVotedId = null;
let _pollDismissedId = null;

function getPollKey() { return 'mp_poll_session'; }
function getPollData() {
  try { return JSON.parse(localStorage.getItem(getPollKey()) || 'null'); }
  catch { return null; }
}

function startPoll() {
  const poll = { id: Date.now().toString(), round: 1, status: 'active', yes: 0, no: 0, hasNo: false, startedAt: Date.now() };
  localStorage.setItem(getPollKey(), JSON.stringify(poll));
  _pollVotedId = null;
  _pollDismissedId = null;
  showPollOverlay(poll);
}
function startFollowupPoll() {
  const poll = { id: Date.now().toString(), round: 2, status: 'active', yes: 0, no: 0, hasNo: false, startedAt: Date.now() };
  localStorage.setItem(getPollKey(), JSON.stringify(poll));
  _pollVotedId = null;
  _pollDismissedId = null;
  showPollOverlay(poll);
}
function castVote(type) {
  const poll = getPollData();
  if (!poll || poll.status !== 'active') return;
  poll[type] = (poll[type] || 0) + 1;
  if (type === 'no') poll.hasNo = true;
  if (type === 'no' && poll.round === 2) poll.status = 'unresolved';
  localStorage.setItem(getPollKey(), JSON.stringify(poll));
  _pollVotedId = poll.id;
  document.getElementById('poll-vote-area').classList.add('hidden');
  document.getElementById('poll-voted-msg').classList.remove('hidden');
  renderPollOverlay(poll);
}
function dismissPoll() {
  const poll = getPollData();
  if (poll && poll.round === 2 && !poll.hasNo && poll.yes > 0) {
    poll.status = 'resolved';
    localStorage.setItem(getPollKey(), JSON.stringify(poll));
  }
  _pollDismissedId = poll?.id || null;
  hidePollOverlay();
}
function showPollOverlay(poll) {
  document.getElementById('poll-overlay').classList.remove('hidden');
  document.getElementById('poll-vote-area').classList.remove('hidden');
  document.getElementById('poll-voted-msg').classList.add('hidden');
  document.getElementById('poll-result-msg').classList.add('hidden');
  document.getElementById('btn-poll-checkagain').classList.add('hidden');
  renderPollOverlay(poll);
}
function hidePollOverlay() { document.getElementById('poll-overlay').classList.add('hidden'); }

function renderPollOverlay(poll) {
  if (!poll) return;
  const isFollowup = poll.round === 2;
  document.getElementById('poll-header-label').textContent = isFollowup ? 'DID THAT HELP?' : 'CHECK-IN';
  document.getElementById('poll-question-text').textContent =
    isFollowup ? 'After re-explaining — is everyone clearer now?' : 'Does everyone understand what was just discussed?';
  document.getElementById('btn-poll-yes').textContent = isFollowup ? '✓ Yes, clearer now' : '✓ Yes, I\'m good';
  document.getElementById('btn-poll-no').textContent  = isFollowup ? '✗ Still confused'   : '✗ Need to backtrack';
  document.getElementById('poll-tally-yes').textContent = `✓ ${poll.yes || 0}`;
  document.getElementById('poll-tally-no').textContent  = `✗ ${poll.no  || 0}`;

  const resultEl   = document.getElementById('poll-result-msg');
  const checkAgain = document.getElementById('btn-poll-checkagain');

  if (poll.status === 'unresolved') {
    resultEl.textContent = '⚠️ Still some confusion. Consider addressing further.';
    resultEl.className = 'poll-result-msg backtrack';
    checkAgain.classList.add('hidden');
  } else if (poll.status === 'resolved') {
    resultEl.textContent = '✓ Issue resolved! Re-explaining helped.';
    resultEl.className = 'poll-result-msg all-good';
    checkAgain.classList.add('hidden');
  } else if (poll.hasNo && !isFollowup) {
    resultEl.textContent = '⚠️ Someone needs to backtrack. Pause and re-explain.';
    resultEl.className = 'poll-result-msg backtrack';
    checkAgain.classList.remove('hidden');
  } else if (poll.hasNo && isFollowup) {
    resultEl.textContent = '⚠️ Still some confusion. Consider addressing further.';
    resultEl.className = 'poll-result-msg backtrack';
    checkAgain.classList.add('hidden');
  } else if ((poll.yes || 0) > 0) {
    resultEl.textContent = isFollowup
      ? `✓ ${poll.yes} said clearer — waiting for others.`
      : `✓ ${poll.yes} responded — no issues flagged yet.`;
    resultEl.className = 'poll-result-msg all-good';
    checkAgain.classList.add('hidden');
  } else {
    resultEl.className = 'poll-result-msg hidden';
    checkAgain.classList.add('hidden');
  }
}

function showToast() {
  const data = getPassiveData();
  const countEl = document.getElementById('overlay-needs-count');
  if (countEl) countEl.textContent = data.needsMore || 1;
  document.getElementById('clarification-overlay').classList.remove('hidden');
}
function dismissToast() { document.getElementById('clarification-overlay').classList.add('hidden'); }

function checkPollState() {
  const passive = getPassiveData();
  renderPassiveTally(passive);
  if (passive.lastSignalAt && passive.lastSignalAt > _lastSeenSignalAt) {
    _lastSeenSignalAt = passive.lastSignalAt;
    showToast();
  }
  const overlay = document.getElementById('clarification-overlay');
  if (!overlay.classList.contains('hidden')) {
    const countEl = document.getElementById('overlay-needs-count');
    if (countEl) countEl.textContent = passive.needsMore || 1;
  }

  const poll = getPollData();
  const pollIsLive = poll && (poll.status === 'active' || poll.status === 'unresolved' || poll.status === 'resolved');
  if (!pollIsLive) {
    if (!document.getElementById('poll-overlay').classList.contains('hidden')) hidePollOverlay();
    return;
  }
  if (_pollDismissedId === poll.id) { renderPollOverlay(poll); return; }
  if (document.getElementById('poll-overlay').classList.contains('hidden')) {
    if (_pollVotedId === poll.id) {
      document.getElementById('poll-vote-area').classList.add('hidden');
      document.getElementById('poll-voted-msg').classList.remove('hidden');
    } else {
      document.getElementById('poll-vote-area').classList.remove('hidden');
      document.getElementById('poll-voted-msg').classList.add('hidden');
    }
    document.getElementById('poll-overlay').classList.remove('hidden');
  }
  renderPollOverlay(poll);
}
function startClarityPolling() {
  stopClarityPolling();
  checkPollState();
  _mainPollId = setInterval(checkPollState, 800);
}
function stopClarityPolling() {
  if (_mainPollId) { clearInterval(_mainPollId); _mainPollId = null; }
}
function flashFeedback(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
}

// ── Analyze transcript ────────────────────────────────────────────────────────
let _analyzing = false;
async function analyzeTranscript() {
  const btn    = document.getElementById('btn-analyze');
  const status = document.getElementById('analysis-status');

  if (_analyzing) return;

  const textarea   = document.getElementById('transcript-input');
  const transcript = textarea.value.trim();
  if (!transcript) {
    status.textContent = '⚠ Paste a transcript first.';
    status.className = 'analysis-status error';
    return;
  }

  _analyzing = true;
  btn.disabled = true;
  btn.textContent = '🐾 Analyzing...';
  status.textContent = 'Reading transcript...';
  status.className = 'analysis-status';

  try {
    // Always analyze locally in the popup — paste mode doesn't need the
    // background service worker, and skipping it avoids the API/close race.
    const result = await runAnalysisLocally(transcript);

    status.textContent = result.message || 'Done! Sending treats to Slack...';
    await endMeeting();
  } catch (e) {
    console.error('[Synko] analyzeTranscript error:', e);
    status.textContent = `Error: ${e.message || 'Analysis failed — try again.'}`;
    status.className = 'analysis-status error';
    btn.disabled = false;
    btn.textContent = '🐾 SUBMIT TO PET';
    _analyzing = false;
  }
}

async function runAnalysisLocally(transcript) {
  const lower = transcript.toLowerCase();
  const patterns = [
    { treat: 'apple', kws: ["what do you mean", 'does that mean', 'what counts as', 'just to clarify', 'can you clarify', 'can you explain'] },
    { treat: 'cake',  kws: ["what's the deadline", 'deadline for', 'is there a deadline', 'cutoff date', 'by when', 'when does this', 'how long do we have', "when's the"] },
    { treat: 'cookie',kws: ["what's the process", 'how does the', 'who signs off', 'approval process', 'how do we handle', 'who owns'] },
    { treat: 'carrot',kws: ['let me translate', "let's agree", 'standardize', 'two different things', 'mean different things', 'in this context', 'in other words', 'going forward'] },
    { treat: 'star',  kws: ['action item', "i'll take an action item", "i'll update", "i'll send", "i'll schedule", "i'll compile", "i'll draft", "i'll have that done", 'will have that done by', 'by end of', 'by thursday', 'by friday', 'by monday'] },
    { treat: 'candy', kws: ['both teams aligned', 'are both aligned', 'are aligned on', 'shared understanding', 'no ambiguity', 'same page', 'we are aligned', 'everyone aligned'] },
    { treat: 'blueberry', kws: ["let's schedule", 'schedule a', "let's do a follow-up", "let's do a check", "let's set up", "i'll set up the meeting", 'follow-up review', 'circle back'] },
    { treat: 'gem',   kws: ['we just resolved', 'just resolved', "i've corrected", 'stable now', 'this resolves', 'problem solved', 'we solved', 'that solves it', 'resolved the', 'just realized'] },
  ];

  const found = [];
  const moments = [];
  for (const { treat, kws } of patterns) {
    for (const kw of kws) {
      let idx = 0;
      while ((idx = lower.indexOf(kw, idx)) !== -1) {
        found.push(treat);
        const lineStart = transcript.lastIndexOf('\n', idx);
        const lineEnd = transcript.indexOf('\n', idx + kw.length);
        const quote = transcript.slice(
          lineStart === -1 ? 0 : lineStart + 1,
          lineEnd === -1 ? transcript.length : lineEnd
        ).trim();
        moments.push({ treat, quote });
        idx += kw.length;
      }
    }
  }

  const { currentSession } = await Store.get('currentSession');
  if (currentSession) {
    currentSession.treats = found;
    currentSession.moments = moments;
    currentSession.analyzeCount = (currentSession.analyzeCount || 0) + 1;
    await Store.set({ currentSession });
  }
  return { ok: true, message: found.length > 0 ? 'Your pet noticed something interesting! 🐾' : 'Your pet is listening...' };
}

// ── End meeting → hand off treats to Slack as a /zoom-style report ───────────
async function endMeeting() {
  clearInterval(timerInterval);
  cancelAnimationFrame(animFrameId);
  stopClarityPolling();

  const { currentSession } = await Store.get('currentSession');
  if (currentSession) {
    currentSession.active = false;
    currentSession.endTime = Date.now();
    await Store.set({ currentSession });
  }

  await handoffToSlack(currentSession);

  // Open / focus slack.html so the report is visible immediately.
  openTab('slack.html');
}

// Build the report payload Slack will pick up via `mp_pending_zoom_report`.
async function handoffToSlack(session) {
  if (!session) return;
  const treatsCounted = (session.treats || []).reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  // Treat library (kept in sync with treats.js)
  const TR = {
    apple:     { emoji: '🍎', name: 'Apple',     meaning: 'Clarifying question' },
    cake:      { emoji: '🎂', name: 'Cake',      meaning: 'Deadline named' },
    cookie:    { emoji: '🍪', name: 'Cookie',    meaning: 'Process question' },
    carrot:    { emoji: '🥕', name: 'Carrot',    meaning: 'Jargon translated' },
    star:      { emoji: '⭐', name: 'Star',      meaning: 'Action item defined' },
    candy:     { emoji: '🍬', name: 'Candy',     meaning: 'Cross-team alignment' },
    blueberry: { emoji: '🫐', name: 'Blueberry', meaning: 'Follow-up scheduled' },
    gem:       { emoji: '💎', name: 'Gem',       meaning: 'Problem resolved' },
  };

  // Compose the granted treats list (one entry per earned treat)
  const grantedTreats = (session.treats || []).map((tid, i) => {
    const t = TR[tid] || { emoji: '✨', name: tid, meaning: '' };
    return {
      id: `t-${Date.now()}-${i}`,
      treatId: tid,
      emoji: t.emoji,
      name: t.name,
      meaning: t.meaning,
      source: session.meetingTitle || 'Live meeting',
    };
  });

  // Build bullet summary (one line per distinct treat type)
  const TREAT_ORDER = ['apple','cake','cookie','carrot','star','candy','blueberry','gem'];
  const bullets = [];
  TREAT_ORDER.forEach(tid => {
    const count = treatsCounted[tid] || 0;
    if (count === 0) return;
    const t = TR[tid];
    const spriteFile = tid === 'blueberry' ? 'strawberry' : tid;
    const icon = `<img class="treat-icon" src="sprites/rewards/${spriteFile}.svg" alt="" width="18" height="18">`;
    bullets.push(`${icon} <b>${t.name}</b> ×${count} — ${t.meaning}`);
  });
  if (bullets.length === 0) {
    bullets.push("No new treat moments this round — but every meeting still teaches the pet your team's rhythm.");
  }

  // Stash the report for Slack to pick up on load. Slack itself owns the
  // grant — applying it here would double-credit the pet.
  const report = {
    title: session.meetingTitle || 'Live meeting',
    bullets,
    treats: grantedTreats,
    durationMs: (session.endTime || Date.now()) - (session.startTime || Date.now()),
  };
  localStorage.setItem('mp_pending_zoom_report', JSON.stringify(report));
}
