/** 1536 → "1,5 KB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString('es', { maximumFractionDigits: 1 })} ${units[unit]}`
}

/** Ícono según el tipo de archivo. */
export function fileIcon(mimeType: string, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf' || ext === 'pdf') return '📕'
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return '📊'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return '📝'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return '📈'
  if (mimeType.startsWith('audio/')) return '🎧'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('text/') || ext === 'txt' || ext === 'md') return '📄'
  return '📎'
}
