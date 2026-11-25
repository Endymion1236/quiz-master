import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, Btn } from '../components/UI'
import { db } from '../firebase'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'

export default function GameHistory({ onBack }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const q = query(collection(db, 'gameHistory'), orderBy('date', 'desc'), limit(50))
      const snap = await getDocs(q)
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setGames(items)
    } catch (e) {
      console.error('History load error:', e)
    }
    setLoading(false)
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const modeLabel = (g) => {
    const parts = []
    if (g.gameMode === 'suddenDeath') parts.push('💀 Mort subite')
    if (g.teamMode) parts.push('👥 Équipes')
    return parts.length ? parts.join(' · ') : '🎮 Normal'
  }

  return (
    <div className="min-h-screen p-4 max-w-[600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-brand">📋 Historique</h1>
        <Btn variant="ghost" size="sm" onClick={onBack}>← Retour</Btn>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">Chargement...</div>
      ) : games.length === 0 ? (
        <Card className="text-center py-8">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-slate-400">Aucune partie jouée pour l'instant</div>
          <div className="text-slate-500 text-sm mt-1">Les résultats apparaîtront ici après chaque quiz</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {games.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="cursor-pointer hover:border-brand/30 transition-all" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-lg">{g.quizTitle}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{formatDate(g.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">{modeLabel(g)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{g.playerCount} joueur{g.playerCount > 1 ? 's' : ''} · {g.questionCount} Q</div>
                  </div>
                </div>

                {/* Podium mini */}
                {g.podium && g.podium.length > 0 && (
                  <div className="flex items-center gap-3 mt-3">
                    {g.podium.map((p, pi) => (
                      <div key={pi} className="flex items-center gap-1.5">
                        <span className="text-sm">{['🥇','🥈','🥉'][pi]}</span>
                        <span className="text-lg">{p.avatar}</span>
                        <span className="text-sm font-semibold">{p.name}</span>
                        <span className="text-xs text-slate-500 font-mono">{p.score?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expanded: full scores */}
                {expanded === g.id && g.allScores && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    className="mt-4 pt-3 border-t border-white/10">
                    <div className="text-xs text-slate-500 font-semibold mb-2">Classement complet</div>
                    {g.allScores.map((p, si) => (
                      <div key={si} className="flex items-center justify-between py-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-5 text-right font-mono text-xs">{si + 1}.</span>
                          <span>{p.avatar}</span>
                          <span className="font-semibold">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400">{p.correct || 0}/{p.total || 0} ✓</span>
                          <span className="font-bold text-brand font-mono">{p.score?.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
