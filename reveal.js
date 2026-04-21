// Reveal page — loads session data and animates the treat reveal

const isExtension = typeof chrome !== 'undefined' && chrome.storage;

const Store = {
  async get(key) {
    if (isExtension) return new Promise(res => chrome.storage.local.get(key, res));
    try { return { [key]: JSON.parse(localStorage.getItem(key)) }; } catch { return { [key]: null }; }
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

document.addEventListener('DOMContentLoaded', async () => {
  setTimeout(async () => {
    const session = await loadSession();
    populatePage(session);
    updateFeedCta(session);
    animateReveal();
  }, 600);
});

async function loadSession() {
  const { currentSession } = await Store.get('currentSession');
  return currentSession || {};
}

function populatePage(session) {
  // Header
  const titleEl = document.getElementById('meeting-title-h');
  titleEl.textContent = (session.meetingTitle || 'Team Meeting').toUpperCase();

  // Duration
  if (session.startTime && session.endTime) {
    const secs = Math.floor((session.endTime - session.startTime) / 1000);
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    document.getElementById('duration-display').textContent = `${m}:${s}`;
  }

  // Pet hero
  const petIndex = session.petIndex ?? 0;
  const heroCanvas = document.getElementById('hero-pet-canvas');
  heroCanvas.width = 16 * 8;
  heroCanvas.height = 16 * 8;
  renderPet(heroCanvas.getContext('2d'), petIndex, 0, 0, 8);
  document.getElementById('hero-pet-name').textContent =
    (session.petName || PET_SPRITES[petIndex]?.name || 'Your Pet').toUpperCase();

  // Tally treats
  const treatCounts = {};
  (session.treats || []).forEach(t => {
    treatCounts[t] = (treatCounts[t] || 0) + 1;
  });
  const totalCount = Object.values(treatCounts).reduce((a, b) => a + b, 0);

  // Total counter
  document.getElementById('total-treats').textContent = totalCount;

  // Treats earned grid
  const grid = document.getElementById('treats-earned-grid');
  grid.innerHTML = '';

  if (totalCount === 0) {
    const msg = document.createElement('div');
    msg.className = 'no-treats-msg';
    msg.textContent = 'No treats yet — try submitting some meeting transcript to your pet!';
    grid.appendChild(msg);
  } else {
    TREAT_ORDER.forEach((tid, i) => {
      const count = treatCounts[tid] || 0;
      if (count === 0) return;
      const treat = TREATS[tid];
      const chip = document.createElement('div');
      chip.className = 'treat-chip earned';
      chip.style.animationDelay = `${i * 80}ms`;
      chip.innerHTML = `
        <span class="treat-emoji">${treat.emoji}</span>
        <div>
          <div class="treat-count">×${count}</div>
          <div class="treat-chip-name">${treat.name}</div>
        </div>
      `;
      grid.appendChild(chip);
    });
  }

  // Treat legend — highlight earned ones, with collapsible moments dropdown
  const moments = session.moments || [];
  const legendEl = document.getElementById('treats-legend');
  legendEl.innerHTML = '';
  TREAT_ORDER.forEach(tid => {
    const treat = TREATS[tid];
    const count = treatCounts[tid] || 0;
    const treatMoments = moments.filter(m => m.treat === tid);

    const row = document.createElement('div');
    row.className = `legend-row${count > 0 ? ' highlighted' : ''}`;

    const hasDropdown = count > 0 && treatMoments.length > 0;

    row.innerHTML = `
      <div class="legend-emoji">${treat.emoji}</div>
      <div class="legend-text">
        <div class="legend-name">${treat.name.toUpperCase()}</div>
        <div class="legend-meaning">${treat.meaning}</div>
        <div class="legend-desc">${treat.description}</div>
        ${count > 0 ? `
          <div class="legend-earned-row">
            <span class="legend-badge">EARNED ×${count}</span>
            ${hasDropdown ? `<button class="moments-toggle" aria-expanded="false">▸ show moments</button>` : ''}
          </div>
          ${hasDropdown ? `
            <div class="moments-dropdown hidden">
              ${treatMoments.map(m => `
                <div class="moment-item">
                  <div class="moment-text">"${m.quote || treat.meaning}"</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;

    if (hasDropdown) {
      const toggle = row.querySelector('.moments-toggle');
      const dropdown = row.querySelector('.moments-dropdown');
      toggle.addEventListener('click', () => {
        const open = !dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden', open);
        toggle.textContent = open ? '▸ show moments' : '▾ hide moments';
        toggle.setAttribute('aria-expanded', String(!open));
      });
    }

    legendEl.appendChild(row);
  });
}

function animateReveal() {
  const curtain = document.getElementById('curtain');
  const page = document.getElementById('reveal-page');

  curtain.classList.add('fade-out');
  page.classList.remove('hidden');

  setTimeout(() => {
    curtain.style.display = 'none';
  }, 700);
}

// ── Feed pet button ──────────────────────────────────────────────
document.getElementById('btn-feed-pet').addEventListener('click', async () => {
  const { currentSession: session } = await Store.get('currentSession');
  if (!session) return;

  // Build treat list from session
  const treatList = (session.treats || []).map((type, i) => ({ id: `t${i}`, type }));

  // Load or create the project for this session
  await DB.loadCurrentUser();
  if (!DB.currentUser) await DB.signInDemo('Meeting Attendee');

  const projects = DEMO_STORE.getProjects();
  let project = Object.values(projects).find(p =>
    p.name === (session.meetingTitle || 'Meeting') ||
    p.petName === (session.petName || '')
  );

  if (!project) {
    project = await DB.createProject({
      name:       session.meetingTitle || 'Meeting',
      petIndex:   session.petIndex ?? 0,
      petName:    session.petName || 'Your Pet',
      background: 'meadow',
    });
  }

  await DB.openFeedingRoom(project.id, session.sessionId || 'session1', treatList);

  // Open feeding room
  if (isExtension) {
    const feedingUrl = chrome.runtime.getURL(`feeding.html?projectId=${project.id}`);
    chrome.tabs.create({ url: feedingUrl });
  } else {
    window.location.href = `feeding.html?projectId=${project.id}`;
  }
});

// Update feed CTA pet preview
function updateFeedCta(session) {
  const petIndex = session?.petIndex ?? 0;
  const ctaCanvas = document.getElementById('feed-cta-canvas');
  if (ctaCanvas) {
    ctaCanvas.width  = 16 * 5;
    ctaCanvas.height = 16 * 5;
    renderPet(ctaCanvas.getContext('2d'), petIndex, 0, 0, 5);
  }
}

// ── Copy report ──────────────────────────────────────────────────
document.getElementById('btn-copy-report').addEventListener('click', async () => {
  const { currentSession: session } = await Store.get('currentSession');
  const text = buildReportText(session || {});
  await navigator.clipboard.writeText(text);

  const btn = document.getElementById('btn-copy-report');
  const orig = btn.textContent;
  btn.textContent = '✓ COPIED!';
  setTimeout(() => { btn.textContent = orig; }, 2000);
});

function buildReportText(session) {
  const treatCounts = {};
  (session.treats || []).forEach(t => {
    treatCounts[t] = (treatCounts[t] || 0) + 1;
  });
  const total = Object.values(treatCounts).reduce((a, b) => a + b, 0);

  const lines = [
    '🐾 MEETING PET — MEETING REPORT',
    '================================',
    `Meeting: ${session.meetingTitle || 'Team Meeting'}`,
    `Pet: ${session.petName || 'Unknown'}`,
    '',
    `Total Treats Earned: ${total}`,
    '',
    '--- TREATS ---',
  ];

  TREAT_ORDER.forEach(tid => {
    const count = treatCounts[tid] || 0;
    if (count === 0) return;
    const treat = TREATS[tid];
    lines.push(`${treat.emoji} ${treat.name} ×${count} — ${treat.meaning}`);
  });

  lines.push('');
  lines.push('--- TREAT GUIDE ---');
  TREAT_ORDER.forEach(tid => {
    const treat = TREATS[tid];
    lines.push(`${treat.emoji} ${treat.name}: ${treat.description}`);
  });

  lines.push('');
  lines.push('Generated by Meeting Pet 🐾');

  return lines.join('\n');
}

// ── New meeting ──────────────────────────────────────────────────
document.getElementById('btn-new-meeting').addEventListener('click', async () => {
  await Store.remove('currentSession');
  if (isExtension) {
    window.close();
  } else {
    window.location.href = 'popup.html';
  }
});
