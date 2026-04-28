// Popup controller

// ── Chrome API shim (falls back to localStorage in browser preview) ───────────
const isExtension = typeof chrome !== 'undefined' && chrome.storage;

const Store = {
  async get(key) {
    if (isExtension) {
      return new Promise(res => chrome.storage.local.get(key, res));
    }
    try { return { [key]: JSON.parse(localStorage.getItem(key)) }; }
    catch { return { [key]: null }; }
  },
  async set(obj) {
    if (isExtension) {
      return new Promise(res => chrome.storage.local.set(obj, res));
    }
    Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  },
  async remove(key) {
    if (isExtension) return new Promise(res => chrome.storage.local.remove(key, res));
    localStorage.removeItem(key);
  },
};

function openTab(url) {
  if (isExtension) {
    chrome.tabs.create({ url: chrome.runtime.getURL(url) });
  } else {
    window.open(url, '_blank');
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
let selectedPetIndex = null;
let slackSelectedPetIndex = null;
let animFrameId = null;
let timerInterval = null;
let meetingStartTime = null;
let currentProjectId = null; // set when starting a meeting for an existing project

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  buildPetGrid();
  bindNavigation();

  // Check if user is already logged in
  const user = getStoredUser();
  if (!user) {
    showScreen('login');
    return;
  }

  // User is logged in — show home or restore active meeting
  const { currentSession } = await Store.get('currentSession');
  if (currentSession && currentSession.active) {
    showScreen('meeting');
    restoreMeetingScreen(currentSession);
  } else {
    showScreen('home');
    renderHomeDashboard(user);
  }
});

// ── User / account storage ────────────────────────────────────────────────────
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mp_user') || 'null'); }
  catch { return null; }
}

function saveUser(user) {
  localStorage.setItem('mp_user', JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem('mp_user');
}

// Accounts: { [name.toLowerCase()]: { uid, displayName, password } }
function getAccounts() {
  try { return JSON.parse(localStorage.getItem('mp_accounts') || '{}'); }
  catch { return {}; }
}

function saveAccounts(accounts) {
  localStorage.setItem('mp_accounts', JSON.stringify(accounts));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

// ── Screen navigation ─────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

function bindNavigation() {
  // Back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      stopClarityPolling();
      const target = btn.dataset.target;
      showScreen(target);
      if (target === 'home') {
        const user = getStoredUser();
        if (user) renderHomeDashboard(user);
      }
    });
  });

  // Settings
  document.getElementById('btn-settings').addEventListener('click', () => {
    if (isExtension) {
      chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
    } else {
      window.open('settings.html', '_blank');
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearUser();
    showScreen('login');
  });

  // Go to Slack
  document.getElementById('btn-go-to-slack').addEventListener('click', () => {
    buildSlackPetGrid();
    document.getElementById('slack-selected-pet-name').textContent = '';
    document.getElementById('slack-name-form').style.display = 'none';
    document.getElementById('slack-pet-name-input').value = '';
    document.getElementById('btn-enter-slack').disabled = true;
    showScreen('slack-pet');
  });
  document.getElementById('btn-enter-slack').addEventListener('click', () => {
    if (slackSelectedPetIndex === null) return;
    const typed    = document.getElementById('slack-pet-name-input').value.trim();
    const petName  = typed || PET_SPRITES[slackSelectedPetIndex].name;
    window.location.href = `slack.html?petIndex=${slackSelectedPetIndex}&petName=${encodeURIComponent(petName)}`;
  });

  // Login
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('login-pass-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  // Show "new account" hint as user types their name
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

  // Start new pet → pet selection
  document.getElementById('btn-start-new-pet').addEventListener('click', () => {
    selectedPetIndex = null;
    currentProjectId = null;
    document.getElementById('selected-pet-name').textContent = '';
    document.getElementById('btn-name-pet').disabled = true;
    showScreen('select');
  });

  // Join a pet
  document.getElementById('btn-join-pet').addEventListener('click', () => {
    document.getElementById('join-code-input').value = '';
    document.getElementById('join-status').textContent = '';
    document.getElementById('join-status').className = 'join-status';
    showScreen('join');
  });
  document.getElementById('btn-do-join').addEventListener('click', handleJoin);
  document.getElementById('join-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleJoin();
  });

  // Name pet → start meeting (new pet flow)
  document.getElementById('btn-name-pet').addEventListener('click', () => {
    if (selectedPetIndex === null) return;
    showScreen('name');
    renderPreviewPet();
  });

  // Start meeting (new pet flow)
  document.getElementById('btn-start-meeting').addEventListener('click', startMeeting);

  // Quick-start (existing pet flow)
  document.getElementById('btn-qs-start').addEventListener('click', startQuickMeeting);

  // Check understanding — triggers group poll
  document.getElementById('btn-ask-everyone').addEventListener('click', () => startPoll());
  document.getElementById('btn-ask-everyone-waiting').addEventListener('click', () => startPoll());

  // "I need clarification" buttons — broadcast to everyone
  document.getElementById('btn-needs-more').addEventListener('click', () => {
    broadcastNeedsMore();
    flashFeedback(document.getElementById('btn-needs-more'), '🤔 sent');
  });
  document.getElementById('btn-needs-more-waiting').addEventListener('click', () => {
    broadcastNeedsMore();
    flashFeedback(document.getElementById('btn-needs-more-waiting'), '🤔 sent');
  });

  // Toast dismiss
  document.getElementById('btn-toast-dismiss').addEventListener('click', dismissToast);

  document.getElementById('btn-clarity-reset').addEventListener('click', resetClarity);

  // Poll overlay buttons
  document.getElementById('btn-poll-yes').addEventListener('click', () => castVote('yes'));
  document.getElementById('btn-poll-no').addEventListener('click', () => castVote('no'));
  document.getElementById('btn-poll-dismiss').addEventListener('click', dismissPoll);
  document.getElementById('btn-poll-checkagain').addEventListener('click', startFollowupPoll);

  // Copy invite code from meeting screen
  document.getElementById('btn-copy-meeting-invite').addEventListener('click', () => {
    const code = document.getElementById('meeting-invite-code').textContent;
    if (code && code !== '——') {
      navigator.clipboard.writeText(code);
      const btn = document.getElementById('btn-copy-meeting-invite');
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = 'COPY'; }, 2000);
    }
  });

  // Waiting room check
  document.getElementById('btn-check-feeding').addEventListener('click', checkFeedingRoom);

  // btn-analyze uses inline onclick in HTML — no listener needed here
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
    // Existing account — verify password
    if (accounts[key].password !== pass) {
      errorEl.textContent = 'Wrong password. Try again.';
      passInput.value = '';
      passInput.focus();
      return;
    }
    const user = { uid: accounts[key].uid, displayName: accounts[key].displayName };
    saveUser(user);
    showScreen('home');
    renderHomeDashboard(user);
  } else {
    // New account — create it
    const user = { uid: 'user_' + generateId(), displayName: name };
    accounts[key] = { uid: user.uid, displayName: name, password: pass };
    saveAccounts(accounts);
    saveUser(user);
    showScreen('home');
    renderHomeDashboard(user);
  }
}

// ── Home dashboard ─────────────────────────────────────────────────────────────
function renderHomeDashboard(user) {
  document.getElementById('home-username').textContent = `Hello, ${user.displayName}!`;

  const allProjects = getAllProjects();
  const userUid = user.uid;
  const myProjects = Object.values(allProjects).filter(p =>
    p.ownerId === userUid || (p.members && p.members[userUid])
  );

  const current = myProjects.filter(p => p.status !== 'completed');
  const past    = myProjects.filter(p => p.status === 'completed');

  const currentList = document.getElementById('current-pets-list');
  const pastList    = document.getElementById('past-pets-list');
  const noMsg       = document.getElementById('no-pets-msg');

  currentList.innerHTML = '';
  pastList.innerHTML    = '';

  if (current.length === 0 && past.length === 0) {
    noMsg.style.display = 'flex';
  } else {
    noMsg.style.display = 'none';
  }

  current.forEach(p => currentList.appendChild(buildPetCard(p, false)));
  past.forEach(p => pastList.appendChild(buildPetCard(p, true)));

  // Show/hide past section header
  document.querySelector('.past-header').style.display =
    past.length > 0 ? 'flex' : 'none';
}

function getAllProjects() {
  try { return JSON.parse(localStorage.getItem('mp_projects') || '{}'); }
  catch { return {}; }
}

function saveAllProjects(projects) {
  localStorage.setItem('mp_projects', JSON.stringify(projects));
}

function buildPetCard(project, isPast) {
  const card = document.createElement('div');
  card.className = 'pet-card' + (isPast ? ' past' : '');

  // Pet sprite
  const spriteWrap = document.createElement('div');
  spriteWrap.className = 'card-sprite';
  const canvas = createPetCanvas(project.petIndex ?? 0, 4);
  spriteWrap.appendChild(canvas);

  // Info
  const info = document.createElement('div');
  info.className = 'card-info';

  const petName = document.createElement('div');
  petName.className = 'card-pet-name';
  petName.textContent = (project.petName || 'Unnamed').toUpperCase();

  const projName = document.createElement('div');
  projName.className = 'card-proj-name';
  projName.textContent = project.name || 'Meeting';

  const memberCount = Object.keys(project.members || {}).length;
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.textContent = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;

  info.appendChild(petName);
  info.appendChild(projName);
  info.appendChild(meta);

  // Health bar
  const health = Math.min(project.health || 0, 300);
  const healthPct = Math.round((health / 300) * 100);
  const healthWrap = document.createElement('div');
  healthWrap.className = 'card-health';
  healthWrap.innerHTML = `
    <div class="card-health-track">
      <div class="card-health-fill" style="width:${healthPct}%"></div>
    </div>
    <div class="card-health-label">${healthPct}%</div>
  `;

  // Status badge
  const badge = document.createElement('div');
  badge.className = 'card-badge ' + (isPast ? 'badge-done' : 'badge-active');
  badge.textContent = isPast ? 'DONE' : 'ACTIVE';

  card.appendChild(spriteWrap);
  card.appendChild(info);

  const right = document.createElement('div');
  right.className = 'card-right';
  right.appendChild(badge);
  right.appendChild(healthWrap);
  card.appendChild(right);

  if (!isPast) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => openQuickStart(project));
  }

  return card;
}

// ── Quick start (meeting for existing project) ────────────────────────────────
function openQuickStart(project) {
  currentProjectId = project.id;
  selectedPetIndex = project.petIndex ?? 0;

  const user = getStoredUser();
  const isHost = project.ownerId === user?.uid;

  if (!isHost) {
    // Member: show waiting room instead
    openWaitingRoom(project);
    return;
  }

  // Host: enter meeting title and start
  const wrap = document.getElementById('qs-pet-preview');
  wrap.innerHTML = '';
  wrap.appendChild(createPetCanvas(selectedPetIndex, 6));

  document.getElementById('qs-pet-name-badge').textContent =
    (project.petName || 'Your Pet').toUpperCase();
  document.getElementById('qs-meeting-title-input').value = '';

  showScreen('quick-start');
}

// ── Waiting room (for non-host members) ───────────────────────────────────────
function openWaitingRoom(project) {
  currentProjectId = project.id;
  selectedPetIndex = project.petIndex ?? 0;

  const wrap = document.getElementById('waiting-pet-preview');
  wrap.innerHTML = '';
  wrap.appendChild(createPetCanvas(selectedPetIndex, 6));

  document.getElementById('waiting-pet-name').textContent =
    (project.petName || 'Your Pet').toUpperCase();
  document.getElementById('waiting-check-result').textContent = '';

  showScreen('waiting');
  startClarityPolling();
}

function checkFeedingRoom() {
  const resultEl = document.getElementById('waiting-check-result');
  if (!currentProjectId) return;

  const room = JSON.parse(localStorage.getItem(`mp_fr_${currentProjectId}`) || 'null');

  if (room && (room.status === 'open' || room.status === 'waiting')) {
    resultEl.textContent = 'Feeding room is open! Joining...';
    resultEl.className = 'waiting-check-result success';
    setTimeout(() => {
      window.location.href = `feeding.html?projectId=${currentProjectId}`;
    }, 800);
  } else {
    resultEl.textContent = 'No feeding room yet — the meeting is still in progress.';
    resultEl.className = 'waiting-check-result pending';
  }
}

async function startQuickMeeting() {
  const meetingTitle = document.getElementById('qs-meeting-title-input').value.trim()
    || 'Team Meeting';

  // Find project pet name
  const allProjects = getAllProjects();
  const project = allProjects[currentProjectId];
  const petName = project?.petName || PET_SPRITES[selectedPetIndex]?.name || 'Pet';

  const session = {
    active: true,
    petIndex: selectedPetIndex,
    petName,
    meetingTitle,
    startTime: Date.now(),
    treats: [],
    moments: [],
    analyzeCount: 0,
    projectId: currentProjectId,
  };

  await Store.set({ currentSession: session });
  showScreen('meeting');
  restoreMeetingScreen(session);
}

// ── Join ──────────────────────────────────────────────────────────────────────
async function handleJoin() {
  const input = document.getElementById('join-code-input');
  const status = document.getElementById('join-status');
  const code = input.value.trim().toUpperCase();
  if (!code) { input.focus(); return; }

  const user = getStoredUser();
  if (!user) return;

  const allProjects = getAllProjects();
  const project = Object.values(allProjects).find(p => p.inviteCode === code);

  if (!project) {
    status.textContent = 'No pet found with that code. Try again.';
    status.className = 'join-status error';
    return;
  }

  // Add user as member
  if (!project.members) project.members = {};
  project.members[user.uid] = user.displayName;
  saveAllProjects(allProjects);

  status.textContent = `Joined "${project.name}"! 🐾`;
  status.className = 'join-status success';

  setTimeout(() => {
    showScreen('home');
    renderHomeDashboard(user);
  }, 1200);
}

// ── Slack pet grid ────────────────────────────────────────────────────────────
function buildSlackPetGrid() {
  slackSelectedPetIndex = null;
  const grid = document.getElementById('slack-pet-grid');
  grid.innerHTML = '';
  PET_SPRITES.forEach((pet, index) => {
    const cell = document.createElement('div');
    cell.className = 'pet-cell';
    cell.title = pet.name;
    cell.appendChild(createPetCanvas(index, 3));
    cell.addEventListener('click', () => {
      grid.querySelectorAll('.pet-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      slackSelectedPetIndex = index;
      document.getElementById('slack-selected-pet-name').textContent = pet.name.toUpperCase();
      document.getElementById('slack-name-form').style.display = 'block';
      document.getElementById('slack-pet-name-input').placeholder = `e.g. ${pet.name}`;
      document.getElementById('btn-enter-slack').disabled = false;
    });
    grid.appendChild(cell);
  });
}

// ── Pet grid ──────────────────────────────────────────────────────────────────
function buildPetGrid() {
  const grid = document.getElementById('pet-grid');
  grid.innerHTML = '';
  PET_SPRITES.forEach((pet, index) => {
    const cell = document.createElement('div');
    cell.className = 'pet-cell';
    cell.title = pet.name;
    cell.appendChild(createPetCanvas(index, 3));
    cell.addEventListener('click', () => selectPet(index, cell));
    grid.appendChild(cell);
  });
}

function selectPet(index, cell) {
  document.querySelectorAll('.pet-cell').forEach(c => c.classList.remove('selected'));
  cell.classList.add('selected');
  selectedPetIndex = index;
  document.getElementById('selected-pet-name').textContent = PET_SPRITES[index].name.toUpperCase();
  document.getElementById('btn-name-pet').disabled = false;
}

// ── Preview ───────────────────────────────────────────────────────────────────
function renderPreviewPet() {
  const wrap = document.getElementById('preview-pet-canvas-wrap');
  wrap.innerHTML = '';
  if (selectedPetIndex === null) return;
  wrap.appendChild(createPetCanvas(selectedPetIndex, 6));
}

// ── Start meeting (new pet flow) ──────────────────────────────────────────────
async function startMeeting() {
  const petName = document.getElementById('pet-name-input').value.trim()
    || PET_SPRITES[selectedPetIndex].name;
  const meetingTitle = document.getElementById('meeting-title-input').value.trim()
    || 'Team Meeting';

  // Create a new project for this pet
  const user = getStoredUser();
  const uid = user?.uid || 'anon';
  const projectId = generateId();
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const project = {
    id: projectId,
    name: meetingTitle,
    petIndex: selectedPetIndex,
    petName,
    ownerId: uid,
    members: { [uid]: user?.displayName || 'You' },
    inviteCode,
    status: 'active',
    createdAt: Date.now(),
    health: 0,
    totalTreats: 0,
  };

  const allProjects = getAllProjects();
  allProjects[projectId] = project;
  saveAllProjects(allProjects);

  currentProjectId = projectId;

  const session = {
    active: true,
    petIndex: selectedPetIndex,
    petName,
    meetingTitle,
    startTime: Date.now(),
    treats: [],
    moments: [],
    analyzeCount: 0,
    projectId,
  };

  await Store.set({ currentSession: session });
  showScreen('meeting');
  restoreMeetingScreen(session);
}

function restoreMeetingScreen(session) {
  document.getElementById('meeting-title-display').textContent = session.meetingTitle || 'Team Meeting';
  document.getElementById('active-pet-name-display').textContent = session.petName || '';
  meetingStartTime = session.startTime;

  // Show invite code from project
  const codeEl = document.getElementById('meeting-invite-code');
  if (session.projectId) {
    const project = getAllProjects()[session.projectId];
    codeEl.textContent = project?.inviteCode || '——';
  } else {
    codeEl.textContent = '——';
  }

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

// ── "Needs clarification" broadcast ──────────────────────────────────────────
function getPassiveKey() {
  return currentProjectId ? `mp_passive_${currentProjectId}` : null;
}

function getPassiveData() {
  const key = getPassiveKey();
  if (!key) return { needsMore: 0, lastSignalAt: 0 };
  try { return JSON.parse(localStorage.getItem(key) || '{"needsMore":0,"lastSignalAt":0}'); }
  catch { return { needsMore: 0, lastSignalAt: 0 }; }
}

let _lastSeenSignalAt = 0; // tracks which signal this client has already shown a toast for

function broadcastNeedsMore() {
  const key = getPassiveKey();
  if (!key) return;
  const data = getPassiveData();
  data.needsMore = (data.needsMore || 0) + 1;
  data.lastSignalAt = Date.now();
  localStorage.setItem(key, JSON.stringify(data));
  // Show toast locally too (the person pressing also sees confirmation)
  _lastSeenSignalAt = data.lastSignalAt;
  renderPassiveTally(data);
  showToast();
}

function resetClarity() {
  const key = getPassiveKey();
  if (key) localStorage.setItem(key, JSON.stringify({ needsMore: 0, lastSignalAt: 0 }));
  _lastSeenSignalAt = 0;
  dismissToast();
  renderPassiveTally({ needsMore: 0 });
  // Also reset any active poll
  const pollKey = getPollKey();
  if (pollKey) localStorage.removeItem(pollKey);
  hidePollOverlay();
}

function renderPassiveTally(data) {
  const count = data.needsMore || 0;
  ['meeting-needs-count', 'waiting-needs-count'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  });
}

// ── Group poll (real-time check-in) ──────────────────────────────────────────
let _mainPollId  = null;   // setInterval handle for polling localStorage
let _pollVotedId = null;   // ID of the poll this user already voted on
let _pollDismissedId = null; // ID of poll this user dismissed

function getPollKey() {
  return currentProjectId ? `mp_poll_${currentProjectId}` : null;
}

function getPollData() {
  const key = getPollKey();
  if (!key) return null;
  try { return JSON.parse(localStorage.getItem(key) || 'null'); }
  catch { return null; }
}

// Poll history helpers
function getPollHistoryKey() {
  return currentProjectId ? `mp_poll_history_${currentProjectId}` : null;
}
function savePollToHistory(poll) {
  const key = getPollHistoryKey();
  if (!key) return;
  try {
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    history.push({
      id:         poll.id,
      round:      poll.round,
      yes:        poll.yes || 0,
      no:         poll.no  || 0,
      status:     poll.status,
      savedAt:    Date.now(),
    });
    localStorage.setItem(key, JSON.stringify(history));
  } catch {}
}

function startPoll() {
  const key = getPollKey();
  if (!key) return;
  const poll = {
    id: Date.now().toString(),
    round: 1,
    status: 'active',
    yes: 0,
    no: 0,
    hasNo: false,
    startedAt: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(poll));
  _pollVotedId     = null;
  _pollDismissedId = null;
  showPollOverlay(poll);
}

function startFollowupPoll() {
  const key = getPollKey();
  if (!key) return;
  const prev = getPollData();
  // Save the backtrack round to history before resetting
  if (prev) savePollToHistory(prev);

  const poll = {
    id: Date.now().toString(),
    round: 2,
    status: 'active',
    yes: 0,
    no: 0,
    hasNo: false,
    startedAt: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(poll));
  _pollVotedId     = null;
  _pollDismissedId = null;
  showPollOverlay(poll);
}

function castVote(type) {
  const key = getPollKey();
  if (!key) return;
  const poll = getPollData();
  if (!poll || poll.status !== 'active') return;

  poll[type] = (poll[type] || 0) + 1;
  if (type === 'no') poll.hasNo = true;

  // If this is round 2 and no one has said no yet and someone just said yes,
  // check if resolved (all voted yes so far — mark tentatively)
  if (type === 'no' && poll.round === 2) {
    poll.status = 'unresolved';
    savePollToHistory(poll);
  }

  localStorage.setItem(key, JSON.stringify(poll));
  _pollVotedId = poll.id;

  document.getElementById('poll-vote-area').classList.add('hidden');
  document.getElementById('poll-voted-msg').classList.remove('hidden');

  renderPollOverlay(poll);
}

function dismissPoll() {
  const poll = getPollData();
  // Save round 2 resolved outcome when dismissed with no No votes
  if (poll && poll.round === 2 && !poll.hasNo && poll.yes > 0) {
    poll.status = 'resolved';
    savePollToHistory(poll);
    const key = getPollKey();
    if (key) localStorage.setItem(key, JSON.stringify(poll));
  }
  _pollDismissedId = poll?.id || null;
  hidePollOverlay();
}

function showPollOverlay(poll) {
  document.getElementById('poll-overlay').classList.remove('hidden');
  // Reset vote UI state
  document.getElementById('poll-vote-area').classList.remove('hidden');
  document.getElementById('poll-voted-msg').classList.add('hidden');
  document.getElementById('poll-result-msg').classList.add('hidden');
  document.getElementById('btn-poll-checkagain').classList.add('hidden');
  renderPollOverlay(poll);
}

function hidePollOverlay() {
  document.getElementById('poll-overlay').classList.add('hidden');
}

function renderPollOverlay(poll) {
  if (!poll) return;

  // Header + question change for round 2
  const isFollowup = poll.round === 2;
  document.getElementById('poll-header-label').textContent =
    isFollowup ? 'DID THAT HELP?' : 'CHECK-IN';
  document.getElementById('poll-question-text').textContent =
    isFollowup
      ? 'After re-explaining — is everyone clearer now?'
      : 'Does everyone understand what was just discussed?';
  document.getElementById('btn-poll-yes').textContent = isFollowup ? '✓ Yes, clearer now' : '✓ Yes, I\'m good';
  document.getElementById('btn-poll-no').textContent  = isFollowup ? '✗ Still confused'   : '✗ Need to backtrack';

  document.getElementById('poll-tally-yes').textContent = `✓ ${poll.yes || 0}`;
  document.getElementById('poll-tally-no').textContent  = `✗ ${poll.no  || 0}`;

  const resultEl    = document.getElementById('poll-result-msg');
  const checkAgain  = document.getElementById('btn-poll-checkagain');

  if (poll.status === 'unresolved') {
    resultEl.textContent = '⚠️ Still some confusion. Consider addressing further.';
    resultEl.className = 'poll-result-msg backtrack';
    checkAgain.classList.add('hidden');
  } else if (poll.status === 'resolved') {
    resultEl.textContent = '✓ Issue resolved! Re-explaining helped.';
    resultEl.className = 'poll-result-msg all-good';
    checkAgain.classList.add('hidden');
  } else if (poll.hasNo && !isFollowup) {
    // Round 1 backtrack
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

// ── Clarification overlay ─────────────────────────────────────────────────────
function showToast() {
  const data = getPassiveData();
  const countEl = document.getElementById('overlay-needs-count');
  if (countEl) countEl.textContent = data.needsMore || 1;
  document.getElementById('clarification-overlay').classList.remove('hidden');
}

function dismissToast() {
  document.getElementById('clarification-overlay').classList.add('hidden');
}

function checkPollState() {
  // Check for new "needs clarification" signal from anyone
  const passive = getPassiveData();
  renderPassiveTally(passive);
  if (passive.lastSignalAt && passive.lastSignalAt > _lastSeenSignalAt) {
    _lastSeenSignalAt = passive.lastSignalAt;
    showToast();
  }
  // Keep count fresh if overlay is already open
  const overlay = document.getElementById('clarification-overlay');
  if (!overlay.classList.contains('hidden')) {
    const countEl = document.getElementById('overlay-needs-count');
    if (countEl) countEl.textContent = passive.needsMore || 1;
  }

  const poll = getPollData();
  const pollIsLive = poll && (poll.status === 'active' || poll.status === 'unresolved' || poll.status === 'resolved');
  if (!pollIsLive) {
    if (!document.getElementById('poll-overlay').classList.contains('hidden')) {
      hidePollOverlay();
    }
    return;
  }

  // Already dismissed this poll — don't re-show
  if (_pollDismissedId === poll.id) {
    renderPollOverlay(poll); // still update tally in background
    return;
  }

  // Show overlay if not visible
  if (document.getElementById('poll-overlay').classList.contains('hidden')) {
    // Restore vote button state based on whether user already voted
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
  checkPollState(); // immediate
  _mainPollId = setInterval(checkPollState, 800);
}

function stopClarityPolling() {
  if (_mainPollId) { clearInterval(_mainPollId); _mainPollId = null; }
}

function flashFeedback(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = orig;
    btn.disabled = false;
  }, 1200);
}

// ── Analyze transcript ────────────────────────────────────────────────────────
let _analyzing = false;

async function analyzeTranscript() {
  if (_analyzing) return;
  _analyzing = true;

  const textarea = document.getElementById('transcript-input');
  const transcript = textarea.value.trim();
  if (!transcript) { _analyzing = false; return; }

  const btn = document.getElementById('btn-analyze');
  const status = document.getElementById('analysis-status');
  btn.disabled = true;
  btn.textContent = '🐾 Analyzing...';
  status.textContent = '';
  status.className = 'analysis-status';

  try {
    let result;

    if (isExtension) {
      result = await chrome.runtime.sendMessage({ type: 'ANALYZE_TRANSCRIPT', transcript });
    } else {
      result = await runAnalysisLocally(transcript);
    }

    if (result.error) {
      status.textContent = `Error: ${result.error}`;
      status.className = 'analysis-status error';
      btn.disabled = false;
      btn.textContent = '🐾 SUBMIT TO PET';
      _analyzing = false;
    } else {
      await endMeeting();
    }
  } catch (e) {
    status.textContent = 'Analysis failed — try again.';
    status.className = 'analysis-status error';
    btn.disabled = false;
    btn.textContent = '🐾 SUBMIT TO PET';
    _analyzing = false;
  }
}

async function runAnalysisLocally(transcript) {
  const lower = transcript.toLowerCase();
  const patterns = [
    { treat: 'apple',     kws: [
      'what do you mean by', 'what do we mean by', 'what exactly do we mean',
      'does that mean', 'do you mean', 'what counts as', 'when we say',
      'does it include', 'does that include', 'does it mean no', 'just to clarify',
      'can you clarify', 'what exactly are we', 'can you explain',
    ]},
    { treat: 'cake',      kws: [
      "what's the deadline", 'deadline for', 'is there a deadline',
      'cutoff date', 'cutoff for', 'by when', 'when does the new',
      'when does this', 'when do we', 'how long do we have', 'target date',
      'go into effect', 'when are we', 'when is the', "when's the",
    ]},
    { treat: 'cookie',    kws: [
      "what's the process", 'how does the', 'who signs off', 'approval process',
      'how do we handle', 'who gets looped in', 'different approval path',
      'walk me through how', 'in parallel', 'sequentially', 'who owns',
    ]},
    { treat: 'carrot',    kws: [
      'let me translate', 'for this call,', "let's agree:",
      "let's agree that", 'standardize', 'two different things',
      'mean different things', 'in this context,', 'from now on,',
      'means the same', 'in other words', 'what we mean by',
      'to clarify for the whole group', 'interchangeably',
      'going forward', 'define it explicitly', 'very different scopes',
      'need to align on', 'align on what', 'nail down the definition',
    ]},
    { treat: 'star',      kws: [
      'action item', "i'll take an action item", "i'll update", "i'll send",
      "i'll schedule", "i'll compile", "i'll draft", "i'll have that done",
      "i'll set", "i'll get that out", 'will have that done by', 'by end of',
      'by thursday', 'by friday', 'by monday', 'sends qa', 'action item for me',
    ]},
    { treat: 'candy',     kws: [
      'both teams aligned', 'are both aligned', 'are aligned on',
      'are aligned that', 'are aligned —', 'are aligned.', 'both aligned',
      'shared understanding', 'no ambiguity', 'hard go-live', 'same page',
      'we are aligned', 'everyone aligned', 'both clear on',
    ]},
    { treat: 'blueberry', kws: [
      "let's schedule", "schedule a", "let's do a follow-up",
      "let's do a check", "let's do a review", "let's do a mid",
      "let's set up", "i'll set up the meeting", "i'll send it today",
      'schedule that for', 'follow-up review', "let's meet", 'circle back',
    ]},
    { treat: 'gem',       kws: [
      'we just resolved', 'just resolved', "i've corrected",
      'stable now', 'this resolves', 'problem solved', 'we solved',
      'that solves it', 'resolved the', 'just realized',
      'pipeline is stable', 'fixed that right now', 'logged the fix',
      "i've logged", 'just now',
    ]},
  ];

  const found = [];
  const moments = [];

  for (const { treat, kws } of patterns) {
    const hits = [];
    for (const kw of kws) {
      let idx = 0;
      while ((idx = lower.indexOf(kw, idx)) !== -1) {
        hits.push({ kw, idx });
        idx += kw.length;
      }
    }
    if (hits.length === 0) continue;

    hits.sort((a, b) => a.idx - b.idx);
    const seenLines = new Set();
    const deduped = [];
    for (const hit of hits) {
      const lineStart = transcript.lastIndexOf('\n', hit.idx);
      if (!seenLines.has(lineStart)) {
        seenLines.add(lineStart);
        deduped.push(hit);
      }
    }

    for (const { kw, idx } of deduped) {
      found.push(treat);
      const lineStart = transcript.lastIndexOf('\n', idx);
      const lineEnd = transcript.indexOf('\n', idx + kw.length);
      const quote = transcript.slice(
        lineStart === -1 ? 0 : lineStart + 1,
        lineEnd === -1 ? transcript.length : lineEnd
      ).trim();
      moments.push({ treat, quote });
    }
  }

  const { currentSession } = await Store.get('currentSession');
  if (currentSession) {
    currentSession.treats = found;
    currentSession.moments = moments;
    currentSession.analyzeCount = (currentSession.analyzeCount || 0) + 1;
    await Store.set({ currentSession });
  }

  return {
    ok: true,
    message: found.length > 0 ? 'Your pet noticed something interesting! 🐾' : 'Your pet is listening...',
  };
}

// ── End meeting ───────────────────────────────────────────────────────────────
async function endMeeting() {
  clearInterval(timerInterval);
  cancelAnimationFrame(animFrameId);

  const { currentSession } = await Store.get('currentSession');
  if (currentSession) {
    currentSession.active = false;
    currentSession.endTime = Date.now();
    await Store.set({ currentSession });
  }

  if (isExtension) {
    chrome.runtime.sendMessage({ type: 'OPEN_REVEAL' });
    window.close();
  } else {
    window.location.href = 'reveal.html';
  }
}
