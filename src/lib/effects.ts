import { getSettings } from './settings'

// ─────────────────────────────────────────────────────────────
// Efectos al responder: papelitos de colores al acertar, lluvia
// suave al fallar, y sonidos suaves hechos con Web Audio (sin
// archivos de sonido: se generan con ondas, así pesan 0 KB).
// ─────────────────────────────────────────────────────────────

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ── Sonidos ──
let ctx: AudioContext | null = null
function audio() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const a = audio()
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t = a.currentTime + start
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(a.destination)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

export function playCorrect() {
  if (!getSettings().sound) return
  // Campanita: dos notas agudas y suaves (Mi y La).
  tone(659, 0, 0.35, 0.12)
  tone(880, 0.09, 0.5, 0.1)
}

export function playWrong() {
  if (!getSettings().sound) return
  // Tono grave y corto, sin zumbido.
  tone(220, 0, 0.35, 0.1, 'triangle')
  tone(196, 0.12, 0.4, 0.08, 'triangle')
}

export function playTick() {
  if (!getSettings().sound) return
  tone(988, 0, 0.12, 0.07)
}

export function vibrate(ms: number | number[]) {
  if (getSettings().vibration) navigator.vibrate?.(ms)
}

// ── Animaciones ──
function overlay(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.className = 'fx-canvas'
  c.width = window.innerWidth * devicePixelRatio
  c.height = window.innerHeight * devicePixelRatio
  document.body.appendChild(c)
  return c
}

const COLORS = ['#5b4cf0', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#a855f7']

export function confetti(big = false) {
  if (!getSettings().animations || reducedMotion()) return
  const c = overlay()
  const g = c.getContext('2d')!
  const dpr = devicePixelRatio
  const n = big ? 160 : 80
  const parts = Array.from({ length: n }, () => ({
    x: c.width / 2 + (Math.random() - 0.5) * c.width * 0.3,
    y: c.height * 0.45,
    vx: (Math.random() - 0.5) * 14 * dpr,
    vy: (-Math.random() * 14 - 6) * dpr,
    r: (Math.random() * 5 + 3) * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }))
  const start = performance.now()
  const duration = big ? 1600 : 1100
  const frame = (t: number) => {
    const k = (t - start) / duration
    g.clearRect(0, 0, c.width, c.height)
    g.globalAlpha = Math.max(0, 1 - k * k)
    for (const p of parts) {
      p.vy += 0.45 * dpr
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      g.save()
      g.translate(p.x, p.y)
      g.rotate(p.rot)
      g.fillStyle = p.color
      g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
      g.restore()
    }
    if (k < 1) requestAnimationFrame(frame)
    else c.remove()
  }
  requestAnimationFrame(frame)
}

export function rain() {
  if (!getSettings().animations || reducedMotion()) return
  const c = overlay()
  const g = c.getContext('2d')!
  const dpr = devicePixelRatio
  const drops = Array.from({ length: 70 }, () => ({
    x: Math.random() * c.width,
    y: -Math.random() * c.height * 0.6,
    len: (Math.random() * 14 + 10) * dpr,
    v: (Math.random() * 4 + 7) * dpr,
  }))
  const start = performance.now()
  const duration = 1300
  const frame = (t: number) => {
    const k = (t - start) / duration
    g.clearRect(0, 0, c.width, c.height)
    g.globalAlpha = Math.max(0, 0.55 * (1 - k))
    g.strokeStyle = '#60a5fa'
    g.lineWidth = 2 * dpr
    g.lineCap = 'round'
    g.beginPath()
    for (const d of drops) {
      d.y += d.v
      d.x -= d.v * 0.15
      g.moveTo(d.x, d.y)
      g.lineTo(d.x + d.len * 0.15, d.y - d.len)
    }
    g.stroke()
    if (k < 1) requestAnimationFrame(frame)
    else c.remove()
  }
  requestAnimationFrame(frame)
}
