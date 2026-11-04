import { useEffect, useMemo } from 'react'
import { FILE_KINDS, db, type FileKind, type StudyFile } from '../lib/db'
import { fileIcon, formatBytes } from '../lib/format'
import ConfirmButton from './ConfirmButton'

// Lista de archivos de un tema. Las imágenes muestran miniatura.
// "Abrir" usa una URL temporal (blob:) que apunta al archivo guardado.
function FileRow({ file }: { file: StudyFile }) {
  const url = useMemo(() => URL.createObjectURL(file.blob), [file.blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const isImage = file.mimeType.startsWith('image/')
  // Para la miniatura usamos la versión pequeña si existe (archivos subidos antes no la tienen).
  const thumbUrl = useMemo(() => (file.thumb ? URL.createObjectURL(file.thumb) : null), [file.thumb])
  useEffect(() => () => void (thumbUrl && URL.revokeObjectURL(thumbUrl)), [thumbUrl])

  return (
    <li className="file-row">
      {isImage ? <img className="thumb" src={thumbUrl ?? url} alt="" loading="lazy" decoding="async" width={44} height={44} /> : <span className="file-icon" aria-hidden>{fileIcon(file.mimeType, file.name)}</span>}
      <div className="file-main">
        <a className="file-name" href={url} target="_blank" rel="noreferrer">
          {file.name}
        </a>
        <div className="file-meta">
          <select
            className="select-small"
            aria-label="Tipo de archivo"
            value={file.kind}
            onChange={(e) => db.files.update(file.id, { kind: e.target.value as FileKind })}
          >
            {FILE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <span className="muted">{formatBytes(file.size)}</span>
        </div>
      </div>
      <div className="file-actions">
        <a className="btn btn-small btn-ghost" href={url} download={file.name}>
          Descargar
        </a>
        <ConfirmButton label={`Borrar ${file.name}`} confirmText="¿Borrar?" onConfirm={() => db.files.delete(file.id)}>
          Borrar
        </ConfirmButton>
      </div>
    </li>
  )
}

export default function FileList({ files }: { files: StudyFile[] }) {
  if (files.length === 0) return <p className="empty">Todavía no hay archivos en este tema.</p>
  return (
    <ul className="files">
      {files.map((f) => (
        <FileRow key={f.id} file={f} />
      ))}
    </ul>
  )
}
