import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const REACTION_EMOJIS = ['😂', '🔥', '😱', '👏', '💀', '🤯', '❤️', '😭']

// Floating reaction that flies up from bottom-center area
function FloatingReaction({ emoji, x, id }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 1, y: 0, scale: 0.5 }}
      animate={{ opacity: 0, y: -300, scale: 2 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2.5, ease: 'easeOut' }}
      className="fixed text-4xl pointer-events-none z-[999]"
      style={{ bottom: '15vh', left: x }}
    >
      {emoji}
    </motion.div>
  )
}

// Button bar for players to react
export function ReactionBar({ onReact, disabled }) {
  return (
    <div className="flex gap-1.5 justify-center py-2">
      {REACTION_EMOJIS.map(emoji => (
        <motion.button
          key={emoji}
          whileTap={{ scale: 1.4 }}
          onClick={() => onReact(emoji)}
          disabled={disabled}
          className="text-xl p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all disabled:opacity-30"
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  )
}

// Display floating reactions (for Screen Mode / all views)
export function ReactionOverlay({ reactions }) {
  return (
    <AnimatePresence>
      {(reactions || []).map(r => (
        <FloatingReaction key={r.id} emoji={r.emoji} x={r.x} id={r.id} />
      ))}
    </AnimatePresence>
  )
}

// Hook to manage reactions locally (display + auto-cleanup)
export function useReactions() {
  const [reactions, setReactions] = useState([])
  const counterRef = useRef(0)

  const addReaction = (emoji) => {
    const id = counterRef.current++
    const x = 20 + Math.random() * (window.innerWidth - 80)
    setReactions(prev => [...prev.slice(-20), { id, emoji, x }])
    // Auto-remove after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id))
    }, 2200)
  }

  return { reactions, addReaction }
}
