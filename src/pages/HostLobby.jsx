import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Card, Btn } from '../components/UI'
import MusicPlayer from '../components/MusicPlayer'
import { useStore } from '../hooks/useSession'
import { useSound } from '../hooks/useSound'
import { TEAM_COLORS, getTeamName } from '../lib/constants'

export default function HostLobby({ onNavigate, onOpenScreen }) {
  const { session, players, goQuestion, startDuel, autoAssignTeams, assignTeam, setTeamName } = useStore()
  const sfx = useSound()
  const playerList = Object.values(players)
  const playerEntries = Object.entries(players)

  if (!session) return null

  const isTeamMode = session.teamMode
  const enabledTeams = session.enabledTeams || []
  const isDuel = session.gameMode === 'duel'

  const handleLaunch = async () => {
    if (playerList.length === 0) return
    sfx.launch()
    if (isDuel) {
      await startDuel()
      onNavigate('host-game')
    } else if (session.settings?.enablePrediction) {
      // Start prediction phase before first question
      await useStore.getState().startPrediction()
      onNavigate('host-game')
    } else {
      await goQuestion(0)
      onNavigate('host-game')
    }
  }

  const siteUrl = `${window.location.origin}?pin=${session?.pin || ''}`

  // Group players by team for display
  const teamGroups = {}
  if (isTeamMode) {
    enabledTeams.forEach(tid => { teamGroups[tid] = [] })
    teamGroups['none'] = []
    playerEntries.forEach(([did, p]) => {
      if (p.team && teamGroups[p.team]) teamGroups[p.team].push({ ...p, did })
      else teamGroups['none'].push({ ...p, did })
    })
  }

  const unassignedCount = isTeamMode ? (teamGroups['none']?.length || 0) : 0

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[700px] mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-extrabold">🎮 Salle d'attente</h2>
            {session.quizNumber > 1 && (
              <div className="text-brand text-sm font-bold">🌙 Soirée — Quiz n°{session.quizNumber} : {session.quizTitle}</div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {session.displayMode !== 'online' && (
              <Btn variant="ghost" size="sm" onClick={onOpenScreen}>📺 Écran</Btn>
            )}
            {session.displayMode === 'online' && (
              <span className="text-xs text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full font-bold">🌐 En ligne</span>
            )}
          </div>
        </div>

        {/* Music Player */}
        <MusicPlayer />

        {/* PIN + QR */}
        <Card className="text-center mb-6">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
            <div className="text-slate-400 text-xs uppercase tracking-[3px] mb-2">Code PIN</div>
            <div className="text-5xl font-black font-mono tracking-[10px] text-brand mb-4 animate-glow inline-block">
              {session.pin}
            </div>
            <div className="flex justify-center mb-3">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={siteUrl} size={120} />
              </div>
            </div>
            <div className="text-slate-500 text-sm">Les joueurs scannent le QR ou entrent le code</div>
          </motion.div>
        </Card>

        {/* Team Mode Controls */}
        {isTeamMode && (
          <Card className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">👥 Équipes</h3>
              <Btn size="sm" variant="ghost" onClick={autoAssignTeams}>
                🎲 Répartition auto
              </Btn>
            </div>
            {unassignedCount > 0 && (
              <div className="text-sm text-brand mb-3">⚠️ {unassignedCount} joueur{unassignedCount > 1 ? 's' : ''} sans équipe</div>
            )}
            <div className="space-y-3">
              {enabledTeams.map(tid => {
                const tc = TEAM_COLORS.find(t => t.id === tid)
                if (!tc) return null
                const members = teamGroups[tid] || []
                return (
                  <div key={tid} className="rounded-xl border overflow-hidden" style={{ borderColor: tc.color + '30', background: tc.bg }}>
                    <div className="px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{tc.emoji}</span>
                        <input
                          value={getTeamName(tid, session)}
                          onChange={e => setTeamName(tid, e.target.value)}
                          placeholder={tc.name}
                          className="font-bold text-sm bg-transparent border-none outline-none w-36"
                          style={{ color: tc.color }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{members.length} joueur{members.length > 1 ? 's' : ''}</span>
                    </div>
                    {members.length > 0 && (
                      <div className="px-4 pb-2 flex flex-wrap gap-2">
                        {members.map(p => (
                          <span key={p.did} className="text-xs bg-white/10 rounded-lg px-2 py-1 flex items-center gap-1">
                            <span>{p.avatar}</span> <span className="font-semibold">{p.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Unassigned */}
              {teamGroups['none']?.length > 0 && (
                <div className="rounded-xl border border-dark-500 bg-dark-700 p-3">
                  <div className="text-xs text-slate-400 mb-2">Sans équipe :</div>
                  <div className="flex flex-wrap gap-2">
                    {teamGroups['none'].map(p => (
                      <div key={p.did} className="flex items-center gap-1 text-xs bg-white/5 rounded-lg px-2 py-1">
                        <span>{p.avatar}</span> <span>{p.name}</span>
                        <div className="flex gap-0.5 ml-1">
                          {enabledTeams.map(tid => {
                            const tc = TEAM_COLORS.find(t => t.id === tid)
                            return (
                              <button key={tid} onClick={() => assignTeam(p.did, tid)}
                                className="w-5 h-5 rounded-md text-[10px] flex items-center justify-center hover:scale-110 transition"
                                style={{ background: tc?.bg, border: `1px solid ${tc?.color}40` }}
                                title={tc?.name}
                              >{tc?.emoji}</button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Players (non-team mode) */}
        {!isTeamMode && (
          <Card className="mb-6">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold">Joueurs ({playerList.length})</h3>
              <span className="text-slate-400 text-sm">{session.quizTitle}</span>
            </div>
            {playerList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-3xl mb-2">⏳</div>
                En attente de joueurs...
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {playerList.map((p, i) => (
                  <motion.div key={p.playerId} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: i * 0.05 }}
                    className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2 border border-white/5"
                  >
                    <span className="text-xl">{p.avatar}</span>
                    <span className="font-semibold">{p.name}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Btn onClick={handleLaunch} disabled={playerList.length === 0} className={`w-full ${playerList.length > 0 ? 'animate-glow' : ''}`}>
          🚀 Lancer le Quiz !
        </Btn>
      </div>
    </div>
  )
}
