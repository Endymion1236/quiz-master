import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const SEGMENTS = [
  { label: 'x1', multiplier: 1, color: '#3b82f6', weight: 30 },
  { label: 'x2', multiplier: 2, color: '#10b981', weight: 30 },
  { label: 'x3', multiplier: 3, color: '#f59e0b', weight: 20 },
  { label: 'x4', multiplier: 4, color: '#ef4444', weight: 12 },
  { label: 'x5', multiplier: 5, color: '#a855f7', weight: 8 },
]

// Weighted random pick
function pickSegment() {
  const total = SEGMENTS.reduce((s, seg) => s + seg.weight, 0)
  let r = Math.random() * total
  for (const seg of SEGMENTS) {
    r -= seg.weight
    if (r <= 0) return seg
  }
  return SEGMENTS[0]
}

export default function BonusWheel({ onResult, autoSpin = true }) {
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    if (autoSpin && !spinning && !result) {
      spin()
    }
  }, [autoSpin])

  const spin = () => {
    if (spinning) return
    setSpinning(true)
    setResult(null)

    const picked = pickSegment()
    const segIdx = SEGMENTS.indexOf(picked)
    const segAngle = 360 / SEGMENTS.length
    // Land on this segment (center of it)
    const targetAngle = 360 * 5 + (360 - segIdx * segAngle - segAngle / 2)

    setRotation(prev => prev + targetAngle)

    setTimeout(() => {
      setSpinning(false)
      setResult(picked)
      if (onResult) onResult(picked.multiplier)
    }, 3500)
  }

  return (
    <div className="flex flex-col items-center">
      {/* Wheel */}
      <div className="relative w-48 h-48 mb-4">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 text-2xl">▼</div>

        {/* Spinning wheel */}
        <motion.div
          animate={{ rotate: rotation }}
          transition={{ duration: 3.5, ease: [0.17, 0.67, 0.12, 0.99] }}
          className="w-full h-full rounded-full overflow-hidden border-4 border-white/20 relative"
          style={{ background: '#111' }}
        >
          {SEGMENTS.map((seg, i) => {
            const angle = (360 / SEGMENTS.length) * i
            return (
              <div
                key={i}
                className="absolute w-full h-full"
                style={{
                  transform: `rotate(${angle}deg)`,
                  clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.tan(Math.PI / SEGMENTS.length)}% 0%)`,
                }}
              >
                <div className="w-full h-full" style={{ background: seg.color }} />
                <div
                  className="absolute font-black text-white text-sm"
                  style={{
                    top: '18%',
                    left: '50%',
                    transform: `translateX(-50%) rotate(${360 / SEGMENTS.length / 2}deg)`,
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}
                >
                  {seg.label}
                </div>
              </div>
            )
          })}
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white/90 border-2 border-white shadow-lg flex items-center justify-center text-sm">
              🎲
            </div>
          </div>
        </motion.div>
      </div>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 8 }}
          className="text-center"
        >
          <div className="text-4xl font-black mb-1" style={{ color: result.color }}>
            {result.label}
          </div>
          <div className="text-slate-400 text-sm">Points multipliés !</div>
        </motion.div>
      )}

      {spinning && (
        <div className="text-slate-400 text-sm animate-pulse">🎲 La roue tourne...</div>
      )}
    </div>
  )
}
