// Service worker — handles API calls and state persistence

importScripts('analyzer.js');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_TRANSCRIPT') {
    handleAnalysis(message.transcript).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true; // async
  }

  if (message.type === 'OPEN_REVEAL') {
    chrome.tabs.create({ url: chrome.runtime.getURL('reveal.html') });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'OPEN_SETTINGS') {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    sendResponse({ ok: true });
    return true;
  }
});

async function handleAnalysis(transcript) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  const session = await getSession();

  let result;
  if (apiKey && apiKey.trim()) {
    try {
      result = await analyzeTranscript(transcript, apiKey.trim());
    } catch (e) {
      // Fallback to local analysis on API error
      result = analyzeTranscriptLocal(transcript);
      result.apiError = e.message;
    }
  } else {
    result = analyzeTranscriptLocal(transcript);
    result.noApiKey = true;
  }

  // Accumulate treats into session (never expose them until reveal)
  const newTreats = result.treats || [];
  const newMoments = result.moments || [];
  session.treats = (session.treats || []).concat(newTreats);
  session.moments = (session.moments || []).concat(newMoments);
  session.analyzeCount = (session.analyzeCount || 0) + 1;

  await chrome.storage.local.set({ currentSession: session });

  // Return a masked response — just confirm it was processed, no treat details
  return {
    ok: true,
    processed: true,
    message: newTreats.length > 0
      ? 'Your pet noticed something interesting! 🐾'
      : 'Your pet is listening...',
  };
}

async function getSession() {
  const { currentSession } = await chrome.storage.local.get('currentSession');
  return currentSession || { treats: [], moments: [], analyzeCount: 0 };
}
