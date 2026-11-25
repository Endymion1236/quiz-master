import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Btn } from './UI'

// Extract YouTube video ID
function getYouTubeId(url) {
  if (!url) return null
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// Extract Spotify embed ID
function getSpotifyEmbed(url) {
  if (!url) return null
  // https://open.spotify.com/track/xxxx or /playlist/xxxx or /album/xxxx
  const m = url.match(/open\.spotify\.com\/(?:embed\/)?(?:intl-[a-z]{2}\/)?(track|playlist|album)\/([a-zA-Z0-9]+)/)
  if (m) return { type: m[1], id: m[2] }
  return null
}

// Preset playlists
const PRESETS = [
  { label: '🎉 Ambiance Soirée', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', desc: 'YouTube Mix' },
  { label: '🎵 Attente Chill', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A', desc: 'Lo-fi beats' },
  { label: '⚡ Énergie', url: 'https://www.youtube.com/watch?v=gCYcHz2k5x0', desc: 'Martin Garrix' },
  { label: '🏇 Western', url: 'https://www.youtube.com/watch?v=AFa1-kciCb4', desc: 'Country Music' },
]

export default function MusicPlayer({ compact = false }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(30)
  const [currentUrl, setCurrentUrl] = useState(null)
  const iframeRef = useRef(null)

  const ytId = getYouTubeId(currentUrl)
  const spotify = getSpotifyEmbed(currentUrl)

  const play = (musicUrl) => {
    setCurrentUrl(musicUrl)
    setPlaying(true)
  }

  const stop = () => {
    setCurrentUrl(null)
    setPlaying(false)
  }

  // Compact toggle button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${playing
          ? 'bg-accent-purple/15 border border-accent-purple/30 text-accent-purple'
          : 'bg-white/5 border border-dark-500 text-slate-400 hover:bg-white/10'}`}
      >
        <motion.span animate={playing ? { scale: [1, 1.2, 1] } : {}} transition={playing ? { repeat: Infinity, duration: 0.6 } : {}}>
          {playing ? '🎵' : '🔇'}
        </motion.span>
        {!compact && <span className="text-sm font-semibold">{playing ? 'Musique ♪' : 'Musique'}</span>}
      </button>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className="bg-dark-700 border border-dark-500 rounded-2xl p-4 mb-4"
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎵</span>
            <span className="font-bold text-sm">Musique d'ambiance</span>
          </div>
          <div className="flex gap-2">
            {playing && (
              <button onClick={stop} className="text-accent-red text-xs font-bold hover:bg-accent-red/10 rounded-lg px-2 py-1">
                ⏹ Stop
              </button>
            )}
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
          </div>
        </div>

        {/* URL input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Coller un lien YouTube ou Spotify..."
            className="flex-1 bg-white/5 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <button
            onClick={() => { if (url.trim()) { play(url.trim()); setUrl('') } }}
            disabled={!url.trim()}
            className="px-4 py-2 bg-brand/20 text-brand rounded-lg font-bold text-sm hover:bg-brand/30 disabled:opacity-30 transition"
          >
            ▶️
          </button>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p, i) => (
            <button key={i} onClick={() => play(p.url)}
              className="text-xs bg-white/5 hover:bg-white/10 border border-dark-500 rounded-lg px-3 py-1.5 transition"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Volume */}
        {playing && (
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-slate-400">🔊</span>
            <input
              type="range" min="0" max="100" value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="flex-1 accent-brand h-1"
            />
            <span className="text-xs text-slate-400 w-8 text-right">{volume}%</span>
          </div>
        )}

        {/* Hidden YouTube player */}
        {playing && ytId && (
          <div className="relative rounded-xl overflow-hidden bg-black/30" style={{ height: 50 }}>
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&playlist=${ytId}&controls=1&rel=0&modestbranding=1`}
              className="absolute inset-0 w-full"
              style={{ height: 50 }}
              allow="autoplay; encrypted-media"
              frameBorder="0"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-1">
                {[0,1,2,3,4].map(i => (
                  <motion.div key={i}
                    animate={{ height: [4, 16 + Math.random()*8, 4] }}
                    transition={{ repeat: Infinity, duration: 0.4 + Math.random()*0.3, delay: i*0.08 }}
                    className="w-1.5 rounded-full bg-accent-purple"
                    style={{ height: 4 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Spotify embed */}
        {playing && spotify && (
          <div className="rounded-xl overflow-hidden">
            <iframe
              src={`https://open.spotify.com/embed/${spotify.type}/${spotify.id}?theme=0`}
              width="100%" height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="rounded-xl"
            />
          </div>
        )}

        {/* Playing indicator */}
        {playing && !ytId && !spotify && (
          <div className="text-center py-2">
            <span className="text-xs text-slate-400">Format non reconnu — collez un lien YouTube ou Spotify</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
