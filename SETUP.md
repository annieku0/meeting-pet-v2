# Synko — Install Guide

Welcome to the team pet 🐾. Five-minute setup.

## 1. Install the extension

1. Download or clone this folder (`meeting-pet-v2`) somewhere on your machine.
2. Open Chrome and go to `chrome://extensions`.
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and pick the `meeting-pet-v2` folder.
5. Pin the Synko icon to your Chrome toolbar so it's easy to find.

## 2. Get two free API keys

You'll need one key from each service. Both are free for our usage level.

### Deepgram (live transcription)
- Sign up: https://console.deepgram.com/signup
- After signup, go to **API Keys** → **Create a New API Key**
- Copy the key (free tier = ~45 hr of transcription per month)

### Anthropic (Claude — analyzes the transcript)
- Sign up: https://console.anthropic.com/
- Go to **API Keys** → **Create Key**
- Copy the key (starts with `sk-ant-...`)
- New accounts get free credits; running a few demo meetings costs cents

## 3. Paste them in

1. Click the Synko extension icon — you'll see a **SET UP SYNKO** screen.
2. Paste your Deepgram key in the first box, your Anthropic key in the second.
3. Hit **SAVE & CONTINUE**. Done — keys are stored locally in your browser only.

## 4. First time you run a meeting

- Click the Synko icon → log in with any name + password (creates a local account)
- Hatch the team pet from Slack with `/init` (or use the existing one)
- Click **START LIVE MEETING** — Chrome will ask for **microphone access**, allow it
- Optional: tick "Also capture meeting tab audio" to pick up other speakers from a Zoom/Meet tab
- On macOS you may also need to grant Chrome mic access in **System Settings → Privacy & Security → Microphone**

## Troubleshooting

- **Mic prompt didn't appear** — check `chrome://settings/content/microphone` and make sure Chrome isn't blocking it.
- **"No tab audio"** — when the tab picker appears, tick **Share tab audio** (bottom-left checkbox).
- **Keys wrong / want to change them** — open the extension, click the ⚙ gear icon → update keys → SAVE.

## What gets stored where

- API keys: `chrome.storage.local` (your browser only — never sent anywhere except directly to Deepgram & Anthropic)
- Pet state, meeting transcripts: same place, all local
- Nothing is uploaded to any Synko server (there isn't one)
