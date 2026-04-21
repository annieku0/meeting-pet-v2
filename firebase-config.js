// ─────────────────────────────────────────────────────────────────────────────
// Firebase Configuration
// ─────────────────────────────────────────────────────────────────────────────
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (e.g. "meeting-pet")
// 3. Add a Web app, copy the config object below
// 4. Enable Authentication → Email/Password + Google
// 5. Enable Realtime Database (start in test mode for prototype)
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// Set to true to use local demo mode (no Firebase needed for UI testing)
const DEMO_MODE = true;
