import { useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Card, Btn } from '../components/UI'

export default function ImportExport({ quizzes, setQuizzes, onBack }) {
  const [textArea, setTextArea] = useState('')

  const handleFileImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        importQuiz(parsed)
      } catch (err) {
        toast.error('JSON invalide : ' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }

  const handleTextImport = () => {
    if (!textArea.trim()) return
    try {
      const parsed = JSON.parse(textArea)
      importQuiz(parsed)
      setTextArea('')
    } catch (e) {
      toast.error('JSON invalide : ' + e.message)
    }
  }

  const importQuiz = (data) => {
    // Support both single quiz and array
    const items = Array.isArray(data) ? data : [data]
    let count = 0
    const updated = [...quizzes]
    items.forEach(q => {
      if (q.quizId && q.questions) {
        q.quizId = 'imported-' + Date.now() + '-' + count
        updated.push(q)
        count++
      }
    })
    if (count > 0) {
      setQuizzes(updated)
      toast.success(`✅ ${count} quiz importé${count > 1 ? 's' : ''} !`)
    } else {
      toast.error('Format invalide — il faut quizId et questions[]')
    }
  }

  const exportQuiz = (idx) => {
    downloadJSON(quizzes[idx], quizzes[idx].title)
  }

  const exportAll = () => {
    downloadJSON(quizzes, 'tous-les-quiz')
  }

  const downloadJSON = (data, name) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈ]/g, '_') + '.json'
    a.click()
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[700px] mx-auto">
        <Btn variant="ghost" size="sm" onClick={onBack} className="mb-6">← Retour</Btn>
        <h2 className="text-2xl font-extrabold mb-8">📦 Import / Export</h2>

        {/* Import */}
        <Card className="mb-6">
          <h3 className="font-bold mb-4">📥 Importer un quiz</h3>
          <input type="file" id="fileImport" accept=".json" className="hidden" onChange={handleFileImport} />
          <Btn variant="secondary" className="w-full mb-4" onClick={() => document.getElementById('fileImport').click()}>
            📁 Importer un fichier JSON
          </Btn>
          <div className="text-center text-slate-500 text-sm my-3">ou collez le JSON</div>
          <textarea
            value={textArea}
            onChange={e => setTextArea(e.target.value)}
            rows={5}
            placeholder='{"quizId":"...","title":"...","questions":[...]}'
            className="w-full font-mono text-xs bg-white/5 border border-dark-500 rounded-xl p-3 text-slate-300 outline-none focus:border-brand resize-vertical mb-3"
          />
          <Btn className="w-full" onClick={handleTextImport}>Importer</Btn>
        </Card>

        {/* Export */}
        <Card>
          <h3 className="font-bold mb-4">📤 Exporter</h3>
          <Btn variant="secondary" className="w-full mb-4" onClick={exportAll}>📦 Tout exporter</Btn>
          {quizzes.map((q, i) => (
            <div key={q.quizId} className="flex items-center justify-between py-3 border-b border-dark-500 last:border-none">
              <div>
                <div className="font-semibold">{q.title}</div>
                <div className="text-slate-400 text-xs">{q.questions.length} questions</div>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => exportQuiz(i)}>Exporter</Btn>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
