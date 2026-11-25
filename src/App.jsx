import { useState, useEffect, useRef } from 'react'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import Landing from './pages/Landing'
import HostSetup from './pages/HostSetup'
import HostLobby from './pages/HostLobby'
import HostGame from './pages/HostGame'
import PlayerJoin from './pages/PlayerJoin'
import PlayerGame from './pages/PlayerGame'
import ScreenMode from './pages/ScreenMode'
import Editor from './pages/Editor'
import ImportExport from './pages/ImportExport'
import Results from './pages/Results'
import GameHistory from './pages/GameHistory'
import HostGate from './components/HostGate'
import { DEMO_QUIZ } from './lib/constants'
import { db, waitForAuth } from './firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore'

export default function App() {
  const [page, setPage] = useState(() => {
    // Auto-redirect to player-join if ?pin= in URL (QR code scan)
    const params = new URLSearchParams(window.location.search)
    if (params.get('pin')) return 'player-join'
    return 'landing'
  })
  const [quizzes, setQuizzes] = useState(() => {
    try {
      const saved = localStorage.getItem('qm_quizzes')
      return saved ? JSON.parse(saved) : [DEMO_QUIZ]
    } catch { return [DEMO_QUIZ] }
  })
  const [firestoreReady, setFirestoreReady] = useState(false)
  const [screenOpen, setScreenOpen] = useState(false)

  // Track if we're in the middle of a save to skip our own onSnapshot
  const isSavingRef = useRef(false)

  // Sync quizzes from Firestore on mount
  useEffect(() => {
    let unsub = null

    waitForAuth().then(userId => {
      if (!userId) return

      // Listen to the shared quizzes collection
      const q = query(collection(db, 'quizLibrary'))
      unsub = onSnapshot(q, (snap) => {
        if (snap.empty && !firestoreReady) {
          // First time: upload local quizzes to Firestore
          const localQuizzes = (() => {
            try {
              const saved = localStorage.getItem('qm_quizzes')
              return saved ? JSON.parse(saved) : [DEMO_QUIZ]
            } catch { return [DEMO_QUIZ] }
          })()
          localQuizzes.forEach(quiz => {
            const id = quiz.quizId || 'quiz-' + Date.now() + Math.random().toString(36).slice(2, 6)
            quiz.quizId = id
            setDoc(doc(db, 'quizLibrary', id), quiz).catch(e => console.warn('Upload quiz error:', e))
          })
          setFirestoreReady(true)
          return
        }

        // Skip if this snapshot was triggered by our own write
        if (isSavingRef.current) return

        const cloudQuizzes = snap.docs.map(d => ({ ...d.data(), quizId: d.id }))
        setQuizzes(cloudQuizzes)
        localStorage.setItem('qm_quizzes', JSON.stringify(cloudQuizzes))
        setFirestoreReady(true)
      }, (err) => {
        console.warn('Firestore quiz sync error:', err)
        setFirestoreReady(true)
      })
    })

    return () => { if (unsub) unsub() }
  }, [])

  // Check if this window is the screen mode (opened via ?screen=1)
  const isScreenWindow = new URLSearchParams(window.location.search).get('screen') === '1'

  const saveQuizzes = async (updatedQuizzes) => {
    setQuizzes(updatedQuizzes)
    localStorage.setItem('qm_quizzes', JSON.stringify(updatedQuizzes))

    // Sync to Firestore — block snapshots during write
    isSavingRef.current = true
    try {
      const currentIds = new Set(updatedQuizzes.map(q => q.quizId))

      for (const quiz of updatedQuizzes) {
        const id = quiz.quizId || 'quiz-' + Date.now() + Math.random().toString(36).slice(2, 6)
        quiz.quizId = id
        await setDoc(doc(db, 'quizLibrary', id), quiz)
      }

      const prevIds = quizzes.map(q => q.quizId)
      for (const oldId of prevIds) {
        if (oldId && !currentIds.has(oldId)) {
          await deleteDoc(doc(db, 'quizLibrary', oldId))
        }
      }
    } catch (e) {
      console.warn('Quiz Firestore sync error:', e)
    }
    // Re-enable snapshots after a short delay to let Firestore settle
    setTimeout(() => { isSavingRef.current = false }, 1500)
  }

  // If this is a screen window, render only ScreenMode
  if (isScreenWindow) {
    return (
      <div className="min-h-screen bg-dark-900">
        <Toaster position="top-center" toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' }
        }} />
        <ScreenMode />
      </div>
    )
  }

  const openScreenWindow = () => {
    const sid = localStorage.getItem('qm_current_session') || ''
    const screenUrl = window.location.origin + window.location.pathname + `?screen=1${sid ? '&sid=' + sid : ''}`
    const win = window.open(screenUrl, 'quizmaster-screen', 'width=1280,height=720')
    if (win) {
      win.focus()
    } else {
      setScreenOpen(true)
    }
  }

  const goLanding = () => setPage('landing')

  const pages = {
    landing:      <Landing onNavigate={setPage} />,
    'host-setup': <HostGate onBack={goLanding}><HostSetup quizzes={quizzes} onNavigate={setPage} /></HostGate>,
    'host-lobby': <HostLobby onNavigate={setPage} onOpenScreen={openScreenWindow} />,
    'host-game':  <HostGame onNavigate={setPage} onOpenScreen={openScreenWindow} />,
    'player-join': <PlayerJoin onNavigate={setPage} />,
    'player-game': <PlayerGame onNavigate={setPage} />,
    results:      <Results onNavigate={setPage} quizzes={quizzes} />,
    editor:       <HostGate onBack={goLanding}><Editor quizzes={quizzes} setQuizzes={saveQuizzes} onBack={goLanding} /></HostGate>,
    'import-export': <HostGate onBack={goLanding}><ImportExport quizzes={quizzes} setQuizzes={saveQuizzes} onBack={goLanding} /></HostGate>,
    'history': <HostGate onBack={goLanding}><GameHistory onBack={goLanding} /></HostGate>,
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" toastOptions={{
        style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' }
      }} />

      {/* Screen mode overlay (fallback if popup blocked) */}
      {screenOpen && (
        <div className="fixed inset-0 z-[1000] bg-dark-900">
          <button
            onClick={() => setScreenOpen(false)}
            className="fixed top-4 right-4 z-[1001] px-4 py-2 bg-black/50 text-white rounded-xl border border-white/10 text-sm font-medium hover:bg-black/70 transition"
          >
            ✕ Fermer l'écran
          </button>
          <ScreenMode />
        </div>
      )}

      {pages[page] || pages.landing}
    </div>
  )
}
