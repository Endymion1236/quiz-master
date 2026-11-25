import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getDatabase, ref, onValue } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyBj2aoiYQutYgsZmz6Ij9mWmgV2u7zjpU4",
  authDomain: "quiz-v3-a3a50.firebaseapp.com",
  projectId: "quiz-v3-a3a50",
  storageBucket: "quiz-v3-a3a50.firebasestorage.app",
  messagingSenderId: "842918285727",
  appId: "1:842918285727:web:c4342d1cd04cb56256adaa",
  databaseURL: "https://quiz-v3-a3a50-default-rtdb.europe-west1.firebasedatabase.app",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

// === Server time offset ===
// Firebase Realtime Database estimates the clock difference between this device and the server.
// serverNow() returns the corrected "server time" from any device.
// If RTDB is not available, falls back to local clock (offset = 0).
let _serverTimeOffset = 0

try {
  const rtdb = getDatabase(app)
  const offsetRef = ref(rtdb, '.info/serverTimeOffset')
  onValue(offsetRef, (snap) => {
    _serverTimeOffset = snap.val() || 0
    console.log('⏱️ Server time offset:', _serverTimeOffset, 'ms')
  }, (err) => {
    console.warn('⏱️ RTDB not available, using local clock. Enable Realtime Database in Firebase Console for better sync.')
  })
} catch (e) {
  console.warn('⏱️ Could not initialize RTDB:', e.message)
}

/** Returns current server time (ms) corrected for clock skew */
export function serverNow() {
  return Date.now() + _serverTimeOffset
}

// Sign in anonymously on load
let _userId = null
let _authReady = false
const _authCallbacks = []

signInAnonymously(auth).catch(e => console.error('Auth error:', e))

onAuthStateChanged(auth, user => {
  _userId = user?.uid || null
  _authReady = true
  _authCallbacks.forEach(cb => cb(_userId))
  _authCallbacks.length = 0
})

export function getUserId() { return _userId }

export function waitForAuth() {
  return new Promise(resolve => {
    if (_authReady) return resolve(_userId)
    _authCallbacks.push(resolve)
  })
}
