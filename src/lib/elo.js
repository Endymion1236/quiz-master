// ELO Rating System for Quiz Master
// Each player has a persistent ELO rating (default 1000)
// After each game, ELO is updated based on finish position

const DEFAULT_ELO = 1000
const K_FACTOR = 32 // How much ratings change per game

/**
 * Calculate expected score between two players
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/**
 * Update ELO ratings after a game
 * @param {Array} results - [{ name, score, elo }] sorted by quiz score (winner first)
 * @returns {Array} same array with updated `newElo` and `eloDelta` fields
 */
export function updateEloRatings(results) {
  const n = results.length
  if (n < 2) return results.map(r => ({ ...r, newElo: r.elo, eloDelta: 0 }))

  return results.map((player, rank) => {
    let totalExpected = 0
    let totalActual = 0

    // Compare against every other player
    for (let j = 0; j < n; j++) {
      if (j === rank) continue
      const expected = expectedScore(player.elo, results[j].elo)
      const actual = rank < j ? 1 : rank > j ? 0 : 0.5 // Win = 1, Loss = 0, Tie = 0.5
      totalExpected += expected
      totalActual += actual
    }

    // Scale K factor by number of opponents
    const scaledK = K_FACTOR / (n - 1) * 2
    const delta = Math.round(scaledK * (totalActual - totalExpected))
    const newElo = Math.max(100, player.elo + delta) // Floor at 100

    return { ...player, newElo, eloDelta: delta }
  })
}

/**
 * Get rank title based on ELO
 */
export function getEloRank(elo) {
  if (elo >= 1800) return { title: 'Grand Maître', icon: '👑', color: '#fbbf24' }
  if (elo >= 1500) return { title: 'Expert', icon: '💎', color: '#a855f7' }
  if (elo >= 1300) return { title: 'Confirmé', icon: '⭐', color: '#3b82f6' }
  if (elo >= 1100) return { title: 'Intermédiaire', icon: '🔥', color: '#f97316' }
  if (elo >= 900) return { title: 'Débutant', icon: '🌱', color: '#10b981' }
  return { title: 'Novice', icon: '🐣', color: '#94a3b8' }
}

export { DEFAULT_ELO }
