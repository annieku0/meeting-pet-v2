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
    // Legacy: post-meeting reveal page is no longer used. Route to slack instead.
    chrome.tabs.create({ url: chrome.runtime.getURL('slack.html') });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'OPEN_SLACK') {
    focusOrOpenSlackTab(false).then(sendResponse);
    return true;
  }

  // Triggered by listen.js endMeeting — focus the user's existing slack tab
  // (if any), tell it to surface the freshly-written pending zoom report,
  // and close the listen tab. Falls back to opening a new tab.
  if (message.type === 'OPEN_SLACK_FOR_REPORT') {
    focusOrOpenSlackTab(true).then((res) => {
      const senderTabId = sender?.tab?.id;
      if (senderTabId) {
        // Close the listen tab in a moment so the user lands on slack.
        setTimeout(() => chrome.tabs.remove(senderTabId).catch(() => {}), 150);
      }
      sendResponse(res);
    });
    return true;
  }

  if (message.type === 'OPEN_POPUP') {
    // Closing the slack tab and re-opening the popup is what the user expects.
    chrome.action.openPopup?.();
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

// Focus an existing slack.html tab if one is open; otherwise open a new one.
// When triggerReport is true, sends a message to the tab telling it to
// surface the just-written `mp_pending_zoom_report` payload.
async function focusOrOpenSlackTab(triggerReport) {
  const slackUrl = chrome.runtime.getURL('slack.html');
  try {
    const tabs = await chrome.tabs.query({});
    // Match any tab whose URL starts with our slack page (extension origin).
    const existing = tabs.find(t => (t.url || '').startsWith(slackUrl));
    if (existing) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId !== undefined) {
        try { await chrome.windows.update(existing.windowId, { focused: true }); } catch {}
      }
      if (triggerReport) {
        try { await chrome.tabs.sendMessage(existing.id, { type: 'PROCESS_PENDING_REPORT' }); } catch {}
      }
      return { ok: true, focused: true };
    }
    await chrome.tabs.create({ url: slackUrl });
    return { ok: true, opened: true };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}
