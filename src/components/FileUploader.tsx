import { useRef, useState } from 'react'
import { FILE_KINDS, addFiles, requestPersistentStorage, type FileKind } from '../lib/db'

// Zona para subir archivos: tocar para elegir o arrastrar y soltar.
// Antes se elige qué tipo de archivo es ("Describe tu archivo").
const ACCEPT = '.pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.odt,.odp,.xls,.xlsx,.csv,image/*,audio/*'
const MAX_MB = 200

export default function FileUploader({ topicId }: { topicId: number }) {
  const [kind, setKind] = useState<FileKind>('material')
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const save = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    const files = Array.from(list)
    const tooBig = files.filter((f) => f.size > MAX_MB * 1024 * 1024)
    const ok = files.filter((f) => f.size <= MAX_MB * 1024 * 1024)
    if (ok.length) {
      await addFiles(topicId, ok, kind)
      await requestPersistentStorage()
    }
    const parts = []
    if (ok.length) parts.push(`${ok.length} ${ok.length === 1 ? 'archivo guardado' : 'archivos guardados'}`)
    if (tooBig.length) parts.push(`${tooBig.length} omitido(s) por pasar de ${MAX_MB} MB`)
    setMessage(parts.join(' · '))
    if (inputRef.current) inputRef.current.value = ''
  }

  const kindInfo = FILE_KINDS.find((k) => k.value === kind)!

  return (
    <div className="card uploader">
      <fieldset className="kinds">
        <legend>Describe tu archivo</legend>
        {FILE_KINDS.map((k) => (
          <label key={k.value} className={`kind ${k.value === kind ? 'kind-on' : ''}`}>
            <input type="radio" name="kind" value={k.value} checked={k.value === kind} onChange={() => setKind(k.value)} />
            <span className="kind-label">{k.label}</span>
            <span className="muted kind-hint">{k.hint}</span>
          </label>
        ))}
      </fieldset>

      <label
        className={`dropzone ${dragging ? 'dropzone-on' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          save(e.dataTransfer.files)
        }}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPT} onChange={(e) => save(e.target.files)} />
        <span className="dropzone-icon" aria-hidden>
          ⬆️
        </span>
        <span>
          <strong>Toca para subir</strong> o arrastra aquí tus archivos
        </span>
        <span className="muted">Se guardarán como «{kindInfo.label}». PDF, PPT, Word, imágenes, texto o audio.</span>
      </label>
      {message && (
        <p className="toast" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
