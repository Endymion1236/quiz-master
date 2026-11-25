import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS = [
  { text: '3', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', scale: 1 },
  { text: '2', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', scale: 1.1 },
  { text: '1', color: '#10b981', bg: 'rgba(16,185,129,0.15)', scale: 1.2 },
  { text: 'GO!', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', scale: 1.5 },
]

export default function Countdown({ questionText, questionType }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step < STEPS.length - 1) {
      const timer = setTimeout(() => setStep(s => s + 1), 900)
      return () => clearTimeout(timer)
    }
  }, [step])

  const current = STEPS[step]

  return (
    <div className="screen-bg-question min-h-screen flex flex-col items-center justify-center p-10 overflow-hidden">
      {/* Background pulse */}
      <motion.div
        key={step}
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute rounded-full w-40 h-40"
        style={{ background: current.bg }}
      />

      {/* Number/GO */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={step}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: current.scale, opacity: 1 }}
          exit={{ scale: 3, opacity: 0 }}
          transition={{
            enter: { type: 'spring', damping: 10, stiffness: 200 },
            exit: { duration: 0.3 },
          }}
          className="relative z-10 absolute"
        >
          <div
            className="font-black leading-none"
            style={{
              fontSize: step === 3 ? 'clamp(6rem, 15vw, 12rem)' : 'clamp(8rem, 20vw, 16rem)',
              color: current.color,
              textShadow: `0 0 60px ${current.color}40, 0 0 120px ${current.color}20`,
            }}
          >
            {current.text}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Question preview (shows from step 1) */}
      {step >= 1 && questionText && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 0.6, y: 0 }}
          className="absolute bottom-20 text-center px-10 max-w-[800px]"
        >
          <div className="text-slate-500 text-sm uppercase tracking-wider mb-2">{questionType}</div>
          <div className="text-slate-400 text-lg font-semibold">{questionText}</div>
        </motion.div>
      )}
    </div>
  )
}
