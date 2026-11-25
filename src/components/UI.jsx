import { motion, AnimatePresence } from 'framer-motion'
import { CHOICE_COLORS, CHOICE_SHAPES } from '../lib/constants'

// === TIMER BAR ===
export function TimerBar({ progress, isUrgent, size = 'normal' }) {
  const h = size === 'large' ? 'h-3' : size === 'small' ? 'h-1' : 'h-1.5'
  return (
    <div className={`w-full ${h} bg-white/5 rounded-full overflow-hidden`}>
      <motion.div
        className={`h-full rounded-full ${isUrgent ? 'bg-accent-red animate-timer-pulse' : 'bg-gradient-to-r from-accent-cyan to-brand'}`}
        style={{ width: `${progress * 100}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  )
}

// === CHOICE BUTTON (for players) ===
export function ChoiceButton({ index, label, selected, disabled, onClick, revealed, isCorrect, count, total }) {
  const color = CHOICE_COLORS[index] || CHOICE_COLORS[0]
  const shape = CHOICE_SHAPES[index] || '●'
  const pct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="relative w-full rounded-2xl p-5 font-bold text-lg flex items-center justify-center gap-3 transition-all duration-150 overflow-hidden"
      style={{
        border: `3px solid ${revealed ? (isCorrect ? '#10b981' : 'rgba(255,255,255,0.08)') : color + '90'}`,
        background: revealed
          ? (isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)')
          : selected ? color : color + '20',
        color: selected && !revealed ? '#fff' : '#f1f5f9',
        opacity: revealed && !isCorrect ? 0.4 : 1,
        minHeight: 80,
        cursor: disabled ? 'default' : 'pointer',
      }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      whileHover={disabled ? {} : { scale: 1.02 }}
    >
      <span style={{ color, opacity: 0.7, fontSize: '1.2rem' }}>{shape}</span>
      <span>{label}</span>
      {revealed && isCorrect && <span className="text-xl">✅</span>}
      {revealed && (
        <div className="absolute bottom-0 left-0 text-sm text-slate-400 font-semibold w-full text-center pb-1">
          {pct}% ({count})
        </div>
      )}
    </motion.button>
  )
}

// === SCOREBOARD LIST ===
export function Scoreboard({ players, compact = false }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="space-y-1">
      {players.map((p, i) => (
        <motion.div
          key={p.did}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`flex items-center justify-between ${compact ? 'py-2' : 'py-3'} ${i < players.length - 1 ? 'border-b border-white/5' : ''}`}
        >
          <div className="flex items-center gap-3">
            <span className={`w-7 font-extrabold ${i < 3 ? 'text-brand text-lg' : 'text-slate-500 text-sm'}`}>
              {i < 3 ? medals[i] : `${i + 1}.`}
            </span>
            <span className="text-xl">{p.avatar}</span>
            <span className="font-semibold">{p.name}</span>
            {p.streak >= 2 && <span className="text-xs text-brand">🔥{p.streak}</span>}
          </div>
          <span className="font-extrabold text-brand font-mono">{p.score.toLocaleString()}</span>
        </motion.div>
      ))}
    </div>
  )
}

// === PODIUM ===
export function Podium({ players }) {
  const order = [1, 0, 2]
  const heights = [280, 220, 180]
  const colors = ['#f59e0b', '#9ca3af', '#cd7f32']
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="flex items-end gap-6 justify-center">
      {order.map((rank, layoutIdx) => {
        const p = players[rank]
        if (!p) return null
        return (
          <motion.div
            key={rank}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: layoutIdx * 0.2, type: 'spring' }}
            className="text-center"
          >
            <div className="text-4xl mb-2">{p.avatar}</div>
            <div className="font-extrabold text-lg mb-1">{p.name}</div>
            <div className="font-black font-mono text-xl mb-3" style={{ color: colors[rank] }}>
              {p.score.toLocaleString()}
            </div>
            <div
              className="rounded-t-2xl flex items-start justify-center pt-5"
              style={{
                width: 'clamp(80px, 15vw, 140px)',
                height: heights[rank],
                background: `linear-gradient(180deg, ${colors[rank]}40, ${colors[rank]}10)`,
                border: `2px solid ${colors[rank]}60`,
                borderBottom: 'none',
              }}
            >
              <span className="text-4xl">{medals[rank]}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// === CONFETTI ===
export function Confetti({ show }) {
  if (!show) return null
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    color: CHOICE_COLORS[i % CHOICE_COLORS.length],
    size: 6 + Math.random() * 10,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute top-[-20px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.size > 10 ? '50%' : '2px',
            animation: `confettiFall 3s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}

// === CARD ===
export function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-dark-700 rounded-2xl border border-dark-500 p-6 shadow-xl ${className}`} {...props}>
      {children}
    </div>
  )
}

// === BUTTON ===
export function Btn({ variant = 'primary', size = 'normal', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-bold rounded-2xl transition-all duration-200 font-display cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'px-4 py-2 text-sm rounded-xl',
    normal: 'px-8 py-4 text-base',
    lg: 'px-10 py-5 text-lg',
  }
  const variants = {
    primary: 'bg-gradient-to-r from-brand to-brand-dark text-black shadow-lg shadow-brand/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/30 active:translate-y-0',
    secondary: 'bg-transparent text-accent-cyan border-2 border-accent-cyan hover:-translate-y-0.5',
    ghost: 'bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10',
    danger: 'bg-gradient-to-r from-accent-red to-red-700 text-white hover:-translate-y-0.5',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

// === TEAM SCOREBOARD ===
export function TeamScoreboard({ teams, compact = false }) {
  const medals = ['🥇', '🥈', '🥉']
  if (!teams || teams.length === 0) return null
  return (
    <div className="space-y-3">
      {teams.map((team, i) => (
        <motion.div
          key={team.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: team.color + '40', background: team.bg }}
        >
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{i < 3 ? medals[i] : team.emoji}</span>
              <div>
                <div className="font-bold" style={{ color: team.color }}>{team.name}</div>
                <div className="text-xs text-slate-400">{team.playerCount} joueur{team.playerCount > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-black text-xl font-mono" style={{ color: team.color }}>
                {team.score.toLocaleString()}
              </span>
              <div className="text-xs text-slate-400">pts/joueur</div>
            </div>
          </div>
          {!compact && team.players && team.players.length > 0 && (
            <div className="border-t px-5 py-2" style={{ borderColor: team.color + '20' }}>
              <div className="flex flex-wrap gap-2">
                {team.players.sort((a,b) => b.score - a.score).map(p => (
                  <span key={p.did} className="text-xs bg-white/5 rounded-lg px-2 py-1 flex items-center gap-1">
                    <span>{p.avatar}</span>
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-slate-400">{p.score.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// === TEAM PODIUM ===
export function TeamPodium({ teams }) {
  if (!teams || teams.length === 0) return null
  const order = [1, 0, 2]
  const heights = [260, 200, 160]
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="flex items-end gap-6 justify-center">
      {order.map((rank) => {
        const t = teams[rank]
        if (!t) return null
        return (
          <motion.div
            key={rank}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.2, type: 'spring' }}
            className="text-center"
          >
            <div className="text-4xl mb-2">{t.emoji}</div>
            <div className="font-extrabold text-lg mb-1" style={{ color: t.color }}>{t.name}</div>
            <div className="font-black font-mono text-xl mb-1" style={{ color: t.color }}>
              {t.score.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mb-3">{t.playerCount} joueur{t.playerCount > 1 ? 's' : ''} • pts/joueur</div>
            <div
              className="rounded-t-2xl flex items-start justify-center pt-5"
              style={{
                width: 'clamp(80px, 18vw, 160px)',
                height: heights[rank],
                background: `linear-gradient(180deg, ${t.color}40, ${t.color}10)`,
                border: `2px solid ${t.color}60`,
                borderBottom: 'none',
              }}
            >
              <span className="text-4xl">{medals[rank]}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// === MEDIA PLAYER (for questions with media) ===
import { useRef, useEffect, useState } from 'react'

// Extracts YouTube video ID from various URL formats
function getYouTubeId(url) {
  if (!url) return null
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ]
  // Clean URL: remove tracking params like ?si=...
  const cleanUrl = url.split('&')[0] || url
  for (const p of patterns) {
    const m = url.match(p) || cleanUrl.match(p)
    if (m) return m[1]
  }
  return null
}

// YouTube player component — uses simple iframe (most reliable across browsers)
function YouTubePlayer({ videoId, autoPlay, blindMode, startAt, endAt }) {
  const iframeRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [userStarted, setUserStarted] = useState(false)

  const params = new URLSearchParams({
    autoplay: autoPlay ? '1' : '0',
    controls: blindMode ? '0' : '1',
    start: String(startAt || 0),
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '0',
  })
  if (endAt) params.set('end', String(endAt))

  const src = `https://www.youtube.com/embed/${videoId}?${params.toString()}`

  // For blind mode, we hide the video behind the visualization overlay
  if (blindMode) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 relative">
        {/* Iframe — visually hidden behind overlay but technically visible for browser autoplay */}
        <div className="relative rounded-2xl overflow-hidden" style={{ height: 80 }}>
          {(userStarted || autoPlay) ? (
            <iframe
              ref={iframeRef}
              src={src}
              width="100%" height="80"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, opacity: 0.02, pointerEvents: 'none' }}
              onLoad={() => setPlaying(true)}
            />
          ) : null}
          {/* Solid overlay covering the iframe */}
          <div className="absolute inset-0 z-10" style={{ background: 'rgba(15,10,30,1)' }} />
        </div>
        {/* Audio visualization */}
        <div className="flex flex-col items-center justify-center py-6 rounded-2xl -mt-[80px] relative z-20" style={{ background: 'rgba(139,92,246,0.08)', border: '2px solid rgba(139,92,246,0.2)' }}>
          <div className="flex items-center gap-1 mb-3">
            {[0,1,2,3,4].map(i => (
              <motion.div key={i}
                animate={(playing || userStarted) ? { height: [12, 28 + Math.random()*20, 12] } : { height: 6 }}
                transition={(playing || userStarted) ? { repeat: Infinity, duration: 0.4 + Math.random()*0.3, delay: i*0.08 } : {}}
                className="w-2 rounded-full"
                style={{ background: `hsl(${260 + i*20}, 70%, 60%)`, height: 6 }}
              />
            ))}
          </div>
          {!userStarted && !autoPlay ? (
            <button onClick={() => setUserStarted(true)}
              className="mt-1 px-6 py-3 rounded-xl bg-accent-purple text-white font-bold text-lg animate-pulse">
              ▶ Lancer l'écoute
            </button>
          ) : (
            <div className="text-lg font-bold text-accent-purple">
              {playing ? '🎵 En écoute...' : '⏳ Chargement...'}
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  // Normal video mode — standard visible iframe
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
      <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
        <iframe
          ref={iframeRef}
          src={src}
          className="absolute inset-0 w-full h-full"
          frameBorder="0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    </motion.div>
  )
}

export function MediaPlayer({ media, autoPlay = false, hideForPlayers = false, blindMode = false, large = false }) {
  if (!media || !media.url) return null

  const ytId = getYouTubeId(media.url)

  // === YOUTUBE ===
  if (ytId) {
    if (hideForPlayers) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
          <div className="flex items-center justify-center gap-3 py-6">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
              className="text-5xl">🎵</motion.div>
            <span className="text-slate-400 font-semibold text-lg">Écoutez bien...</span>
          </div>
        </motion.div>
      )
    }
    return <YouTubePlayer
      videoId={ytId}
      autoPlay={autoPlay}
      blindMode={blindMode}
      startAt={media.startAt}
      endAt={media.endAt}
    />
  }

  // === SPOTIFY ===
  // Detect Spotify from URL (works with type "spotify", "audio", or "video")
  const spotifyMatch = media.url?.match(/open\.spotify\.com\/(?:embed\/)?(?:intl-[a-z]{2}\/)?(track|playlist|album)\/([a-zA-Z0-9]+)/)
  if (spotifyMatch) {
    const spotifyType = spotifyMatch[1]
    const spotifyId = spotifyMatch[2]
    // Always use embed URL format
    const embedUrl = `https://open.spotify.com/embed/${spotifyType}/${spotifyId}?theme=0&utm_source=generator`

    if (hideForPlayers) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
          <div className="flex items-center justify-center gap-3 py-6">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
              className="text-5xl">🎵</motion.div>
            <span className="text-slate-400 font-semibold text-lg">Écoutez bien...</span>
          </div>
        </motion.div>
      )
    }

    // Blind mode: compact player (just the bar)
    // Normal mode: show full embed with artwork
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
        {blindMode ? (
          <div>
            {/* Hidden Spotify embed (audio only) */}
            <div className="rounded-xl overflow-hidden" style={{ height: 80 }}>
              <iframe
                src={embedUrl}
                width="100%" height="80"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-xl"
              />
            </div>
            {/* Audio visualization */}
            <div className="flex items-center justify-center gap-2 mt-3">
              {[0,1,2,3,4].map(i => (
                <motion.div key={i}
                  animate={{ height: [8, 24 + Math.random()*16, 8] }}
                  transition={{ repeat: Infinity, duration: 0.4 + Math.random()*0.3, delay: i*0.08 }}
                  className="w-2 rounded-full"
                  style={{ background: `hsl(${141 + i*15}, 70%, 50%)`, height: 8 }}
                />
              ))}
              <span className="text-sm font-bold text-green-400 ml-2">Spotify</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden">
            <iframe
              src={embedUrl}
              width="100%" height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-xl"
            />
          </div>
        )}
      </motion.div>
    )
  }

  // === IMAGE ===
  if (media.type === 'image') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
        <img src={media.url} alt="" className={`w-full object-contain rounded-xl ${large ? 'max-h-[50vh]' : 'max-h-64'}`} />
      </motion.div>
    )
  }

  // === AUDIO (fichier local / URL directe MP3) ===
  if (media.type === 'audio') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        {hideForPlayers ? (
          <div className="flex items-center justify-center gap-3 py-4">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
              className="text-4xl">🎵</motion.div>
            <span className="text-slate-400 font-semibold">Écoutez bien...</span>
          </div>
        ) : (
          <audio controls autoPlay={autoPlay} src={media.url} className="w-full" style={{ height: 40 }} />
        )}
      </motion.div>
    )
  }

  // === VIDEO (fichier local / URL directe MP4) ===
  if (media.type === 'video') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        {hideForPlayers ? (
          <div className="flex items-center justify-center gap-3 py-4">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}
              className="text-4xl">🎬</motion.div>
            <span className="text-slate-400 font-semibold">Regardez l'écran...</span>
          </div>
        ) : blindMode ? (
          <BlindAudioOnly src={media.url} autoPlay={autoPlay} />
        ) : (
          <video controls autoPlay={autoPlay} src={media.url} className="w-full max-h-72 rounded-xl" />
        )}
      </motion.div>
    )
  }

  return null
}

// Blind audio for non-YouTube videos (play audio only, hide video)
function BlindAudioOnly({ src, autoPlay }) {
  const ref = useRef(null)
  const [playing, setPlaying] = useStateR(false)

  useEffect(() => {
    if (ref.current && autoPlay) {
      ref.current.play().then(() => setPlaying(true)).catch(() => {})
    }
  }, [autoPlay])

  return (
    <div className="flex flex-col items-center py-6 rounded-2xl" style={{ background: 'rgba(139,92,246,0.08)', border: '2px solid rgba(139,92,246,0.2)' }}>
      <video ref={ref} src={src} className="hidden" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <div className="flex items-center gap-1 mb-3">
        {[0,1,2,3,4].map(i => (
          <motion.div key={i}
            animate={playing ? { height: [12, 28 + Math.random()*20, 12] } : { height: 6 }}
            transition={playing ? { repeat: Infinity, duration: 0.4 + Math.random()*0.3, delay: i*0.08 } : {}}
            className="w-2 rounded-full"
            style={{ background: `hsl(${260 + i*20}, 70%, 60%)`, height: 6 }}
          />
        ))}
      </div>
      <div className="text-lg font-bold text-accent-purple">{playing ? '🎵 En écoute...' : '⏸ Prêt'}</div>
    </div>
  )
}

// === ELIMINATED BADGE ===
export function EliminatedBadge() {
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
      className="inline-flex items-center gap-1 bg-accent-red/20 text-accent-red border border-accent-red/30 rounded-full px-3 py-1 text-sm font-bold"
    >
      💀 Éliminé
    </motion.div>
  )
}

// === ALIVE COUNTER ===
export function AliveCounter({ alive, total }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-accent-green">💚 {alive}</span>
      <span className="text-slate-500">/ {total} en vie</span>
    </div>
  )
}
