// ─────────────────────────────────────────────────────────────────────────────
// Database layer — wraps Firebase Realtime DB operations
// Falls back to localStorage demo mode when DEMO_MODE = true
// ─────────────────────────────────────────────────────────────────────────────

// ── Firebase DB schema ────────────────────────────────────────────────────────
//
// /users/{uid}
//   displayName, email, createdAt
//
// /projects/{projectId}
//   name, petIndex, petName, background
//   ownerId, members: { uid: displayName }
//   inviteCode, status: 'active'|'completed'
//   createdAt, health, totalTreats
//
// /projects/{projectId}/feedingRoom
//   sessionId, status: 'waiting'|'open'|'done'
//   treats: { [id]: { type, fed, fedBy, fedAt } }
//   petX, petY
//
// ─────────────────────────────────────────────────────────────────────────────

let _db = null;
let _auth = null;

function getDB() { return _db; }
function getAuth() { return _auth; }

async function initFirebase() {
  if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) return null;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getDatabase } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
    const { getAuth: _getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const app = initializeApp(FIREBASE_CONFIG);
    _db = getDatabase(app);
    _auth = _getAuth(app);
    return { db: _db, auth: _auth };
  } catch (e) {
    console.warn('Firebase init failed, using demo mode', e);
    return null;
  }
}

// ── Project operations ────────────────────────────────────────────────────────

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

// ── Demo mode (localStorage) ──────────────────────────────────────────────────

const DEMO_STORE = {
  getProjects() {
    try { return JSON.parse(localStorage.getItem('mp_projects') || '{}'); }
    catch { return {}; }
  },
  saveProjects(p) { localStorage.setItem('mp_projects', JSON.stringify(p)); },

  getUser() {
    try { return JSON.parse(localStorage.getItem('mp_user') || 'null'); }
    catch { return null; }
  },
  saveUser(u) { localStorage.setItem('mp_user', JSON.stringify(u)); },

  getFeedingRoom(projectId) {
    try { return JSON.parse(localStorage.getItem(`mp_fr_${projectId}`) || 'null'); }
    catch { return null; }
  },
  saveFeedingRoom(projectId, data) {
    localStorage.setItem(`mp_fr_${projectId}`, JSON.stringify(data));
  },

  // Simulate real-time with polling listeners
  _listeners: {},
  on(key, cb) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(cb);
    // Poll every 500ms for demo
    const interval = setInterval(() => {
      const val = localStorage.getItem(key);
      try { cb(val ? JSON.parse(val) : null); } catch {}
    }, 500);
    return () => clearInterval(interval);
  },
  emit(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    (this._listeners[key] || []).forEach(cb => {
      try { cb(val); } catch {}
    });
  },
};

// ── High-level API (works in both Firebase and demo mode) ─────────────────────

const DB = {
  // Current user
  currentUser: null,

  async signInDemo(name) {
    const user = {
      uid: 'demo_' + generateId(),
      displayName: name || 'Anonymous',
      email: name ? `${name.toLowerCase().replace(/\s/g,'')}@demo.com` : 'anon@demo.com',
      demo: true,
    };
    DEMO_STORE.saveUser(user);
    DB.currentUser = user;
    return user;
  },

  async loadCurrentUser() {
    const u = DEMO_STORE.getUser();
    if (u) DB.currentUser = u;
    return u;
  },

  async signOut() {
    DEMO_STORE.saveUser(null);
    DB.currentUser = null;
  },

  // ── Projects ──────────────────────────────────────────────────────

  async createProject({ name, petIndex, petName, background }) {
    const uid = DB.currentUser?.uid || 'anon';
    const id = generateId();
    const project = {
      id,
      name,
      petIndex: petIndex ?? 0,
      petName: petName || 'Unnamed',
      background: background || 'meadow',
      ownerId: uid,
      members: { [uid]: DB.currentUser?.displayName || 'You' },
      inviteCode: generateInviteCode(),
      status: 'active',
      createdAt: Date.now(),
      health: 0,
      totalTreats: 0,
      sessions: [],
    };
    const projects = DEMO_STORE.getProjects();
    projects[id] = project;
    DEMO_STORE.saveProjects(projects);
    return project;
  },

  async getProject(projectId) {
    const projects = DEMO_STORE.getProjects();
    return projects[projectId] || null;
  },

  async getUserProjects() {
    const uid = DB.currentUser?.uid;
    const projects = DEMO_STORE.getProjects();
    return Object.values(projects).filter(p =>
      p.ownerId === uid || (p.members && p.members[uid])
    );
  },

  async joinProjectByCode(code) {
    const uid = DB.currentUser?.uid || 'anon';
    const projects = DEMO_STORE.getProjects();
    const project = Object.values(projects).find(p => p.inviteCode === code.toUpperCase());
    if (!project) throw new Error('Project not found. Check your invite code.');
    if (!project.members) project.members = {};
    project.members[uid] = DB.currentUser?.displayName || 'Guest';
    DEMO_STORE.saveProjects(projects);
    return project;
  },

  async completeProject(projectId) {
    const projects = DEMO_STORE.getProjects();
    if (projects[projectId]) {
      projects[projectId].status = 'completed';
      projects[projectId].completedAt = Date.now();
      DEMO_STORE.saveProjects(projects);
    }
  },

  // ── Feeding room ──────────────────────────────────────────────────

  async openFeedingRoom(projectId, sessionId, treats) {
    // treats = [{ id, type }]
    const treatsMap = {};
    treats.forEach(t => { treatsMap[t.id] = { ...t, fed: false, fedBy: null }; });

    const room = {
      sessionId,
      status: 'open',
      treats: treatsMap,
      petX: 200,
      petY: 180,
      openedAt: Date.now(),
    };
    DEMO_STORE.saveFeedingRoom(projectId, room);
    DEMO_STORE.emit(`mp_fr_${projectId}`, room);
    return room;
  },

  async feedTreat(projectId, treatId) {
    const room = DEMO_STORE.getFeedingRoom(projectId);
    if (!room || !room.treats[treatId]) return false;
    if (room.treats[treatId].fed) return false; // already fed

    room.treats[treatId].fed = true;
    room.treats[treatId].fedBy = DB.currentUser?.displayName || 'Someone';
    room.treats[treatId].fedAt = Date.now();

    // Update project health
    const projects = DEMO_STORE.getProjects();
    if (projects[projectId]) {
      projects[projectId].health = (projects[projectId].health || 0) + TREAT_HEALTH_VALUE;
      projects[projectId].totalTreats = (projects[projectId].totalTreats || 0) + 1;
      DEMO_STORE.saveProjects(projects);
    }

    DEMO_STORE.saveFeedingRoom(projectId, room);
    DEMO_STORE.emit(`mp_fr_${projectId}`, room);
    return true;
  },

  async closeFeedingRoom(projectId) {
    const room = DEMO_STORE.getFeedingRoom(projectId);
    if (room) {
      room.status = 'done';
      DEMO_STORE.saveFeedingRoom(projectId, room);
      DEMO_STORE.emit(`mp_fr_${projectId}`, room);
    }
  },

  // Subscribe to feeding room updates (returns unsubscribe fn)
  onFeedingRoom(projectId, callback) {
    // Immediate call with current state
    const current = DEMO_STORE.getFeedingRoom(projectId);
    if (current) setTimeout(() => callback(current), 0);
    return DEMO_STORE.on(`mp_fr_${projectId}`, callback);
  },

  async updatePetPosition(projectId, x, y) {
    const room = DEMO_STORE.getFeedingRoom(projectId);
    if (!room) return;
    room.petX = x; room.petY = y;
    DEMO_STORE.saveFeedingRoom(projectId, room);
    // Don't emit position updates (too noisy for localStorage polling)
  },
};

// Health value per treat
const TREAT_HEALTH_VALUE = 8;

// Pet growth stages based on total health
function getPetStage(health) {
  if (health < 20)  return { stage: 0, name: 'Tiny',    scale: 3, label: 'Baby' };
  if (health < 60)  return { stage: 1, name: 'Small',   scale: 4, label: 'Young' };
  if (health < 120) return { stage: 2, name: 'Medium',  scale: 5, label: 'Growing' };
  if (health < 200) return { stage: 3, name: 'Large',   scale: 6, label: 'Grown' };
  return              { stage: 4, name: 'Max',     scale: 7, label: 'Legendary' };
}
