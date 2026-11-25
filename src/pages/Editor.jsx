import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, Btn } from '../components/UI'
import { QUESTION_TYPES, MEDIA_TYPES, DOMAIN_CATEGORIES, getQuizCoverImage } from '../lib/constants'

export default function Editor({ quizzes, setQuizzes, onBack }) {
  const [editIdx, setEditIdx] = useState(null)
  const [editQ, setEditQ] = useState(null)

  const save = (updated) => { setQuizzes(updated) }
  const quiz = editIdx !== null ? quizzes[editIdx] : null

  const updateQuiz = (field, value) => {
    const updated = [...quizzes]
    updated[editIdx] = { ...updated[editIdx], [field]: value }
    save(updated)
  }

  const addQuestion = (type) => {
    const defaults = {
      qcm: { choices: ['', '', '', ''], correctAnswer: 0 },
      multi: { choices: ['', '', '', ''], correctAnswer: [] },
      truefalse: { choices: ['Vrai', 'Faux'], correctAnswer: 0 },
      text: { choices: [], correctAnswer: '' },
      estimate: { choices: [], correctAnswer: 0 },
      buzzer: { choices: [], correctAnswer: '' },
      blindtest: { choices: ['', '', '', ''], correctAnswer: 0, blindtestMode: 'qcm', media: { type: 'audio', url: '', name: '' } },
      karaoke: { choices: [], correctAnswer: '' },
      geo: { choices: [], geoTarget: { lat: 48.8566, lng: 2.3522 } },
      order: { choices: [], orderItems: ['', '', '', ''] },
      match: { choices: [], matchPairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }] },
      zoom: { choices: [], correctAnswer: '', media: { type: 'image', url: '', name: '' } },
    }
    const newQ = {
      questionId: 'q-' + Date.now(),
      type,
      prompt: '',
      timerSeconds: 20,
      points: 1000,
      media: null,
      ...defaults[type],
    }
    const updated = [...quizzes]
    updated[editIdx].questions.push(newQ)
    save(updated)
    setEditQ(updated[editIdx].questions.length - 1)
  }

  const updateQuestion = (qIdx, field, value) => {
    const updated = [...quizzes]
    updated[editIdx].questions[qIdx] = { ...updated[editIdx].questions[qIdx], [field]: value }
    save(updated)
  }

  const deleteQuestion = (qIdx) => {
    if (!confirm('Supprimer cette question ?')) return
    const updated = [...quizzes]
    updated[editIdx].questions.splice(qIdx, 1)
    save(updated)
    if (editQ === qIdx) setEditQ(null)
    else if (editQ > qIdx) setEditQ(editQ - 1)
  }

  const moveQuestion = (qIdx, dir) => {
    const newIdx = qIdx + dir
    if (newIdx < 0 || newIdx >= quiz.questions.length) return
    const updated = [...quizzes]
    const temp = updated[editIdx].questions[qIdx]
    updated[editIdx].questions[qIdx] = updated[editIdx].questions[newIdx]
    updated[editIdx].questions[newIdx] = temp
    save(updated)
    setEditQ(newIdx)
  }

  const duplicateQuestion = (qIdx) => {
    const updated = [...quizzes]
    const copy = JSON.parse(JSON.stringify(updated[editIdx].questions[qIdx]))
    copy.questionId = 'q-' + Date.now()
    updated[editIdx].questions.splice(qIdx + 1, 0, copy)
    save(updated)
    setEditQ(qIdx + 1)
  }

  const newQuiz = () => {
    const q = { quizId: 'q-' + Date.now(), title: 'Nouveau Quiz', description: '', tags: [], version: 1, settings: { defaultTimer: 20 }, questions: [] }
    save([...quizzes, q])
    setEditIdx(quizzes.length)
  }

  const importJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        // Support both single quiz and array of quizzes
        const imported = Array.isArray(data) ? data : [data]
        const validated = imported.map(q => ({
          ...q,
          quizId: q.quizId || 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          title: q.title || 'Quiz importé',
          description: q.description || '',
          tags: q.tags || [],
          version: q.version || 1,
          settings: q.settings || { defaultTimer: 20 },
          questions: (q.questions || []).map((question, i) => ({
            ...question,
            questionId: question.questionId || `q-${Date.now()}-${i}`,
            type: question.type || 'qcm',
            prompt: question.prompt || '',
            choices: question.choices || [],
            correctAnswer: question.correctAnswer ?? 0,
            timerSeconds: question.timerSeconds || 20,
            points: question.points || 1000,
            media: question.media || null,
          })),
        }))
        save([...quizzes, ...validated])
        alert(`✅ ${validated.length} quiz importé${validated.length > 1 ? 's' : ''} ! (${validated.reduce((s, q) => s + q.questions.length, 0)} questions)`)
      } catch (err) {
        alert('❌ Erreur de lecture du JSON : ' + err.message)
      }
    }
    input.click()
  }

  const exportQuiz = (idx) => {
    const q = quizzes[idx]
    const blob = new Blob([JSON.stringify(q, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${q.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const duplicateQuiz = (idx) => {
    const original = quizzes[idx]
    const copy = JSON.parse(JSON.stringify(original))
    copy.quizId = 'quiz-' + Date.now() + Math.random().toString(36).slice(2, 6)
    copy.title = original.title + ' (copie)'
    copy.questions = copy.questions.map(q => ({ ...q, questionId: 'q-' + Date.now() + Math.random().toString(36).slice(2, 6) }))
    save([...quizzes, copy])
  }

  const deleteQuiz = (idx) => {
    if (!confirm('Supprimer ce quiz ?')) return
    const updated = quizzes.filter((_, i) => i !== idx)
    save(updated)
    if (editIdx === idx) { setEditIdx(null); setEditQ(null) }
  }

  const CARD_COLORS = [
    'from-indigo-500/20 to-purple-600/20 border-indigo-500/25',
    'from-pink-500/20 to-rose-600/20 border-pink-500/25',
    'from-cyan-500/20 to-blue-600/20 border-cyan-500/25',
    'from-amber-500/20 to-orange-600/20 border-amber-500/25',
    'from-emerald-500/20 to-green-600/20 border-emerald-500/25',
    'from-violet-500/20 to-fuchsia-600/20 border-violet-500/25',
    'from-red-500/20 to-rose-600/20 border-red-500/25',
    'from-teal-500/20 to-cyan-600/20 border-teal-500/25',
  ]
  const DEFAULT_EMOJIS = ['🎯', '🧠', '🎵', '⚡', '🌍', '📚', '🏆', '🎪', '🔬', '🎮']

  const [editorFilterFormat, setEditorFilterFormat] = useState('all')
  const [editorFilterDomain, setEditorFilterDomain] = useState('all')
  const [editorSort, setEditorSort] = useState('recent')
  const [editorSearch, setEditorSearch] = useState('')

  const getQuizFormat = (q) => {
    const types = (q.questions || []).map(qq => qq.type)
    const unique = [...new Set(types)]
    if (unique.length === 1 && unique[0] === 'blindtest') return 'blindtest'
    if (unique.length === 1 && unique[0] === 'buzzer') return 'buzzer'
    if (unique.length > 1 && (types.includes('blindtest') || types.includes('buzzer'))) return 'mixed'
    return 'multi'
  }

  const QUIZ_FORMATS_EDITOR = {
    multi:     { label: 'Multi-questions', icon: '📝' },
    blindtest: { label: 'Blind Test',      icon: '🎵' },
    buzzer:    { label: 'Buzzer',          icon: '🔔' },
    mixed:     { label: 'Mixte',           icon: '🎲' },
  }

  const filteredEditorQuizzes = quizzes
    .map((q, i) => ({ ...q, _idx: i, _format: getQuizFormat(q) }))
    .filter(q => {
      if (editorFilterFormat !== 'all' && q._format !== editorFilterFormat) return false
      if (editorFilterDomain !== 'all') {
        const cats = (q.questions || []).map(qq => (qq.category || '').toLowerCase())
        const parentSubs = DOMAIN_CATEGORIES[editorFilterDomain]
        if (parentSubs) {
          if (!parentSubs.some(sub => cats.includes(sub.toLowerCase()))) return false
        } else {
          if (!cats.includes(editorFilterDomain.toLowerCase())) return false
        }
      }
      if (editorSearch.trim()) {
        const s = editorSearch.toLowerCase()
        if (!q.title.toLowerCase().includes(s) && !(q.description || '').toLowerCase().includes(s)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (editorSort === 'questions') return (b.questions?.length || 0) - (a.questions?.length || 0)
      if (editorSort === 'alpha') return a.title.localeCompare(b.title)
      return b._idx - a._idx
    })

  // === Quiz List ===
  if (editIdx === null) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-[900px] mx-auto">
          <Btn variant="ghost" size="sm" onClick={onBack} className="mb-6">← Retour</Btn>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-extrabold">📝 Éditeur de Quiz</h2>
            <div className="flex gap-2">
              <Btn size="sm" variant="ghost" onClick={importJSON}>📥 Importer JSON</Btn>
              <Btn size="sm" onClick={newQuiz}>+ Nouveau</Btn>
            </div>
          </div>

          {/* Filters */}
          {quizzes.length > 0 && (
            <div className="space-y-3 mb-5">
              {/* Search */}
              <input
                value={editorSearch}
                onChange={e => setEditorSearch(e.target.value)}
                placeholder="🔍 Rechercher un quiz..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand placeholder-slate-500"
              />

              {/* Format tabs */}
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={() => setEditorFilterFormat('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${editorFilterFormat === 'all' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                >🎲 Tous</button>
                {Object.entries(QUIZ_FORMATS_EDITOR).map(([id, f]) => (
                  <button key={id} onClick={() => setEditorFilterFormat(id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${editorFilterFormat === id ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                  >{f.icon} {f.label}</button>
                ))}
              </div>

              {/* Domain + Sort */}
              <div className="flex gap-3">
                <select value={editorFilterDomain} onChange={e => setEditorFilterDomain(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-400 outline-none cursor-pointer flex-1 max-w-[250px]">
                  <option value="all">📂 Toutes les catégories</option>
                  {Object.entries(DOMAIN_CATEGORIES).map(([group, subs]) => (
                    <optgroup key={group} label={group}>
                      <option value={group}>{group} (tout)</option>
                      {subs.map(sub => <option key={sub} value={sub}>&nbsp;&nbsp;&nbsp;{sub}</option>)}
                    </optgroup>
                  ))}
                </select>
                <select value={editorSort} onChange={e => setEditorSort(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-400 outline-none cursor-pointer">
                  <option value="recent">Plus récent</option>
                  <option value="questions">Plus de questions</option>
                  <option value="alpha">A → Z</option>
                </select>
              </div>
            </div>
          )}

          {quizzes.length === 0 && (
            <Card className="text-center py-16">
              <div className="text-4xl mb-3">📝</div>
              <div className="text-slate-400 mb-4">Aucun quiz. Créez-en un ou importez un JSON !</div>
              <div className="flex gap-3 justify-center">
                <Btn size="sm" onClick={newQuiz}>+ Créer</Btn>
                <Btn size="sm" variant="ghost" onClick={importJSON}>📥 Importer</Btn>
              </div>
            </Card>
          )}

          {quizzes.length > 0 && filteredEditorQuizzes.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-3">🔍</div>
              <div>Aucun quiz trouvé pour ces filtres</div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredEditorQuizzes.map((q, fi) => {
              const i = q._idx
              const colorClass = CARD_COLORS[i % CARD_COLORS.length]
              const emoji = q.emoji || DEFAULT_EMOJIS[i % DEFAULT_EMOJIS.length]
              const categories = [...new Set((q.questions || []).map(qq => qq.category).filter(Boolean))]
              const typeIcons = { qcm: '📝', truefalse: '✅', text: '💬', estimate: '🔢', buzzer: '🔔', blindtest: '🎵', karaoke: '🎤', geo: '🗺️' }
              const questionTypes = [...new Set((q.questions || []).map(qq => qq.type))]

              return (
                <motion.div
                  key={q.quizId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setEditIdx(i); setEditQ(null) }}
                  className="relative cursor-pointer rounded-2xl overflow-hidden border border-transparent hover:border-white/10 transition-all group"
                >
                  <div className={`bg-gradient-to-br ${colorClass} p-5 h-full flex flex-col min-h-[180px]`}>
                    {/* Cover image (auto from category/format) or emoji */}
                    {(() => { const img = getQuizCoverImage(q); return img ? (
                      <div className="w-full h-20 rounded-xl mb-3 overflow-hidden bg-black/20">
                        <img src={img} alt="" className="w-full h-full object-cover" onError={e => { e.target.parentElement.style.display = 'none' }} />
                      </div>
                    ) : (
                      <div className="text-4xl mb-3">{emoji}</div>
                    ) })()}

                    {/* Title */}
                    <h4 className="font-bold text-white text-base leading-tight mb-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.title}</h4>

                    {/* Meta */}
                    <div className="mt-auto">
                      <div className="text-xs text-slate-400 font-semibold mb-1">
                        {q.questions?.length || 0} question{(q.questions?.length || 0) > 1 ? 's' : ''}
                      </div>
                      {categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {categories.slice(0, 3).map(cat => (
                            <span key={cat} className="text-[10px] bg-white/10 rounded-full px-2 py-0.5 text-slate-400">{cat}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1">
                        {questionTypes.slice(0, 5).map(t => (
                          <span key={t} className="text-xs" title={t}>{typeIcons[t] || '❓'}</span>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons (visible on hover) */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); duplicateQuiz(i) }}
                        className="w-7 h-7 rounded-lg bg-dark-800/80 backdrop-blur flex items-center justify-center text-xs hover:bg-dark-700" title="Dupliquer">📋</button>
                      <button onClick={e => { e.stopPropagation(); exportQuiz(i) }}
                        className="w-7 h-7 rounded-lg bg-dark-800/80 backdrop-blur flex items-center justify-center text-xs hover:bg-dark-700" title="Exporter">📤</button>
                      <button onClick={e => { e.stopPropagation(); deleteQuiz(i) }}
                        className="w-7 h-7 rounded-lg bg-red-500/20 backdrop-blur flex items-center justify-center text-xs hover:bg-red-500/40" title="Supprimer">🗑️</button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // === Quiz Detail ===
  const currentQ = editQ !== null ? quiz.questions[editQ] : null

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1100px] mx-auto">
        <Btn variant="ghost" size="sm" onClick={() => { setEditIdx(null); setEditQ(null) }} className="mb-6">← Retour aux quiz</Btn>

        {/* Quiz title */}
        <Card className="mb-6">
          <input
            value={quiz.title}
            onChange={e => updateQuiz('title', e.target.value)}
            className="w-full text-xl font-bold bg-transparent border-none p-0 mb-2 outline-none text-white"
            placeholder="Titre du quiz..."
          />
          <input
            value={quiz.description || ''}
            onChange={e => updateQuiz('description', e.target.value)}
            className="w-full text-sm bg-transparent border-none p-0 outline-none text-slate-400 mb-3"
            placeholder="Description..."
          />
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-1">🎭 Emoji couverture</label>
              <input
                value={quiz.emoji || ''}
                onChange={e => updateQuiz('emoji', e.target.value)}
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none text-center text-2xl"
                placeholder="🎯"
                maxLength={4}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-1">🏷️ Tags (virgule)</label>
              <input
                value={quiz.tags || ''}
                onChange={e => updateQuiz('tags', e.target.value)}
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none"
                placeholder="Équestre, Culture G..."
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold block mb-1">🖼️ Image couverture (URL)</label>
              <input
                value={quiz.coverImage || ''}
                onChange={e => updateQuiz('coverImage', e.target.value)}
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none"
                placeholder="https://..."
              />
            </div>
          </div>
        </Card>

        {/* Add question buttons */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-bold">Questions ({quiz.questions.length})</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(QUESTION_TYPES).map(([type, info]) => (
              <button key={type} onClick={() => addQuestion(type)}
                className="px-3 py-1.5 text-xs font-semibold bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
              >
                {info.icon} {info.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-5">
          {/* Left sidebar: question list */}
          <div className="w-[280px] flex-shrink-0 space-y-2 max-h-[70vh] overflow-y-auto pr-2">
            {quiz.questions.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">Ajoutez des questions avec les boutons ci-dessus</div>
            )}
            {quiz.questions.map((qq, i) => (
              <div key={qq.questionId}
                onClick={() => setEditQ(i)}
                className={`p-3 rounded-xl cursor-pointer transition-all border-2 ${editQ === i ? 'border-brand bg-brand/5' : 'border-dark-500 bg-dark-700 hover:border-dark-500/80'}`}
              >
                <span className="text-xs text-slate-400">{QUESTION_TYPES[qq.type]?.icon} Q{i + 1}</span>
                <div className="font-semibold text-sm mt-1 truncate">{qq.prompt || '(sans titre)'}</div>
              </div>
            ))}
          </div>

          {/* Right: question editor */}
          <div className="flex-1 min-w-0">
            {currentQ ? (
              <QuestionEditor
                q={currentQ}
                qIdx={editQ}
                totalQ={quiz.questions.length}
                onChange={(field, val) => updateQuestion(editQ, field, val)}
                onDelete={() => deleteQuestion(editQ)}
                onMove={(dir) => moveQuestion(editQ, dir)}
                onDuplicate={() => duplicateQuestion(editQ)}
                onApplyBlindtestMode={(mode) => {
                  const updated = quiz.questions.map(qq =>
                    qq.type === 'blindtest' ? { ...qq, blindtestMode: mode } : qq
                  )
                  setQuizzes(quizzes.map((qz, qi) => qi === editIdx ? { ...qz, questions: updated } : qz))
                }}
              />
            ) : (
              <div className="text-center py-20 text-slate-500">
                <div className="text-4xl mb-4">👈</div>
                Sélectionnez une question pour la modifier
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// === Question Editor Component ===
function QuestionEditor({ q, qIdx, totalQ, onChange, onDelete, onMove, onDuplicate, onApplyBlindtestMode }) {
  const qType = QUESTION_TYPES[q.type] || {}

  const toggleCorrect = (ci) => {
    if (q.type === 'multi') {
      const arr = Array.isArray(q.correctAnswer) ? [...q.correctAnswer] : []
      if (arr.includes(ci)) onChange('correctAnswer', arr.filter(x => x !== ci))
      else onChange('correctAnswer', [...arr, ci])
    } else {
      onChange('correctAnswer', ci)
    }
  }

  const updateChoice = (ci, val) => {
    const choices = [...q.choices]
    choices[ci] = val
    onChange('choices', choices)
  }

  const addChoice = () => {
    onChange('choices', [...(q.choices || []), ''])
  }

  const removeChoice = (ci) => {
    const choices = q.choices.filter((_, i) => i !== ci)
    onChange('choices', choices)
    // Fix correctAnswer
    if (q.type === 'multi') {
      onChange('correctAnswer', (q.correctAnswer || []).filter(x => x !== ci).map(x => x > ci ? x - 1 : x))
    } else if (q.correctAnswer === ci) {
      onChange('correctAnswer', 0)
    } else if (q.correctAnswer > ci) {
      onChange('correctAnswer', q.correctAnswer - 1)
    }
  }

  return (
    <Card>
      {/* Header with actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{qType.icon}</span>
          <span className="text-sm font-semibold text-slate-400">Q{qIdx + 1} — {qType.label}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onMove(-1)} disabled={qIdx === 0} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 text-sm">↑</button>
          <button onClick={() => onMove(1)} disabled={qIdx >= totalQ - 1} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 text-sm">↓</button>
          <button onClick={onDuplicate} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm" title="Dupliquer">📋</button>
          <button onClick={onDelete} className="p-1.5 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 text-accent-red text-sm">✕</button>
        </div>
      </div>

      {/* Question prompt */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 font-semibold block mb-1">Question</label>
        <textarea
          value={q.prompt}
          onChange={e => onChange('prompt', e.target.value)}
          placeholder="Tapez votre question..."
          className="w-full min-h-[80px] resize-vertical bg-white/5 border border-dark-500 rounded-xl p-3 text-white outline-none focus:border-brand text-sm"
        />
      </div>

      {/* Category + Presenter note (inline) */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="text-xs text-slate-400 font-semibold block mb-1">📂 Catégorie</label>
          <select
            value={q.category || ''}
            onChange={e => onChange('category', e.target.value)}
            className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand cursor-pointer"
          >
            <option value="" style={{ background: '#1e293b', color: '#94a3b8' }}>— Aucune catégorie —</option>
            {Object.entries(DOMAIN_CATEGORIES).map(([group, subs]) => (
              <optgroup key={group} label={group} style={{ background: '#0f172a', color: '#cbd5e1' }}>
                {subs.map(sub => (
                  <option key={sub} value={sub} style={{ background: '#1e293b', color: '#f1f5f9' }}>{sub}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-400 font-semibold block mb-1">🎙️ Note présentateur</label>
          <input
            value={q.presenterNote || ''}
            onChange={e => onChange('presenterNote', e.target.value)}
            placeholder="Texte à lire à voix haute..."
            className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Choices (QCM / multi / truefalse) */}
      {(q.type === 'qcm' || q.type === 'multi' || q.type === 'truefalse') && (
        <div className="mb-4">
          <label className="text-xs text-slate-400 font-semibold block mb-2">
            Réponses {q.type === 'multi' ? '(cliquez les bonnes)' : '(cliquez la bonne)'}
          </label>
          <div className="space-y-2">
            {q.choices.map((c, ci) => {
              const isCorrect = q.type === 'multi' ? (q.correctAnswer || []).includes(ci) : q.correctAnswer === ci
              return (
                <div key={ci} className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCorrect(ci)}
                    className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${isCorrect ? 'bg-accent-green text-white border-2 border-accent-green' : 'bg-white/5 border-2 border-dark-500 text-slate-500'}`}
                  >✓</button>
                  <input
                    value={c}
                    onChange={e => updateChoice(ci, e.target.value)}
                    placeholder={`Réponse ${ci + 1}`}
                    disabled={q.type === 'truefalse'}
                    className="flex-1 bg-white/5 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand disabled:opacity-50"
                  />
                  {q.type !== 'truefalse' && q.choices.length > 2 && (
                    <button onClick={() => removeChoice(ci)} className="text-accent-red text-sm hover:bg-accent-red/10 rounded-lg p-1.5">✕</button>
                  )}
                </div>
              )
            })}
          </div>
          {q.type !== 'truefalse' && q.choices.length < 6 && (
            <button onClick={addChoice} className="mt-2 text-sm text-brand font-semibold hover:underline">+ Ajouter une réponse</button>
          )}
        </div>
      )}

      {/* Text answer */}
      {q.type === 'text' && (
        <div className="mb-4">
          <label className="text-xs text-slate-400 font-semibold block mb-1">Bonne(s) réponse(s) acceptées (séparées par des virgules)</label>
          <input
            value={Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
            onChange={e => {
              const val = e.target.value
              onChange('correctAnswer', val.includes(',') ? val.split(',').map(s => s.trim()) : val)
            }}
            placeholder="Paris, paris, PARIS"
            className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <div className="text-xs text-slate-500 mt-1">La comparaison ignore les majuscules/minuscules</div>
        </div>
      )}

      {/* Karaoke answer */}
      {q.type === 'karaoke' && (
        <div className="mb-4">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-3">
            <div className="text-purple-400 font-bold text-xs mb-1">🎤 Astuce Karaoké</div>
            <div className="text-slate-400 text-xs">Dans l'intitulé, utilisez <span className="text-purple-300 font-mono">___</span> pour les trous. Ex: "Je vais t'aimer comme on ne t'a jamais ___ "</div>
          </div>
          <label className="text-xs text-slate-400 font-semibold block mb-1">Mot(s) manquant(s) (séparés par des virgules si variantes)</label>
          <input
            value={Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
            onChange={e => {
              const val = e.target.value
              onChange('correctAnswer', val.includes(',') ? val.split(',').map(s => s.trim()) : val)
            }}
            placeholder="aimée, aimé"
            className="w-full bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
          />
        </div>
      )}

      {/* Geo answer (target coordinates) */}
      {q.type === 'geo' && (
        <div className="mb-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-3">
            <div className="text-blue-400 font-bold text-xs mb-1">🗺️ Question Géo</div>
            <div className="text-slate-400 text-xs">Entrez les coordonnées de la bonne réponse (latitude, longitude). Les joueurs pointeront sur une carte du monde.</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Latitude</label>
              <input
                type="number"
                step="0.001"
                value={q.geoTarget?.lat || ''}
                onChange={e => onChange('geoTarget', { ...(q.geoTarget || {}), lat: Number(e.target.value) })}
                placeholder="48.8566"
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Longitude</label>
              <input
                type="number"
                step="0.001"
                value={q.geoTarget?.lng || ''}
                onChange={e => onChange('geoTarget', { ...(q.geoTarget || {}), lng: Number(e.target.value) })}
                placeholder="2.3522"
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand font-mono"
              />
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-1">Astuce : cherchez "coordonnées GPS [lieu]" sur Google</div>
        </div>
      )}

      {/* ====== ORDER — items to put in correct order ====== */}
      {q.type === 'order' && (
        <div className="mb-4">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-3">
            <div className="text-orange-400 font-bold text-xs mb-1">📊 Question Ordre</div>
            <div className="text-slate-400 text-xs">Entrez les éléments dans le BON ordre. Les joueurs les verront mélangés et devront les remettre dans l'ordre.</div>
          </div>
          <label className="text-xs text-slate-400 font-semibold block mb-2">Éléments (dans le bon ordre)</label>
          {(q.orderItems || ['', '', '', '']).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <span className="text-xs text-orange-400 font-bold w-6 text-center">{idx + 1}</span>
              <input
                value={item}
                onChange={e => {
                  const items = [...(q.orderItems || ['', '', '', ''])]
                  items[idx] = e.target.value
                  onChange('orderItems', items)
                }}
                placeholder={`Élément ${idx + 1}`}
                className="flex-1 bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
              {(q.orderItems || []).length > 2 && (
                <button onClick={() => {
                  const items = [...(q.orderItems || [])]
                  items.splice(idx, 1)
                  onChange('orderItems', items)
                }} className="text-red-400 text-xs hover:text-red-300">✕</button>
              )}
            </div>
          ))}
          {(q.orderItems || []).length < 8 && (
            <button onClick={() => onChange('orderItems', [...(q.orderItems || ['', '', '', '']), ''])}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold">+ Ajouter un élément</button>
          )}
        </div>
      )}

      {/* ====== MATCH — pairs to associate ====== */}
      {q.type === 'match' && (
        <div className="mb-4">
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 mb-3">
            <div className="text-cyan-400 font-bold text-xs mb-1">🔗 Question Association</div>
            <div className="text-slate-400 text-xs">Entrez les paires. Les joueurs verront la colonne gauche et devront associer chaque élément à sa correspondance droite (mélangée).</div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="text-xs text-slate-400 font-semibold text-center">⬅️ Gauche</div>
            <div className="text-xs text-slate-400 font-semibold text-center">➡️ Droite</div>
          </div>
          {(q.matchPairs || [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }]).map((pair, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 mb-2">
              <input
                value={pair.left}
                onChange={e => {
                  const pairs = [...(q.matchPairs || [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }])]
                  pairs[idx] = { ...pairs[idx], left: e.target.value }
                  onChange('matchPairs', pairs)
                }}
                placeholder={`Gauche ${idx + 1}`}
                className="bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
              <input
                value={pair.right}
                onChange={e => {
                  const pairs = [...(q.matchPairs || [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }])]
                  pairs[idx] = { ...pairs[idx], right: e.target.value }
                  onChange('matchPairs', pairs)
                }}
                placeholder={`Droite ${idx + 1}`}
                className="bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
            </div>
          ))}
          {(q.matchPairs || []).length < 6 && (
            <button onClick={() => onChange('matchPairs', [...(q.matchPairs || [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }]), { left: '', right: '' }])}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold">+ Ajouter une paire</button>
          )}
        </div>
      )}

      {/* ====== ZOOM — mystery photo (uses media + buzzer) ====== */}
      {q.type === 'zoom' && (
        <div className="mb-4">
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-3 mb-3">
            <div className="text-pink-400 font-bold text-xs mb-1">🔍 Photo Mystère</div>
            <div className="text-slate-400 text-xs">Ajoutez une image ci-dessous. Elle sera affichée très zoomée (x8) puis dézoome progressivement. Le Host contrôle le niveau de zoom. Les joueurs buzzent quand ils reconnaissent l'image.</div>
          </div>
          <label className="text-xs text-slate-400 font-semibold block mb-1">🔔 Bonne réponse (mots-clés)</label>
          <input
            value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
            onChange={e => onChange('correctAnswer', e.target.value)}
            placeholder="Ex: Tour Eiffel paris"
            className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <p className="text-xs text-slate-500 mt-1">N'oubliez pas d'ajouter l'image dans le média ci-dessous !</p>
        </div>
      )}

      {/* Estimate answer */}
      {q.type === 'estimate' && (
        <div className="mb-4">
          <label className="text-xs text-slate-400 font-semibold block mb-1">Bonne réponse (nombre)</label>
          <input
            type="number"
            value={q.correctAnswer}
            onChange={e => onChange('correctAnswer', Number(e.target.value))}
            placeholder="42"
            className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand font-mono"
          />
          <div className="text-xs text-slate-500 mt-1">Le joueur le plus proche gagne le plus de points</div>
        </div>
      )}

      {/* Buzzer answer */}
      {q.type === 'buzzer' && (
        <div className="mb-4">
          <label className="text-xs text-slate-400 font-semibold block mb-1">Mots-clés acceptés (séparés par des espaces)</label>
          <input
            value={q.correctAnswer}
            onChange={e => onChange('correctAnswer', e.target.value)}
            placeholder="poney chèvre poule cochon"
            className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <div className="text-xs text-slate-500 mt-1">Le premier joueur à buzzer et contenir un mot-clé gagne</div>
        </div>
      )}

      {/* Blindtest: mode selector + answer UI based on mode */}
      {q.type === 'blindtest' && (
        <div className="mb-4">
          {/* Mode selector */}
          <label className="text-xs text-slate-400 font-semibold block mb-2">🎵 Mode de réponse</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {[
              { id: 'qcm', icon: '📝', label: 'QCM' },
              { id: 'buzzer', icon: '🔔', label: 'Buzzer' },
              { id: 'estimate', icon: '🔢', label: 'Estimation' },
              { id: 'progressive', icon: '🎵', label: 'Progressif' },
              { id: 'pixel', icon: '🖼️', label: 'Image pixel' },
              { id: 'reverse', icon: '🔄', label: 'Inversé' },
            ].map(m => (
              <button key={m.id} onClick={() => onChange('blindtestMode', m.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${(q.blindtestMode || 'qcm') === m.id ? 'bg-brand/20 border-brand text-brand' : 'bg-white/5 border-white/10 text-slate-400'}`}
              >{m.icon} {m.label}</button>
            ))}
          </div>
          {onApplyBlindtestMode && (
            <button onClick={() => onApplyBlindtestMode(q.blindtestMode || 'qcm')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mb-3 block">
              ↳ Appliquer ce mode à toutes les questions blindtest
            </button>
          )}

          {/* QCM mode — classic choices */}
          {(!q.blindtestMode || q.blindtestMode === 'qcm') && (
            <>
              <label className="text-xs text-slate-400 font-semibold block mb-2">
                Réponses (cliquez la bonne)
              </label>
              <div className="space-y-2">
                {(q.choices || []).map((c, ci) => {
                  const isCorrect = q.correctAnswer === ci
                  return (
                    <div key={ci} className="flex items-center gap-2">
                      <button onClick={() => onChange('correctAnswer', ci)}
                        className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${isCorrect ? 'bg-accent-green text-white border-2 border-accent-green' : 'bg-white/5 border-2 border-dark-500 text-slate-500'}`}
                      >✓</button>
                      <input value={c} onChange={e => { const ch = [...q.choices]; ch[ci] = e.target.value; onChange('choices', ch) }}
                        placeholder={`Réponse ${ci + 1}`}
                        className="flex-1 bg-white/5 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand"
                      />
                      {q.choices.length > 2 && (
                        <button onClick={() => { const ch = q.choices.filter((_, i) => i !== ci); onChange('choices', ch); if (q.correctAnswer === ci) onChange('correctAnswer', 0); else if (q.correctAnswer > ci) onChange('correctAnswer', q.correctAnswer - 1) }}
                          className="text-accent-red text-sm hover:bg-accent-red/10 rounded-lg p-1.5">✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
              {(q.choices || []).length < 6 && (
                <button onClick={() => onChange('choices', [...(q.choices || []), ''])} className="mt-2 text-sm text-brand font-semibold hover:underline">+ Ajouter une réponse</button>
              )}
            </>
          )}

          {/* Buzzer mode — correct answer keywords */}
          {q.blindtestMode === 'buzzer' && (
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">🔔 Bonne réponse (mots-clés acceptés)</label>
              <input
                value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                onChange={e => onChange('correctAnswer', e.target.value)}
                placeholder="Ex: Bohemian Rhapsody queen freddie mercury"
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
              <p className="text-xs text-slate-500 mt-1">Le Host valide la réponse orale. Mots-clés séparés par des espaces pour l'affichage.</p>
            </div>
          )}

          {/* Estimate mode — numeric answer */}
          {q.blindtestMode === 'estimate' && (
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">🔢 Bonne réponse (année, nombre)</label>
              <input
                type="number"
                value={typeof q.correctAnswer === 'number' ? q.correctAnswer : ''}
                onChange={e => onChange('correctAnswer', Number(e.target.value))}
                placeholder="Ex: 1985"
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
              <p className="text-xs text-slate-500 mt-1">Le plus proche de la bonne réponse gagne le plus de points.</p>
            </div>
          )}

          {/* Progressive mode — audio gets longer */}
          {q.blindtestMode === 'progressive' && (
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">🔔 Bonne réponse (mots-clés)</label>
              <input
                value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                onChange={e => onChange('correctAnswer', e.target.value)}
                placeholder="Ex: Les Mondes Engloutis"
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 mt-2">
                <div className="text-xs text-purple-400 font-bold mb-1">🎵 Mode progressif</div>
                <p className="text-xs text-slate-400">L'extrait commence à 2 secondes et s'allonge. Le Host contrôle les paliers (2s → 5s → 10s → 20s). Moins de points à chaque rallonge (1000 → 750 → 500 → 250). Les joueurs buzzent quand ils pensent avoir trouvé.</p>
              </div>
            </div>
          )}

          {/* Pixel mode — image reveals progressively */}
          {q.blindtestMode === 'pixel' && (
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">🔔 Bonne réponse (mots-clés)</label>
              <input
                value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                onChange={e => onChange('correctAnswer', e.target.value)}
                placeholder="Ex: Tour Eiffel paris"
                className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
              <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-3 mt-2">
                <div className="text-xs text-cyan-400 font-bold mb-1">🖼️ Mode image progressive</div>
                <p className="text-xs text-slate-400">L'image commence très pixelisée et se dévoile en 5 paliers. Le Host contrôle la netteté. Moins de points à chaque dévoilement. Les joueurs buzzent quand ils reconnaissent l'image. Ajoutez l'image dans le média ci-dessous.</p>
              </div>
            </div>
          )}

          {/* Reverse mode — audio played backwards */}
          {q.blindtestMode === 'reverse' && (
            <div>
              <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 mb-3">
                <div className="text-xs text-rose-400 font-bold mb-1">🔄 Mode audio inversé</div>
                <p className="text-xs text-slate-400">Le son est joué à l'envers ! Préparez une version inversée (Audacity : Effet → Inverser) et mettez le lien dans le média ci-dessous.</p>
              </div>

              {/* Answer mode for reverse */}
              <label className="text-xs text-slate-400 font-semibold block mb-2">Mode de réponse</label>
              <div className="flex gap-2 mb-3">
                {[
                  { id: 'buzzer', icon: '🔔', label: 'Buzzer' },
                  { id: 'text', icon: '✏️', label: 'Texte libre' },
                  { id: 'qcm', icon: '📝', label: 'QCM' },
                ].map(m => (
                  <button key={m.id} onClick={() => onChange('reverseAnswerMode', m.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${(q.reverseAnswerMode || 'buzzer') === m.id ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >{m.icon} {m.label}</button>
                ))}
              </div>

              {/* Buzzer/text answer */}
              {(!q.reverseAnswerMode || q.reverseAnswerMode === 'buzzer' || q.reverseAnswerMode === 'text') && (
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">
                    {q.reverseAnswerMode === 'text' ? '✏️ Bonne réponse (variantes séparées par virgule)' : '🔔 Bonne réponse (mots-clés)'}
                  </label>
                  <input
                    value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                    onChange={e => onChange('correctAnswer', e.target.value)}
                    placeholder={q.reverseAnswerMode === 'text' ? 'Bohemian Rhapsody, bohemian rhapsody' : 'Bohemian Rhapsody queen'}
                    className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
                  />
                </div>
              )}

              {/* QCM choices */}
              {q.reverseAnswerMode === 'qcm' && (
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-2">Choix de réponses</label>
                  {(q.choices || ['', '', '', '']).map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => onChange('correctAnswer', idx)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border transition-all ${q.correctAnswer === idx ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
                      >{q.correctAnswer === idx ? '✓' : idx + 1}</button>
                      <input
                        value={c}
                        onChange={e => {
                          const ch = [...(q.choices || ['', '', '', ''])]
                          ch[idx] = e.target.value
                          onChange('choices', ch)
                        }}
                        placeholder={`Choix ${idx + 1}`}
                        className="flex-1 bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Media attachment (any question type) */}
      <MediaEditor media={q.media} onChange={(media) => onChange('media', media)} isBlindtest={q.type === 'blindtest'} quizId={q.questionId} />

      {/* Timer & Points */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-slate-400 font-semibold block mb-1">Timer (sec)</label>
          <input
            type="number" min="5" max="120"
            value={q.timerSeconds}
            onChange={e => onChange('timerSeconds', parseInt(e.target.value) || 20)}
            className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-400 font-semibold block mb-1">Points</label>
          <input
            type="number" min="100" step="100"
            value={q.points}
            onChange={e => onChange('points', parseInt(e.target.value) || 1000)}
            className="w-full bg-white/5 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Special modes toggles */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Steal */}
        <button
          onClick={() => onChange('steal', !q.steal)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${q.steal ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' : 'bg-white/5 border border-dark-500 text-slate-500 hover:bg-white/10'}`}
        >
          🏴‍☠️ {q.steal ? 'Vol ACTIF' : 'Vol'}
        </button>
        {q.steal && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">pts:</label>
            <input
              type="number" min="100" step="100"
              value={q.stealPoints || q.points || 1000}
              onChange={e => onChange('stealPoints', parseInt(e.target.value) || 500)}
              className="w-20 bg-white/5 border border-dark-500 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-brand"
            />
          </div>
        )}

        {/* Mystery */}
        <button
          onClick={() => onChange('mystery', !q.mystery)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${q.mystery ? 'bg-purple-500/20 border border-purple-500/40 text-purple-400' : 'bg-white/5 border border-dark-500 text-slate-500 hover:bg-white/10'}`}
        >
          ❓ {q.mystery ? 'Mystère ACTIF' : 'Mystère'}
        </button>

        {/* Bet */}
        <button
          onClick={() => onChange('bet', !q.bet)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${q.bet ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-white/5 border border-dark-500 text-slate-500 hover:bg-white/10'}`}
        >
          🎰 {q.bet ? 'Pari ACTIF' : 'Pari'}
        </button>

        {/* Bonus wheel */}
        <button
          onClick={() => onChange('bonusWheel', !q.bonusWheel)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${q.bonusWheel ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400' : 'bg-white/5 border border-dark-500 text-slate-500 hover:bg-white/10'}`}
        >
          🎲 {q.bonusWheel ? 'Roue Bonus ACTIF' : 'Roue Bonus'}
        </button>

        {/* Roue du destin */}
        <button
          onClick={() => onChange('destinyWheel', !q.destinyWheel)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${q.destinyWheel ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-white/5 border border-dark-500 text-slate-500 hover:bg-white/10'}`}
        >
          🎰 {q.destinyWheel ? 'Destin ACTIF' : 'Roue du Destin'}
        </button>

        {/* Chain hint */}
        <button
          onClick={() => onChange('chainHint', !q.chainHint)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${q.chainHint ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' : 'bg-white/5 border border-dark-500 text-slate-500 hover:bg-white/10'}`}
        >
          🔗 {q.chainHint ? 'Chaîné ACTIF' : 'Chaîné'}
        </button>
      </div>
    </Card>
  )
}

// === Media Editor Component ===
import { storage } from '../firebase'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

function MediaEditor({ media, onChange, isBlindtest, quizId }) {
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const inputId = React.useRef('media-upload-' + Math.random().toString(36).slice(2))

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    let type = 'image'
    if (file.type.startsWith('audio/')) type = 'audio'
    else if (file.type.startsWith('video/')) type = 'video'
    const maxSize = MEDIA_TYPES[type]?.maxSize || 50 * 1024 * 1024
    if (file.size > maxSize) { alert(`Fichier trop gros ! Max: ${Math.round(maxSize / 1024 / 1024)} Mo`); return }

    // Upload to Firebase Storage
    const qid = quizId || 'default'
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const fileRef = storageRef(storage, `media/${qid}/${fileName}`)

    setUploading(true)
    setProgress(0)

    try {
      const uploadTask = uploadBytesResumable(fileRef, file)

      uploadTask.on('state_changed',
        (snapshot) => {
          setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
        },
        (error) => {
          console.error('Upload error:', error)
          alert('Erreur upload : ' + error.message)
          setUploading(false)
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref)
          onChange({ type, url, name: file.name, size: file.size, storagePath: `media/${qid}/${fileName}` })
          setUploading(false)
        }
      )
    } catch (err) {
      alert('Erreur : ' + err.message)
      setUploading(false)
    }
    e.target.value = ''
  }

  return (
    <div className="mb-4">
      <label className="text-xs text-slate-400 font-semibold block mb-2">
        {isBlindtest ? '🎵 Média (obligatoire pour blind test)' : '📎 Média (optionnel)'}
      </label>

      {/* Upload in progress */}
      {uploading && (
        <div className="bg-white/5 border border-brand/30 rounded-xl p-4 mb-2">
          <div className="flex items-center gap-3 mb-2">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="text-xl">⏳</motion.div>
            <span className="text-sm font-semibold text-brand">Upload en cours... {progress}%</span>
          </div>
          <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {!uploading && media && media.url ? (
        <div className="bg-white/5 border border-dark-500 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <span>{media.type === 'audio' ? '🎵' : media.type === 'video' ? '🎬' : '🖼️'}</span>
              <span className="font-semibold truncate max-w-[200px]">{media.name || 'Média'}</span>
              {media.size && <span className="text-slate-500 text-xs">{(media.size / 1024 / 1024).toFixed(1)} Mo</span>}
              {media.storagePath && <span className="text-accent-green text-xs">☁️ Cloud</span>}
            </div>
            <button onClick={() => onChange(null)} className="text-accent-red text-sm hover:bg-accent-red/10 rounded-lg px-2 py-1">Supprimer</button>
          </div>
          {media.type === 'image' && <img src={media.url} alt="" className="w-full max-h-40 object-contain rounded-lg" />}
          {media.type === 'audio' && !media.url.includes('youtu') && !media.url.includes('spotify') && <audio controls src={media.url} className="w-full mt-1" style={{ height: 36 }} />}
          {(media.type === 'spotify' || media.url?.includes('spotify.com')) && (
            <div className="rounded-lg overflow-hidden mt-1">
              <iframe
                src={media.url.includes('/embed/') ? media.url : media.url.replace('open.spotify.com/', 'open.spotify.com/embed/')}
                width="100%" height="80"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                className="rounded-lg"
              />
            </div>
          )}
          {media.type === 'video' && media.url.includes('youtu') && (() => {
            const m = media.url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
            return m ? <div className="relative w-full rounded-lg overflow-hidden mt-1" style={{ paddingTop: '56.25%' }}><iframe src={`https://www.youtube.com/embed/${m[1]}`} className="absolute inset-0 w-full h-full" frameBorder="0" allow="autoplay" /></div> : null
          })()}
          {media.type === 'video' && !media.url.includes('youtu') && <video controls src={media.url} className="w-full max-h-40 rounded-lg mt-1" />}
          {(media.type === 'audio' || media.type === 'video') && media.type !== 'spotify' && (
            <div className="flex gap-3 mt-2">
              <div className="flex-1"><label className="text-xs text-slate-500">Début (sec)</label>
                <input type="number" min="0" value={media.startAt || 0} onChange={e => onChange({ ...media, startAt: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-dark-500 rounded-lg px-2 py-1 text-xs text-white outline-none" /></div>
              <div className="flex-1"><label className="text-xs text-slate-500">Fin (sec, 0=tout)</label>
                <input type="number" min="0" value={media.endAt || 0} onChange={e => onChange({ ...media, endAt: Number(e.target.value) || 0 })} className="w-full bg-white/5 border border-dark-500 rounded-lg px-2 py-1 text-xs text-white outline-none" /></div>
            </div>
          )}
        </div>
      ) : !uploading && (
        <div>
          <input type="file" id={inputId.current} className="hidden" accept="image/*,audio/*,video/*" onChange={handleFileSelect} />
          <div className="flex gap-2">
            {Object.entries(MEDIA_TYPES).map(([type, info]) => (
              <button key={type} onClick={() => { const el = document.getElementById(inputId.current); el.accept = info.accept; el.click() }}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-dashed border-dark-500 text-center hover:bg-white/10 transition cursor-pointer">
                <div className="text-lg">{info.icon}</div><div className="text-xs text-slate-400">{info.label}</div>
              </button>
            ))}
          </div>
          <input type="text" placeholder="Collez une URL (YouTube, Spotify, MP3...)" className="w-full mt-2 bg-white/5 border border-dark-500 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand"
            onBlur={e => {
              const url = e.target.value.trim(); if (!url) return
              let type = 'video'
              let name = 'Lien'
              // Spotify detection — convert to embed URL
              const spotifyM = url.match(/open\.spotify\.com\/(?:embed\/)?(?:intl-[a-z]{2}\/)?(track|playlist|album)\/([a-zA-Z0-9]+)/)
              if (spotifyM) {
                type = 'spotify'
                name = '🎵 Spotify ' + spotifyM[1]
                onChange({ type, url: `https://open.spotify.com/embed/${spotifyM[1]}/${spotifyM[2]}?theme=0`, name })
                e.target.value = ''
                return
              }
              if (url.includes('youtube.com') || url.includes('youtu.be')) { type = 'video'; name = '🎵 YouTube' }
              else if (url.match(/\.(mp3|wav|ogg)/i)) { type = 'audio'; name = url.split('/').pop() }
              else if (url.match(/\.(mp4|webm)/i)) { type = 'video'; name = url.split('/').pop() }
              else if (url.match(/\.(jpg|jpeg|png|webp|gif)/i)) { type = 'image'; name = url.split('/').pop() }
              onChange({ type, url, name })
              e.target.value = ''
            }} />
        </div>
      )}
    </div>
  )
}
