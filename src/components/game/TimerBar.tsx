import { useEffect, useRef, useState } from 'react'
import { playTick, vibrate } from '../../lib/effects'

// Barra de tiempo. En los últimos 3 segundos suena un pitido por segundo,
// el celular vibra y la barra se pone roja.
export default function TimerBar({ seconds, running, onExpire }: { seconds: number; running: boolean; onExpire: () => void }) {
  const [left, setLeft] = useState(seconds * 1000)
  const leftRef = useRef(seconds * 1000)
  const lastWarn = useRef<number | null>(null)
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  })

  useEffect(() => {
    if (!running) return
    const end = performance.now() + leftRef.current
    const frame = { id: 0 }
    const tick = () => {
      const ms = Math.max(0, end - performance.now())
      leftRef.current = ms
      setLeft(ms)
      const s = Math.ceil(ms / 1000)
      if (s <= 3 && s >= 1 && lastWarn.current !== s) {
        lastWarn.current = s
        playTick()
        vibrate(60)
      }
      if (ms <= 0) return onExpireRef.current()
      frame.id = requestAnimationFrame(tick)
    }
    frame.id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.id)
    // Solo arranca o se detiene con "running"; el tiempo restante se conserva al pausar.
  }, [running])

  const pct = (left / (seconds * 1000)) * 100
  const secs = Math.ceil(left / 1000)
  const warn = secs <= 3
  return (
    <div className={`timer ${warn ? 'timer-warn' : ''}`} role="timer" aria-label={`Quedan ${secs} segundos`}>
      <div className="timer-fill" style={{ width: `${pct}%` }} />
      <span className="timer-label">{secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${secs} s`}</span>
    </div>
  )
}
