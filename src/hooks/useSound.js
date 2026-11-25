import { useCallback, useEffect, useState } from 'react'
import { GAME_SOUNDS } from '../lib/sounds'

const SOUND_NAMES = [
  'correct', 'wrong', 'countdown', 'tick', 'join',
  'launch', 'podium', 'buzzer', 'steal', 'timesup', 'streak',
  'intro', 'drumroll', 'lobby', 'winner'
]

const audioCache = {}

async function probeSound(name) {
  try {
    const resp = await fetch(`/sounds/${name}.mp3`, { method: 'HEAD' })
    if (resp.ok && parseInt(resp.headers.get('content-length') || '0') > 5000) {
      const audio = new Audio(`/sounds/${name}.mp3`)
      audio.preload = 'auto'
      audioCache[name] = audio
      return true
    }
  } catch {}
  audioCache[name] = null
  return false
}

export function useSound() {
  const [customSounds, setCustomSounds] = useState({})

  useEffect(() => {
    const detected = {}
    Promise.all(
      SOUND_NAMES.map(async (name) => {
        const exists = await probeSound(name)
        detected[name] = exists
      })
    ).then(() => {
      setCustomSounds(detected)
      const found = Object.entries(detected).filter(([, v]) => v).map(([k]) => k)
      if (found.length > 0) console.log('🎵 Sons MP3 détectés :', found.join(', '))
    })
  }, [])

  const play = useCallback((name, volume = 0.7) => {
    if (audioCache[name] && audioCache[name] !== null) {
      const audio = audioCache[name]
      audio.currentTime = 0
      audio.volume = volume
      audio.play().catch(() => GAME_SOUNDS[name]?.())
    } else {
      GAME_SOUNDS[name]?.()
    }
  }, [])

  // Play a sound in loop (for lobby music) — returns stop function
  const playLoop = useCallback((name, volume = 0.5) => {
    if (audioCache[name] && audioCache[name] !== null) {
      const audio = audioCache[name]
      audio.currentTime = 0
      audio.volume = volume
      audio.loop = true
      audio.play().catch(() => {})
      return () => { audio.pause(); audio.currentTime = 0; audio.loop = false }
    }
    return () => {}
  }, [])

  return {
    join:      useCallback(() => play('join'), [play]),
    correct:   useCallback(() => play('correct'), [play]),
    wrong:     useCallback(() => play('wrong'), [play]),
    launch:    useCallback(() => play('launch'), [play]),
    podium:    useCallback(() => play('podium'), [play]),
    tick:      useCallback(() => play('tick', 0.4), [play]),
    countdown: useCallback(() => play('countdown'), [play]),
    buzzer:    useCallback(() => play('buzzer'), [play]),
    steal:     useCallback(() => play('steal'), [play]),
    timesup:   useCallback(() => play('timesup'), [play]),
    streak:    useCallback(() => play('streak'), [play]),
    intro:     useCallback(() => play('intro', 0.6), [play]),
    drumroll:  useCallback(() => play('drumroll', 0.6), [play]),
    winner:    useCallback(() => play('winner', 0.7), [play]),
    playLoop,
    customSounds,
  }
}
