import React from 'react'
import { motion } from 'framer-motion'
import { TEAM_COLORS } from '../lib/constants'

// Generate bracket from player list
export function generateBracket(playerList) {
  // Shuffle players
  const shuffled = [...playerList].sort(() => Math.random() - 0.5)
  
  // Pad to nearest power of 2
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(shuffled.length, 2))))
  
  const matches = []
  for (let i = 0; i < size; i += 2) {
    const p1 = shuffled[i] || null
    const p2 = shuffled[i + 1] || null
    matches.push({
      matchId: `r0-m${matches.length}`,
      round: 0,
      p1: p1 ? { did: p1.did, name: p1.name, avatar: p1.avatar } : null,
      p2: p2 ? { did: p2.did, name: p2.name, avatar: p2.avatar } : null,
      p1Score: 0,
      p2Score: 0,
      winner: p2 ? null : (p1 ? p1.did : null), // Auto-win if bye
      status: p2 ? 'pending' : 'done',
    })
  }
  
  // Build empty future rounds
  const totalRounds = Math.log2(size)
  let prevRoundMatches = matches.length
  for (let r = 1; r < totalRounds; r++) {
    const roundMatches = prevRoundMatches / 2
    for (let m = 0; m < roundMatches; m++) {
      matches.push({
        matchId: `r${r}-m${m}`,
        round: r,
        p1: null,
        p2: null,
        p1Score: 0,
        p2Score: 0,
        winner: null,
        status: 'waiting', // waiting for previous round
      })
    }
    prevRoundMatches = roundMatches
  }
  
  return { matches, totalRounds, currentRound: 0, questionsPerDuel: 3 }
}

// Get round label
function getRoundLabel(round, totalRounds) {
  const remaining = totalRounds - round
  if (remaining === 1) return '🏆 Finale'
  if (remaining === 2) return '⚔️ Demi-finales'
  if (remaining === 3) return '🎯 Quarts de finale'
  return `Tour ${round + 1}`
}

// Bracket display for ScreenMode / Host
export function BracketView({ bracket, players, currentMatch, compact = false }) {
  if (!bracket?.matches) return null
  
  const { matches, totalRounds } = bracket
  const rounds = []
  for (let r = 0; r < totalRounds; r++) {
    rounds.push(matches.filter(m => m.round === r))
  }
  
  const getPlayer = (p) => {
    if (!p) return { name: '...', avatar: '❓' }
    const full = players?.[p.did]
    return { name: full?.name || p.name || '?', avatar: full?.avatar || p.avatar || '❓', did: p.did }
  }

  return (
    <div className={`flex gap-4 ${compact ? 'overflow-x-auto' : 'overflow-x-auto'} items-center`}>
      {rounds.map((roundMatches, ri) => (
        <div key={ri} className="flex-shrink-0 flex flex-col gap-3 items-center">
          <div className="text-xs font-bold text-slate-400 mb-1">{getRoundLabel(ri, totalRounds)}</div>
          <div className="flex flex-col gap-4" style={{ justifyContent: 'space-around', minHeight: roundMatches.length > 1 ? roundMatches.length * 80 : 80 }}>
            {roundMatches.map((match) => {
              const p1 = getPlayer(match.p1)
              const p2 = getPlayer(match.p2)
              const isActive = currentMatch === match.matchId
              const isDone = match.status === 'done'
              
              return (
                <motion.div
                  key={match.matchId}
                  animate={isActive ? { boxShadow: '0 0 20px rgba(245,158,11,0.4)' } : {}}
                  className={`rounded-xl border-2 overflow-hidden ${compact ? 'w-[140px]' : 'w-[180px]'} ${
                    isActive ? 'border-brand bg-brand/10' : isDone ? 'border-white/10 bg-white/5' : 'border-dark-500 bg-dark-700/50'
                  }`}
                >
                  {/* Player 1 */}
                  <div className={`flex items-center justify-between px-2 py-1.5 ${match.winner === p1.did ? 'bg-accent-green/10' : ''}`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={compact ? 'text-sm' : ''}>{p1.avatar}</span>
                      <span className={`font-semibold truncate ${compact ? 'text-xs max-w-[60px]' : 'text-sm max-w-[90px]'} ${match.winner === p1.did ? 'text-accent-green' : ''}`}>
                        {p1.name}
                      </span>
                    </div>
                    <span className={`font-mono font-bold ${compact ? 'text-xs' : 'text-sm'} ${match.winner === p1.did ? 'text-accent-green' : 'text-slate-400'}`}>
                      {match.p1Score}
                    </span>
                  </div>
                  <div className="border-t border-white/5" />
                  {/* Player 2 */}
                  <div className={`flex items-center justify-between px-2 py-1.5 ${match.winner === p2.did ? 'bg-accent-green/10' : ''}`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={compact ? 'text-sm' : ''}>{p2.avatar}</span>
                      <span className={`font-semibold truncate ${compact ? 'text-xs max-w-[60px]' : 'text-sm max-w-[90px]'} ${match.winner === p2.did ? 'text-accent-green' : ''}`}>
                        {p2.name}
                      </span>
                    </div>
                    <span className={`font-mono font-bold ${compact ? 'text-xs' : 'text-sm'} ${match.winner === p2.did ? 'text-accent-green' : 'text-slate-400'}`}>
                      {match.p2Score}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Current duel display (big, for ScreenMode during a match)
export function DuelMatchScreen({ match, players, questionNum, totalQuestions }) {
  if (!match) return null
  
  const getP = (p) => {
    if (!p) return { name: '?', avatar: '❓' }
    const full = players?.[p.did]
    return { name: full?.name || p.name, avatar: full?.avatar || p.avatar, did: p.did }
  }
  
  const p1 = getP(match.p1)
  const p2 = getP(match.p2)
  
  return (
    <div className="flex items-center justify-center gap-6">
      {/* Player 1 */}
      <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-center">
        <div className="text-[60px] mb-2">{p1.avatar}</div>
        <div className="text-xl font-bold text-white mb-1">{p1.name}</div>
        <div className="text-3xl font-black text-brand font-mono">{match.p1Score}</div>
      </motion.div>
      
      {/* VS */}
      <div className="text-center px-4">
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} 
          className="text-4xl font-black text-accent-red">
          VS
        </motion.div>
        <div className="text-sm text-slate-400 mt-2">Q{questionNum}/{totalQuestions}</div>
      </div>
      
      {/* Player 2 */}
      <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-center">
        <div className="text-[60px] mb-2">{p2.avatar}</div>
        <div className="text-xl font-bold text-white mb-1">{p2.name}</div>
        <div className="text-3xl font-black text-brand font-mono">{match.p2Score}</div>
      </motion.div>
    </div>
  )
}
