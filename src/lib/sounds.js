// ============================================
// 🎵 SYNTHÈSE AUDIO HAUTE QUALITÉ
// Sons de jeu TV générés via Web Audio API
// Pas besoin de fichiers MP3 !
// ============================================

let audioCtx = null
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Helper: play a tone with envelope
function playTone(freq, duration, type = 'sine', volume = 0.3, attack = 0.01, decay = duration) {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

// Helper: play noise burst (for cymbal, applause effects)
function playNoise(duration, volume = 0.1, filter = null) {
  const ctx = getCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1)

  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  if (filter) {
    const flt = ctx.createBiquadFilter()
    flt.type = filter.type || 'highpass'
    flt.frequency.value = filter.freq || 3000
    source.connect(flt)
    flt.connect(gain)
  } else {
    source.connect(gain)
  }
  gain.connect(ctx.destination)
  source.start()
}

// Helper: play a sequence of tones
function playMelody(notes, baseVolume = 0.25) {
  notes.forEach(([freq, start, dur, type = 'sine', vol = baseVolume]) => {
    setTimeout(() => playTone(freq, dur, type, vol, 0.005, dur * 0.9), start * 1000)
  })
}


// ==============================
// 🎮 GAME SOUNDS (useSound)
// ==============================

export const GAME_SOUNDS = {
  // ✅ Bonne réponse — joyful ascending arpeggio
  correct: () => {
    playMelody([
      [523, 0, 0.12],     // C5
      [659, 0.08, 0.12],  // E5
      [784, 0.16, 0.12],  // G5
      [1047, 0.24, 0.25], // C6
    ], 0.3)
    setTimeout(() => playNoise(0.15, 0.04, { type: 'highpass', freq: 6000 }), 250) // shimmer
  },

  // ❌ Mauvaise réponse — descending buzzer
  wrong: () => {
    playTone(400, 0.4, 'sawtooth', 0.15, 0.01, 0.35)
    playTone(300, 0.5, 'sawtooth', 0.12, 0.05, 0.45)
    setTimeout(() => playTone(200, 0.4, 'square', 0.08), 100)
  },

  // 🚀 Quiz lance — dramatic ascending fanfare
  launch: () => {
    playMelody([
      [330, 0, 0.15, 'square', 0.2],    // E4
      [392, 0.1, 0.15, 'square', 0.2],  // G4
      [494, 0.2, 0.15, 'square', 0.22], // B4
      [659, 0.3, 0.2, 'sine', 0.25],    // E5
      [784, 0.45, 0.15, 'sine', 0.2],   // G5
      [988, 0.55, 0.35, 'sine', 0.3],   // B5
    ])
    setTimeout(() => playNoise(0.3, 0.06, { type: 'highpass', freq: 4000 }), 550) // cymbal crash
  },

  // 👤 Joueur rejoint — friendly ping
  join: () => {
    playTone(880, 0.15, 'sine', 0.15, 0.005)
    setTimeout(() => playTone(1100, 0.12, 'sine', 0.12), 80)
  },

  // 🏆 Podium / résultats — triumphant fanfare
  podium: () => {
    playMelody([
      [392, 0, 0.2, 'sine', 0.25],       // G4
      [494, 0.15, 0.2, 'sine', 0.25],    // B4
      [587, 0.3, 0.2, 'sine', 0.25],     // D5
      [784, 0.45, 0.35, 'sine', 0.3],    // G5
      [988, 0.7, 0.15, 'sine', 0.2],     // B5
      [784, 0.85, 0.5, 'sine', 0.3],     // G5
    ])
    setTimeout(() => playNoise(0.4, 0.05, { type: 'highpass', freq: 5000 }), 450)
    setTimeout(() => playNoise(0.5, 0.04, { type: 'highpass', freq: 4000 }), 800)
  },

  // 🔔 Buzzer — sharp TV buzz
  buzzer: () => {
    playTone(880, 0.08, 'square', 0.35, 0.002)
    setTimeout(() => playTone(660, 0.12, 'square', 0.25), 50)
    setTimeout(() => playTone(880, 0.06, 'square', 0.2), 120)
  },

  // 3-2-1 countdown beep
  countdown: () => {
    playTone(800, 0.1, 'square', 0.2, 0.002, 0.08)
  },

  // Click/tick
  tick: () => {
    playTone(1200, 0.04, 'sine', 0.1, 0.002)
  },

  // ⏰ Temps écoulé — urgent alarm
  timesup: () => {
    playTone(500, 0.15, 'square', 0.2)
    setTimeout(() => playTone(400, 0.15, 'square', 0.2), 150)
    setTimeout(() => playTone(300, 0.25, 'square', 0.15), 300)
  },

  // 🔥 Série de bonnes réponses — ascending sparkle
  streak: () => {
    playMelody([
      [600, 0, 0.08, 'sine', 0.15],
      [800, 0.06, 0.08, 'sine', 0.18],
      [1000, 0.12, 0.08, 'sine', 0.2],
      [1200, 0.18, 0.15, 'sine', 0.22],
    ])
  },

  // 🏴‍☠️ Vol de points — dramatic descending
  steal: () => {
    playTone(600, 0.15, 'sawtooth', 0.15)
    setTimeout(() => playTone(400, 0.15, 'sawtooth', 0.12), 120)
    setTimeout(() => playTone(250, 0.3, 'sawtooth', 0.1), 240)
    setTimeout(() => playNoise(0.2, 0.05, { type: 'lowpass', freq: 1000 }), 200)
  },
}


// ==============================
// 🔊 SOUNDBOARD SOUNDS
// ==============================

export const SOUNDBOARD_SOUNDS = {
  // 👏 Applaudissements — layered noise with resonance
  applause: () => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => playNoise(1.5 - i * 0.15, 0.08 - i * 0.01, { type: 'bandpass', freq: 2000 + Math.random() * 2000 }), i * 100)
    }
  },

  // 🥁 Suspense / Roulement de tambour
  drumroll: () => {
    const ctx = getCtx()
    const duration = 3
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate
      // Increasing intensity drum roll
      const intensity = Math.min(t / 2, 1) * 0.3
      const freq = 12 + t * 8 // Accelerating rolls
      const roll = Math.sin(t * Math.PI * 2 * freq) > 0 ? 1 : -1
      data[i] = (Math.random() * 2 - 1) * intensity * (0.3 + roll * 0.7)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = 0.4
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 800
    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()
  },

  // 😵 Fail — sad trombone
  fail: () => {
    playMelody([
      [392, 0, 0.3, 'sine', 0.2],     // G4
      [370, 0.3, 0.3, 'sine', 0.2],   // F#4
      [349, 0.6, 0.3, 'sine', 0.2],   // F4
      [233, 0.9, 0.8, 'sine', 0.25],  // Bb3
    ])
  },

  // 🎉 Tada — triumphant brass
  tada: () => {
    playMelody([
      [523, 0, 0.1, 'square', 0.2],     // C5
      [659, 0.08, 0.1, 'square', 0.2],  // E5
      [784, 0.16, 0.15, 'square', 0.22],// G5
      [1047, 0.28, 0.4, 'sine', 0.3],   // C6
    ])
    setTimeout(() => playNoise(0.4, 0.06, { type: 'highpass', freq: 5000 }), 280) // cymbal
  },

  // ❌ Buzzer erreur — harsh error buzz
  wrongBuzz: () => {
    playTone(150, 0.6, 'sawtooth', 0.2, 0.01, 0.5)
    playTone(148, 0.6, 'square', 0.1, 0.01, 0.5)
  },

  // ⏰ Tic-tac — clock ticking
  ticking: () => {
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        playTone(i % 2 === 0 ? 1800 : 1400, 0.04, 'sine', 0.12, 0.002)
      }, i * 500)
    }
  },

  // 😂 Rires — pitched noise bursts
  laugh: () => {
    const pitches = [400, 500, 450, 520, 380, 480]
    pitches.forEach((f, i) => {
      setTimeout(() => {
        playTone(f, 0.08, 'sine', 0.15)
        playNoise(0.06, 0.03, { type: 'bandpass', freq: f * 3 })
      }, i * 120)
    })
  },

  // 😮 Woooow — ascending slide
  wow: () => {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.8)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.2)
  },
}


// ==============================
// 🥁 CEREMONY SOUNDS
// ==============================

export const CEREMONY_SOUNDS = {
  // Drum roll for Oscars ceremony
  drumroll: () => SOUNDBOARD_SOUNDS.drumroll(),

  // Envelope opening sound
  envelope: () => {
    playNoise(0.3, 0.06, { type: 'highpass', freq: 3000 })
    setTimeout(() => playTone(600, 0.15, 'sine', 0.1), 150)
  },

  // Place reveal (3rd, 2nd)
  placeReveal: () => {
    playMelody([
      [440, 0, 0.15, 'sine', 0.2],
      [554, 0.1, 0.15, 'sine', 0.22],
      [659, 0.2, 0.25, 'sine', 0.25],
    ])
  },

  // WINNER reveal — big fanfare
  winnerReveal: () => {
    playMelody([
      [392, 0, 0.15, 'square', 0.25],
      [494, 0.12, 0.15, 'square', 0.25],
      [587, 0.24, 0.15, 'square', 0.25],
      [784, 0.36, 0.3, 'sine', 0.35],
      [988, 0.6, 0.15, 'sine', 0.25],
      [1175, 0.75, 0.15, 'sine', 0.2],
      [784, 0.9, 0.6, 'sine', 0.35],
    ])
    // Cymbal crashes
    setTimeout(() => playNoise(0.5, 0.08, { type: 'highpass', freq: 4000 }), 360)
    setTimeout(() => playNoise(0.6, 0.07, { type: 'highpass', freq: 5000 }), 750)
    // Low rumble
    setTimeout(() => playTone(80, 0.8, 'sine', 0.15, 0.01, 0.7), 360)
  },
}
