import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Full-screen TV show intro sequence (5-6 seconds)
export default function TVIntro({ quizTitle, onComplete }) {
  const [phase, setPhase] = useState(0) // 0=dark, 1=lights, 2=title, 3=subtitle, 4=done

  useEffect(() => {
    // Play intro jingle if available
    try {
      const jingle = new Audio('/sounds/intro.mp3')
      jingle.volume = 0.7
      jingle.play().catch(() => {}) // Ignore if autoplay blocked
    } catch (e) {}

    const timers = [
      setTimeout(() => setPhase(1), 200),    // Lights on
      setTimeout(() => setPhase(2), 1200),    // Title appears
      setTimeout(() => setPhase(3), 2800),    // Subtitle
      setTimeout(() => setPhase(4), 4500),    // Fade out
      setTimeout(() => onComplete?.(), 5500), // Done
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <AnimatePresence>
      {phase < 4 && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: '#000' }}
        >
          {/* Scanning light beams */}
          {phase >= 1 && (
            <>
              {[0, 1, 2, 3, 4].map(i => (
                <motion.div
                  key={`beam-${i}`}
                  initial={{ opacity: 0, rotate: -30 + i * 15 }}
                  animate={{
                    opacity: [0, 0.3, 0.1, 0.3, 0],
                    rotate: [-30 + i * 15, -20 + i * 15, -30 + i * 15],
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                  className="absolute"
                  style={{
                    top: '-20%',
                    left: `${10 + i * 20}%`,
                    width: '4px',
                    height: '140%',
                    background: `linear-gradient(180deg, ${
                      ['rgba(99,102,241,0.8)', 'rgba(236,72,153,0.6)', 'rgba(6,182,212,0.7)', 'rgba(245,158,11,0.5)', 'rgba(99,102,241,0.6)'][i]
                    }, transparent)`,
                    filter: 'blur(20px)',
                    transformOrigin: 'top center',
                  }}
                />
              ))}
            </>
          )}

          {/* Circular pulse rings */}
          {phase >= 1 && (
            <>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={`ring-${i}`}
                  initial={{ scale: 0, opacity: 0.6 }}
                  animate={{ scale: [0, 3], opacity: [0.4, 0] }}
                  transition={{ duration: 2, delay: 0.5 + i * 0.4, repeat: Infinity }}
                  className="absolute rounded-full border-2"
                  style={{
                    width: '200px',
                    height: '200px',
                    borderColor: 'rgba(99,102,241,0.3)',
                  }}
                />
              ))}
            </>
          )}

          {/* Background flash */}
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3), transparent)' }}
            />
          )}

          {/* QUIZ MASTER title */}
          {phase >= 2 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 8, stiffness: 100 }}
              className="relative z-10 text-center"
            >
              {/* Glowing background behind text */}
              <div className="absolute inset-0 blur-3xl"
                style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)' }}
              />

              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative"
              >
                <h1 className="text-[clamp(4rem,12vw,10rem)] font-black leading-none tracking-tighter">
                  <span className="bg-gradient-to-r from-brand via-accent-pink to-accent-cyan bg-clip-text text-transparent"
                    style={{ textShadow: '0 0 80px rgba(99,102,241,0.5)' }}>
                    QUIZ
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-accent-cyan via-brand to-accent-pink bg-clip-text text-transparent"
                    style={{ textShadow: '0 0 80px rgba(236,72,153,0.5)' }}>
                    MASTER
                  </span>
                </h1>
              </motion.div>

              {/* Decorative lines */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="h-[2px] w-24 bg-gradient-to-r from-transparent to-brand"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="text-2xl"
                >⚡</motion.div>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="h-[2px] w-24 bg-gradient-to-l from-transparent to-accent-pink"
                />
              </div>
            </motion.div>
          )}

          {/* Quiz title subtitle */}
          {phase >= 3 && quizTitle && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative z-10 mt-8"
            >
              <div className="text-[clamp(1.2rem,3vw,2rem)] font-bold text-slate-300">
                {quizTitle}
              </div>
            </motion.div>
          )}

          {/* Bottom bar animation */}
          {phase >= 1 && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 3, ease: 'easeInOut' }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand via-accent-pink to-accent-cyan origin-left"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
