import { useState, useEffect, useRef } from 'react'
import { serverNow } from '../firebase'

export function useTimer(startTimestamp, totalSeconds, isActive) {
  const [timeLeft, setTimeLeft] = useState(totalSeconds)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isActive || !startTimestamp || !totalSeconds) {
      setTimeLeft(totalSeconds || 0)
      return
    }

    const update = () => {
      const elapsed = (serverNow() - startTimestamp) / 1000
      const remaining = Math.max(0, totalSeconds - elapsed)
      setTimeLeft(remaining)
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    update()
    intervalRef.current = setInterval(update, 200)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startTimestamp, totalSeconds, isActive])

  return {
    timeLeft: Math.ceil(timeLeft),
    timeLeftRaw: timeLeft,
    isExpired: timeLeft <= 0,
    isUrgent: timeLeft <= 5 && timeLeft > 0,
    progress: totalSeconds > 0 ? timeLeft / totalSeconds : 0,
  }
}
