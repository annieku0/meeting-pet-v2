// ─────────────────────────────────────────────────────────────────────────────
// Meeting Pet — Live Listener
// Pipeline: getDisplayMedia (tab audio) → Deepgram WebSocket → transcript
//           → buffer chunks → Claude analysis → treats
// ─────────────────────────────────────────────────────────────────────────────

const Store = {
  async get(key) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise(res => chrome.storage.local.get(key, res));
    }
    try { return { [key]: JSON.parse(localStorage.getItem(key)) }; } catch { return { [key]: null }; }
  },
  async set(obj) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise(res => chrome.storage.local.set(obj, res));
    }
    Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  },
};

// ── State ─────────────────────────────────────────────────────────────────────
let session       = null;
let deepgramKey   = null;
let anthropicKey  = null;
let audioStream   = null;
let audioContext  = null;
let deepgramWs    = null;
let timerInterval = null;
let startTime     = null;
let animRafId     = null;
let petFrame      = 0;

let transcriptBuffer   = '';    // accumulates text between analysis calls
let totalWords         = 0;
let seenSpeakers       = new Set();
let chunksAnalyzed     = 0;
let totalTreats        = 0;
const ANALYSIS_INTERVAL_MS = 45_000; // analyze every 45s
let analysisTimer = null;

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const data = await Store.get('currentSession');
  session = data.currentSession;

  const keys = await Store.get('apiKey');
  anthropicKey = keys.apiKey || null;

  const dg = await Store.get('deepgramKey');
  deepgramKey = dg.deepgramKey || null;

  renderSetupScreen();
  checkKeys();

  document.getElementById('btn-start-listen').addEventListener('click', startListening);
  document.getElementById('btn-end-listen').addEventListener('click', endMeeting);
});

// ── Setup screen ──────────────────────────────────────────────────────────────
function renderSetupScreen() {
  if (!session) return;
  const petIndex = session.petIndex ?? 0;
  const wrap = document.getElementById('setup-pet-canvas-wrap');
  const canvas = createPetCanvas(petIndex, 6);
  wrap.appendChild(canvas);

  document.getElementById('setup-pet-name').textContent = (session.petName || 'Your Pet').toUpperCase();
  document.getElementById('setup-meeting-name').textContent = (session.meetingTitle || 'Team Meeting').toUpperCase();
}

function checkKeys() {
  const setKey = (dotId, statusId, hasKey) => {
    const dot    = document.getElementById(dotId);
    const status = document.getElementById(statusId);
    if (hasKey) {
      dot.classList.add('ok');
      status.textContent = '✓ set';
      status.classList.add('ok');
    } else {
      status.textContent = 'not set';
    }
  };
  setKey('dot-deepgram',  'status-deepgram',  !!deepgramKey);
  setKey('dot-anthropic', 'status-anthropic', !!anthropicKey);
}

// ── Start listening ───────────────────────────────────────────────────────────
async function startListening() {
  const btn = document.getElementById('btn-start-listen');
  const err = document.getElementById('setup-error');
  btn.disabled = true;
  btn.textContent = 'Requesting audio...';
  err.textContent = '';

  try {
    // Request tab/screen audio capture
    audioStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,   // Chrome requires video:true even if we only use audio
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 16000,
      },
    });

    // Stop the video track immediately — we only need audio
    audioStream.getVideoTracks().forEach(t => t.stop());

    // Check we actually got an audio track
    const audioTracks = audioStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No audio track — make sure to check "Share tab audio" when sharing.');
    }

    // Switch to listening screen
    showListenScreen();
    initListenScreen();

    // Start audio pipeline
    if (deepgramKey) {
      await startDeepgramPipeline();
    } else {
      // Fallback: Web Speech API on microphone (no Deepgram key)
      startWebSpeechFallback();
    }

    // Start periodic analysis
    analysisTimer = setInterval(flushAndAnalyze, ANALYSIS_INTERVAL_MS);

  } catch (e) {
    btn.disabled = false;
    btn.textContent = '🎙 START LISTENING';
    if (e.name === 'NotAllowedError') {
      err.textContent = 'Permission denied. Please allow screen/tab sharing.';
    } else {
      err.textContent = e.message || 'Could not start audio capture.';
    }
  }
}

// ── Deepgram real-time pipeline ───────────────────────────────────────────────
async function startDeepgramPipeline() {
  // Set up AudioContext to process the stream
  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(audioStream);

  // ScriptProcessor to convert float32 → int16 PCM and send to Deepgram
  const bufferSize = 4096;
  const processor  = audioContext.createScriptProcessor(bufferSize, 1, 1);

  // Open Deepgram WebSocket
  // model=nova-2: best accuracy | diarize=true: speaker labels | punctuate=true
  const wsUrl = `wss://api.deepgram.com/v1/listen?` +
    `model=nova-2&language=en&punctuate=true&diarize=true` +
    `&interim_results=true&utterance_end_ms=1500&vad_events=true`;

  deepgramWs = new WebSocket(wsUrl, ['token', deepgramKey]);
  deepgramWs.binaryType = 'arraybuffer';

  deepgramWs.onopen = () => {
    setStatus('LISTENING');
    // Start sending audio
    processor.onaudioprocess = (e) => {
      if (deepgramWs.readyState !== WebSocket.OPEN) return;
      const float32 = e.inputBuffer.getChannelData(0);
      const int16   = float32ToInt16(float32);
      deepgramWs.send(int16.buffer);
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  deepgramWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleDeepgramMessage(msg);
    } catch {}
  };

  deepgramWs.onerror = (e) => setStatus('ERROR — check Deepgram key');
  deepgramWs.onclose = () => {
    if (audioContext) setStatus('DISCONNECTED');
  };

  // Handle stream end
  audioStream.getAudioTracks()[0].addEventListener('ended', () => {
    setStatus('TAB CLOSED');
    stopAudio();
  });
}

function float32ToInt16(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
  }
  return int16;
}

function handleDeepgramMessage(msg) {
  // Metadata message
  if (msg.type === 'Metadata') return;

  // Speech started / ended events (for VAD)
  if (msg.type === 'SpeechStarted') return;

  // Results
  if (msg.type === 'Results') {
    const alt = msg.channel?.alternatives?.[0];
    if (!alt || !alt.transcript) return;

    const text      = alt.transcript.trim();
    const isFinal   = msg.is_final;
    const speaker   = alt.words?.[0]?.speaker ?? null;

    if (!text) return;

    if (isFinal) {
      // Add to permanent transcript buffer
      const speakerLabel = speaker !== null ? `Speaker ${speaker}` : null;
      addTranscriptLine(text, speakerLabel, false);
      transcriptBuffer += (speakerLabel ? `[${speakerLabel}] ` : '') + text + '\n';
      totalWords += text.split(/\s+/).length;
      if (speaker !== null) seenSpeakers.add(speaker);
      updateStats();
    } else {
      // Show interim result
      showInterim(text, speaker);
    }
  }

  // UtteranceEnd — good time to trigger analysis if buffer is large
  if (msg.type === 'UtteranceEnd') {
    const wordCount = transcriptBuffer.split(/\s+/).length;
    if (wordCount > 60) flushAndAnalyze();
  }
}

// ── Web Speech API fallback (microphone, no Deepgram key) ─────────────────────
function startWebSpeechFallback() {
  setStatus('LISTENING (MIC)');
  document.getElementById('listen-source').textContent = 'microphone only';

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    setStatus('ERROR — browser does not support speech recognition');
    return;
  }

  const rec = new SpeechRec();
  rec.continuous      = true;
  rec.interimResults  = true;
  rec.lang            = 'en-US';

  rec.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text    = event.results[i][0].transcript.trim();
      const isFinal = event.results[i].isFinal;
      if (isFinal && text) {
        addTranscriptLine(text, 'You', false);
        transcriptBuffer += `[You] ${text}\n`;
        totalWords += text.split(/\s+/).length;
        updateStats();
      } else if (text) {
        showInterim(text, null);
      }
    }
  };

  rec.onerror = (e) => {
    if (e.error !== 'no-speech') setStatus(`ERROR: ${e.error}`);
  };

  rec.onend = () => { if (audioContext) rec.start(); }; // auto-restart

  rec.start();
}

// ── Transcript UI ─────────────────────────────────────────────────────────────
let interimLineEl = null;

function addTranscriptLine(text, speaker, isInterim) {
  const feed = document.getElementById('transcript-feed');

  // Remove placeholder
  const placeholder = feed.querySelector('.feed-placeholder');
  if (placeholder) placeholder.remove();

  // Remove old interim line
  if (interimLineEl) { interimLineEl.remove(); interimLineEl = null; }

  const line = document.createElement('div');
  line.className = 'feed-line';

  const spkEl = document.createElement('div');
  const spkIndex = speaker !== null ? (parseInt(speaker?.replace?.('Speaker ', '') ?? 99)) : 99;
  spkEl.className = `feed-speaker spk-${Math.min(spkIndex, 4)}`;
  if (spkIndex >= 5 || speaker === null) spkEl.className = 'feed-speaker spk-other';
  spkEl.textContent = speaker ? speaker.replace('Speaker ', 'S') : '?';

  const textEl = document.createElement('div');
  textEl.className = `feed-text${isInterim ? ' interim' : ''}`;
  textEl.textContent = text;

  line.appendChild(spkEl);
  line.appendChild(textEl);

  if (isInterim) {
    interimLineEl = line;
  }

  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;
}

function showInterim(text, speaker) {
  const speakerLabel = speaker !== null ? `Speaker ${speaker}` : null;
  if (interimLineEl) {
    interimLineEl.querySelector('.feed-text').textContent = text;
    return;
  }
  addTranscriptLine(text, speakerLabel, true);
}

// ── Analysis ──────────────────────────────────────────────────────────────────
async function flushAndAnalyze() {
  const chunk = transcriptBuffer.trim();
  transcriptBuffer = '';
  if (!chunk || chunk.split(/\s+/).length < 10) return;

  try {
    const result = anthropicKey
      ? await analyzeWithClaude(chunk, anthropicKey)
      : analyzeLocally(chunk);

    const newTreats = result.treats || [];
    const newMoments = result.moments || [];

    if (newTreats.length > 0) {
      // Save to session
      const data = await Store.get('currentSession');
      const s = data.currentSession || session;
      s.treats  = (s.treats  || []).concat(newTreats);
      s.moments = (s.moments || []).concat(newMoments);
      await Store.set({ currentSession: s });
      session = s;

      totalTreats += newTreats.length;
      chunksAnalyzed++;
      updateStats();
      updateTreatTease();
    } else {
      chunksAnalyzed++;
      updateStats();
    }
  } catch (e) {
    console.warn('Analysis error:', e);
  }
}

async function analyzeWithClaude(transcript, apiKey) {
  const systemPrompt = `You are analyzing a meeting transcript to identify communication moments that help cross-department collaboration. Speaker labels like [Speaker 0] indicate different people.

For each identified moment, assign one of these treat types:
- apple: Clarifying question (asking what something means, requesting explanation)
- cake: Deadline/timeline question (when is this due, what's the schedule)
- cookie: Process/workflow question (how do we handle this, who owns this step)
- carrot: Jargon translation (explaining department-specific terminology to others)
- star: Action item defined (someone committed to a next step with owner/deadline)
- candy: Cross-team alignment (two departments agreeing, finding common ground)
- blueberry: Follow-up scheduled (agreeing to meet again or circle back)
- gem: Problem resolved (a blocker or issue solved during the meeting)

Return ONLY JSON: {"treats":["apple","cake"],"moments":[{"treat":"apple","quote":"brief quote"},{"treat":"cake","quote":"brief quote"}]}

Be conservative — only award treats for clear, genuine instances.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Analyze:\n\n${transcript}` }],
    }),
  });

  if (!response.ok) throw new Error(`API ${response.status}`);
  const data = await response.json();
  const text = data.content[0]?.text || '{}';
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  return json ? JSON.parse(json) : { treats: [], moments: [] };
}

function analyzeLocally(transcript) {
  const lower = transcript.toLowerCase();
  const patterns = [
    { treat: 'apple',     kws: ['what do you mean', 'can you clarify', "don't understand", 'can you explain', 'what does', 'what is that'] },
    { treat: 'cake',      kws: ['deadline', 'by when', 'when is', 'timeline', 'schedule', 'eta', 'due date', 'how long'] },
    { treat: 'cookie',    kws: ['who is responsible', 'how do we', "what's the process", 'workflow', 'who owns', 'next steps'] },
    { treat: 'carrot',    kws: ['in our team', 'we call it', 'terminology', 'what we mean by', 'in other words', 'our term'] },
    { treat: 'star',      kws: ['action item', 'i will', 'will follow up', 'next step', 'assigned to', 'by friday', 'by monday', 'by thursday', 'i\'ll take'] },
    { treat: 'candy',     kws: ['agreed', 'same page', 'that aligns', 'we can work with that', 'perfect', 'that works for us'] },
    { treat: 'blueberry', kws: ['follow up', "let's meet", 'sync next', 'circle back', 'catch up', 'schedule a'] },
    { treat: 'gem',       kws: ['that solves', 'problem solved', 'resolved', 'figured out', 'that works', 'great solution'] },
  ];
  const treats = [], moments = [];
  for (const { treat, kws } of patterns) {
    for (const kw of kws) {
      if (lower.includes(kw)) {
        treats.push(treat);
        moments.push({ treat, quote: `Detected: "${kw}"` });
        break;
      }
    }
  }
  return { treats, moments };
}

// ── Stats & UI updates ────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('stat-words').textContent    = totalWords;
  document.getElementById('stat-speakers').textContent = seenSpeakers.size || '—';
  document.getElementById('stat-chunks').textContent   = chunksAnalyzed;
  document.getElementById('stat-treats').textContent   = totalTreats;
}

function updateTreatTease() {
  const el = document.getElementById('listen-treat-tease');
  if (totalTreats === 0) {
    el.textContent = '🐾 listening...';
    el.classList.remove('has-treats');
  } else {
    el.textContent = `${totalTreats} treat${totalTreats !== 1 ? 's' : ''} earned 🔒`;
    el.classList.add('has-treats');
  }
}

function setStatus(text) {
  const el = document.getElementById('listen-status-text');
  if (el) el.textContent = text;
}

// ── Listen screen init ────────────────────────────────────────────────────────
function showListenScreen() {
  document.getElementById('screen-setup').classList.remove('active');
  document.getElementById('screen-listen').classList.add('active');
}

function initListenScreen() {
  document.getElementById('listen-meeting-name').textContent = (session?.meetingTitle || 'Meeting').toUpperCase();
  document.getElementById('listen-source').textContent = deepgramKey ? 'tab audio · deepgram' : 'microphone · speech api';
  document.getElementById('listen-pet-name').textContent = session?.petName || 'Your Pet';

  // Pet animation
  const canvas = document.getElementById('listen-pet-canvas');
  let frame = 0;
  function animate() {
    renderPetAnimated(canvas, session?.petIndex ?? 0, 5, frame++);
    animRafId = requestAnimationFrame(animate);
  }
  animate();

  // Timer
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const el = document.getElementById('listen-timer');
    const e  = Math.floor((Date.now() - startTime) / 1000);
    el.textContent = `${String(Math.floor(e/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`;
  }, 1000);
}

// ── Stop audio ────────────────────────────────────────────────────────────────
function stopAudio() {
  if (deepgramWs) { deepgramWs.close(); deepgramWs = null; }
  if (audioContext) { audioContext.close(); audioContext = null; }
  if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
  clearInterval(analysisTimer);
}

// ── End meeting ───────────────────────────────────────────────────────────────
async function endMeeting() {
  // Final flush
  await flushAndAnalyze();
  stopAudio();
  clearInterval(timerInterval);
  cancelAnimationFrame(animRafId);

  // Mark session done
  const data = await Store.get('currentSession');
  const s = data.currentSession || session;
  s.active   = false;
  s.endTime  = Date.now();
  await Store.set({ currentSession: s });

  // Navigate to reveal
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'OPEN_REVEAL' });
    window.close();
  } else {
    window.location.href = 'reveal.html';
  }
}
