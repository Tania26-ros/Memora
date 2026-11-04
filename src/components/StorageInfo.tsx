import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { formatBytes } from '../lib/format'

// Muestra cuánto espacio ocupan tus archivos en este dispositivo.
export default function StorageInfo() {
  const fileCount = useLiveQuery(() => db.files.count(), [])
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null && e.quota != null) setUsage({ used: e.usage, quota: e.quota })
    })
  }, [fileCount])

  return (
    <p>
      Todo se guarda en este dispositivo y funciona sin internet.
      {usage && ` Usado: ${formatBytes(usage.used)} de ${formatBytes(usage.quota)} disponibles.`}
    </p>
  )
}
