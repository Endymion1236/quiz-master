import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const TRANSITIONS = [
  {
    name: 'spotlight',
    render: (qNum, total, category) => (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Sweeping beams */}
        {[0,1,2].map(i => (
          <motion.div key={i}
            initial={{ rotate: -30 + i * 30, opacity: 0 }}
            animate={{ rotate: 30 + i * 30, opacity: [0, 0.4, 0] }}
            transition={{ duration: 1.2, delay: i * 0.15 }}
            className="absolute"
            style={{
              top: '-30%', left: '50%', width: '4px', height: '160%',
              background: `linear-gradient(180deg, ${['#f59e0b','#8b5cf6','#06b6d4'][i]}, transparent)`,
              filter: 'blur(20px)', transformOrigin: 'top center',
            }}
          />
        ))}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center relative z-10"
        >
          <div className="text-[clamp(4rem,10vw,8rem)] font-black bg-gradient-to-r from-amber-400 to-brand bg-clip-text text-transparent">
            {qNum}
          </div>
          <motion.div initial={{ width: 0 }} animate={{ width: '100%' }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="h-1 bg-gradient-to-r from-transparent via-brand to-transparent mx-auto"
          />
          {category && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-slate-400 text-lg mt-2 font-semibold"
            >
              📂 {category}
            </motion.div>
          )}
        </motion.div>
      </div>
    )
  },
  {
    name: 'zoom',
    render: (qNum, total, category) => (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Pulsing rings */}
        {[0,1,2].map(i => (
          <motion.div key={i}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 1.5, delay: i * 0.2 }}
            className="absolute rounded-full border-2 border-brand/40"
            style={{ width: 100, height: 100 }}
          />
        ))}
        <motion.div
          initial={{ scale: 5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 12, delay: 0.1 }}
          className="text-center relative z-10"
        >
          <div className="text-slate-500 text-sm font-bold tracking-widest uppercase mb-2">QUESTION</div>
          <div className="text-[clamp(5rem,12vw,10rem)] font-black text-brand leading-none">
            {qNum}
          </div>
          <div className="text-slate-500 text-sm mt-1">/ {total}</div>
          {category && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-amber-400 text-lg mt-3 font-bold"
            >
              {category}
            </motion.div>
          )}
        </motion.div>
      </div>
    )
  },
  {
    name: 'slide',
    render: (qNum, total, category) => (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Background bar */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute w-full h-32 bg-brand/10"
          style={{ originX: 0 }}
        />
        <motion.div
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 0.2 }}
          className="text-center relative z-10"
        >
          <div className="flex items-center gap-4 justify-center">
            <div className="text-[clamp(4rem,10vw,8rem)] font-black text-brand">{qNum}</div>
            <div>
              <div className="text-left text-slate-500 text-xs font-bold tracking-widest uppercase">QUESTION</div>
              <div className="text-left text-slate-400 text-sm">sur {total}</div>
              {category && <div className="text-left text-amber-400 text-sm font-bold mt-1">📂 {category}</div>}
            </div>
          </div>
        </motion.div>
        {/* Progress bar */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: qNum / total }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="absolute bottom-12 left-[10%] right-[10%] h-2 rounded-full bg-brand/30"
          style={{ originX: 0 }}
        >
          <div className="h-full rounded-full bg-brand" style={{ width: '100%' }} />
        </motion.div>
      </div>
    )
  }
]

export default function TVTransition({ questionNumber, totalQuestions, category, onComplete }) {
  const [visible, setVisible] = useState(true)
  const variant = TRANSITIONS[questionNumber % TRANSITIONS.length]

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      if (onComplete) onComplete()
    }, 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(2,6,23,0.95)' }}
        >
          {variant.render(questionNumber, totalQuestions, category)}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
