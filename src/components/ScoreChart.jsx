import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { motion } from 'framer-motion'

const CHART_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1']

export default function ScoreChart({ scoreHistory, players, maxPlayers = 6 }) {
  if (!scoreHistory || Object.keys(scoreHistory).length === 0) return null

  // Build chart data: [ { q: "Q1", [playerName]: score }, ... ]
  const playerIds = Object.keys(scoreHistory)
  const maxQ = Math.max(...playerIds.map(pid => (scoreHistory[pid] || []).length))
  if (maxQ === 0) return null

  // Sort by final score to show top players
  const sorted = playerIds
    .map(pid => ({ pid, finalScore: (scoreHistory[pid] || [])[maxQ - 1] || 0 }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, maxPlayers)

  const data = []
  // Start at 0
  const startPoint = { q: 'Start' }
  sorted.forEach(({ pid }) => { startPoint[pid] = 0 })
  data.push(startPoint)

  for (let qi = 0; qi < maxQ; qi++) {
    const point = { q: `Q${qi + 1}` }
    sorted.forEach(({ pid }) => {
      point[pid] = (scoreHistory[pid] || [])[qi] || 0
    })
    data.push(point)
  }

  const getPlayerName = (pid) => {
    const p = players[pid]
    return p ? `${p.avatar} ${p.name}` : pid.slice(0, 6)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
      className="w-full rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-center mb-3">
        <span className="text-lg font-bold text-slate-300">📈 Évolution des scores</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="q"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={{ stroke: '#334155' }}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(15,23,42,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '13px',
            }}
            labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
            formatter={(value, name) => [value.toLocaleString() + ' pts', getPlayerName(name)]}
          />
          <Legend
            formatter={(value) => getPlayerName(value)}
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
          {sorted.map(({ pid }, i) => (
            <Line
              key={pid}
              type="monotone"
              dataKey={pid}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={3}
              dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              animationDuration={1000}
              animationBegin={i * 200}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
