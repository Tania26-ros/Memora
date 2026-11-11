import { Link } from 'react-router-dom'
import type { MascotLine, Mood } from '../lib/mascot'
import { useSettings } from '../lib/settings'

// Memo: un cuadernito con cara. Es un dibujo SVG (vectorial): se ve nítido
// en cualquier tamaño, pesa casi nada y toma el color del estilo elegido.

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'duerme' || mood === 'celebra') {
    // Ojos cerrados: arcos (felices al celebrar, relajados al dormir).
    const d = mood === 'celebra' ? 'M40 58 q6 -7 12 0 M68 58 q6 -7 12 0' : 'M40 58 q6 5 12 0 M68 58 q6 5 12 0'
    return <path d={d} fill="none" stroke="#1c1a29" strokeWidth="3.5" strokeLinecap="round" />
  }
  const look = mood === 'piensa' ? -3 : 0
  return (
    <g fill="#1c1a29">
      <ellipse cx="46" cy={57 + look} rx="5" ry="6.5" />
      <ellipse cx="74" cy={57 + look} rx="5" ry="6.5" />
      <circle cx="47.6" cy={54.5 + look} r="1.8" fill="#fff" />
      <circle cx="75.6" cy={54.5 + look} r="1.8" fill="#fff" />
    </g>
  )
}

function Mouth({ mood }: { mood: Mood }) {
  const paths: Record<Mood, string> = {
    feliz: 'M50 72 q10 9 20 0',
    celebra: 'M48 70 q12 16 24 0 z',
    animo: 'M52 74 q8 5 16 0',
    piensa: 'M54 75 h12',
    duerme: 'M56 74 q4 3 8 0',
  }
  const filled = mood === 'celebra'
  return <path d={paths[mood]} fill={filled ? '#c2185b' : 'none'} stroke="#1c1a29" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
}

export function MascotFace({ mood, size = 72 }: { mood: Mood; size?: number }) {
  return (
    <svg className={`mascot mascot-${mood}`} viewBox="0 0 120 120" width={size} height={size} aria-hidden>
      {/* Brazos */}
      {mood === 'celebra' ? (
        <path d="M24 66 L8 42 M96 66 L112 42" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" />
      ) : mood === 'animo' ? (
        <path d="M24 72 L12 84 M96 70 L110 54" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" />
      ) : mood === 'piensa' ? (
        <path d="M24 74 L12 86 M96 74 Q104 84 86 84" fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" />
      ) : (
        <path d="M24 74 L12 86 M96 74 L108 86" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" />
      )}
      {/* Cuerpo: tapa del cuaderno, hojas y lomo */}
      <rect x="22" y="22" width="78" height="80" rx="18" fill="var(--primary)" />
      <rect x="30" y="30" width="64" height="64" rx="12" fill="#fffdf7" />
      <path d="M30 42 h64 M30 86 h64" stroke="var(--primary-soft)" strokeWidth="2" />
      {/* Cinta separadora */}
      <path d="M80 18 v18 l5 -4 l5 4 v-18 z" fill="#f59e0b" />
      {/* Cachetes */}
      <circle cx="38" cy="68" r="5" fill="#f9a8d4" opacity="0.8" />
      <circle cx="82" cy="68" r="5" fill="#f9a8d4" opacity="0.8" />
      <Eyes mood={mood} />
      <Mouth mood={mood} />
      {mood === 'celebra' && (
        <g fill="#f59e0b">
          <path d="M10 22 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" />
          <path d="M108 16 l1.5 4.5 l4.5 1.5 l-4.5 1.5 l-1.5 4.5 l-1.5 -4.5 l-4.5 -1.5 l4.5 -1.5 z" />
        </g>
      )}
      {mood === 'duerme' && (
        <text x="98" y="20" fontSize="16" fontWeight="700" fill="var(--muted)">
          z
        </text>
      )}
      {mood === 'piensa' && (
        <text x="100" y="24" fontSize="20" fontWeight="700" fill="var(--primary)">
          ?
        </text>
      )}
    </svg>
  )
}

/** Memo con un globo de texto. No se muestra si el estudiante lo ocultó en Ajustes. */
export default function MascotBubble({ line, size = 64, compact = false }: { line: MascotLine; size?: number; compact?: boolean }) {
  const s = useSettings()
  if (!s.mascot) return null
  return (
    <div className={`mascot-row ${compact ? 'mascot-compact' : ''} ${s.animations ? 'mascot-alive' : ''}`}>
      <MascotFace mood={line.mood} size={size} />
      <div className="mascot-bubble" aria-live="polite">
        <span className="sr-only">Memo dice: </span>
        <p>{line.text}</p>
        {line.link && (
          <Link className="btn btn-small" to={line.link.to}>
            {line.link.label}
          </Link>
        )}
      </div>
    </div>
  )
}
