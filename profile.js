// Profile page controller

let selectedNewPetIndex = 0;
const MAX_HEALTH = 300;

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await DB.loadCurrentUser();

  if (DB.currentUser) {
    showProfile();
  } else {
    showLogin();
  }

  bindEvents();
  buildMiniPetGrid();
});

// ── Login ─────────────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('screen-login').classList.add('active');
  document.getElementById('screen-profile').classList.remove('active');
}

async function doLogin() {
  const name = document.getElementById('login-name').value.trim();
  if (!name) {
    document.getElementById('login-error').textContent = 'Please enter your name.';
    return;
  }
  await DB.signInDemo(name);
  showProfile();
}

// ── Profile ───────────────────────────────────────────────────────────────────
async function showProfile() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-profile').classList.add('active');

  const user = DB.currentUser;
  document.getElementById('user-name-display').textContent = user.displayName.toUpperCase();
  document.getElementById('user-avatar').textContent = user.displayName[0].toUpperCase();

  await loadProjects();
}

async function loadProjects() {
  const projects = await DB.getUserProjects();
  const active = projects.filter(p => p.status === 'active');
  const past   = projects.filter(p => p.status === 'completed');

  renderPetList('active-pets-list', active, false);
  renderPetList('past-pets-list', past, true);
}

function renderPetList(containerId, projects, retired) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (projects.length === 0) {
    container.innerHTML = `<div class="empty-state">${retired ? 'No completed projects yet.' : 'No active projects yet. Start one below!'}</div>`;
    return;
  }

  projects.forEach(project => {
    const card = buildPetCard(project, retired);
    container.appendChild(card);
  });
}

function buildPetCard(project, retired) {
  const health = project.health || 0;
  const stage  = getPetStage(health);
  const pct    = Math.min(100, Math.round((health / MAX_HEALTH) * 100));
  const members = Object.values(project.members || {});

  const card = document.createElement('div');
  card.className = `pet-card${retired ? ' retired' : ''}`;

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width  = 16 * 4;
  canvas.height = 16 * 4;
  canvas.className = 'pet-card-canvas';
  renderPet(canvas.getContext('2d'), project.petIndex ?? 0, 0, 0, 4);

  // Info
  const info = document.createElement('div');
  info.className = 'pet-card-info';
  info.innerHTML = `
    <div class="pet-card-name">${(project.petName || 'Unnamed').toUpperCase()}</div>
    <div class="pet-card-project">${project.name || 'Unnamed Project'}</div>
    <div class="pet-card-meta">
      ${members.length} member${members.length !== 1 ? 's' : ''} ·
      ${project.totalTreats || 0} treats total ·
      BG: ${project.background || 'meadow'}
    </div>
  `;

  // Health
  const healthWrap = document.createElement('div');
  healthWrap.className = 'health-mini';
  healthWrap.innerHTML = `
    <div class="health-mini-bar"><div class="health-mini-fill" style="width:${pct}%"></div></div>
    <div class="health-mini-label">${pct}% health</div>
    <div class="stage-mini">${stage.label.toUpperCase()}</div>
  `;

  // Actions
  const actions = document.createElement('div');
  actions.className = 'pet-card-actions';

  if (!retired) {
    const inviteBtn = document.createElement('button');
    inviteBtn.className = 'btn-card';
    inviteBtn.textContent = `📋 ${project.inviteCode}`;
    inviteBtn.title = 'Copy invite code';
    inviteBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(project.inviteCode);
      inviteBtn.textContent = '✓ COPIED';
      setTimeout(() => { inviteBtn.textContent = `📋 ${project.inviteCode}`; }, 2000);
    });

    const feedBtn = document.createElement('button');
    feedBtn.className = 'btn-card primary';
    feedBtn.textContent = '🍎 FEED PET';
    feedBtn.addEventListener('click', () => {
      window.open(`feeding.html?projectId=${project.id}`, '_blank');
    });

    const completeBtn = document.createElement('button');
    completeBtn.className = 'btn-card';
    completeBtn.textContent = '✓ RETIRE';
    completeBtn.addEventListener('click', async () => {
      if (!confirm(`Retire ${project.petName}? This ends the project.`)) return;
      await DB.completeProject(project.id);
      await loadProjects();
    });

    actions.appendChild(inviteBtn);
    actions.appendChild(feedBtn);
    actions.appendChild(completeBtn);
  } else {
    const badge = document.createElement('div');
    badge.className = 'retired-badge';
    badge.textContent = '✓ RETIRED';
    actions.appendChild(badge);

    // Date
    if (project.completedAt) {
      const d = new Date(project.completedAt);
      const label = document.createElement('div');
      label.style.cssText = 'font-size:6px;color:var(--dark);text-align:right;margin-top:4px';
      label.textContent = d.toLocaleDateString();
      actions.appendChild(label);
    }
  }

  card.appendChild(canvas);
  card.appendChild(info);
  card.appendChild(healthWrap);
  card.appendChild(actions);
  return card;
}

// ── Mini pet grid (new project) ───────────────────────────────────────────────
function buildMiniPetGrid() {
  const grid = document.getElementById('new-pet-grid');
  PET_SPRITES.forEach((pet, idx) => {
    const cell = document.createElement('div');
    cell.className = `mini-pet-cell${idx === 0 ? ' selected' : ''}`;
    const c = createPetCanvas(idx, 2);
    cell.appendChild(c);
    cell.addEventListener('click', () => {
      document.querySelectorAll('.mini-pet-cell').forEach(el => el.classList.remove('selected'));
      cell.classList.add('selected');
      selectedNewPetIndex = idx;
      document.getElementById('new-pet-name-sel').textContent = pet.name.toUpperCase();
    });
    grid.appendChild(cell);
  });
  document.getElementById('new-pet-name-sel').textContent = PET_SPRITES[0].name.toUpperCase();
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  document.getElementById('btn-signout').addEventListener('click', async () => {
    await DB.signOut();
    showLogin();
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab !== 'join') loadProjects();
    });
  });

  // Create project
  document.getElementById('btn-create-project').addEventListener('click', createProject);

  // Join project
  document.getElementById('btn-join-project').addEventListener('click', joinProject);
}

async function createProject() {
  const name    = document.getElementById('new-project-name').value.trim();
  const petName = document.getElementById('new-pet-name').value.trim() || PET_SPRITES[selectedNewPetIndex].name;
  const bg      = document.getElementById('new-bg').value;
  const status  = document.getElementById('create-status');

  if (!name) { status.textContent = 'Please enter a project name.'; status.className = 'form-status error'; return; }

  const project = await DB.createProject({
    name,
    petIndex:   selectedNewPetIndex,
    petName,
    background: bg,
  });

  status.textContent = `✓ Created! Invite code: ${project.inviteCode}`;
  status.className = 'form-status';

  // Clear form
  document.getElementById('new-project-name').value = '';
  document.getElementById('new-pet-name').value = '';

  // Switch to active tab
  setTimeout(() => {
    document.querySelector('[data-tab="active"]').click();
  }, 1200);
}

async function joinProject() {
  const code   = document.getElementById('join-code').value.trim();
  const status = document.getElementById('join-status');
  if (!code) { status.textContent = 'Enter an invite code.'; status.className = 'form-status error'; return; }

  try {
    const project = await DB.joinProjectByCode(code);
    status.textContent = `✓ Joined "${project.name}"! Check Active Pets.`;
    status.className = 'form-status';
    document.getElementById('join-code').value = '';
    setTimeout(() => document.querySelector('[data-tab="active"]').click(), 1200);
  } catch (e) {
    status.textContent = e.message;
    status.className = 'form-status error';
  }
}
