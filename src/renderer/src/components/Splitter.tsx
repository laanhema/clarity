import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

export interface SplitterProps {
  label: string
  /** Current value, shown to assistive technology. */
  value: number
  min: number
  max: number
  /** How much one arrow key press moves the splitter, in the same unit as `value`. */
  step: number
  /** Turns a horizontal pointer movement (in CSS pixels since the drag started) into a value. */
  valueForDrag: (startValue: number, deltaX: number) => number
  /** Called while dragging. */
  onChange: (value: number) => void
  /** Called once the drag or key press is over, with the final value. */
  onCommit: (value: number) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** A vertical bar between two panes that can be dragged or moved with the arrow keys. */
export function Splitter({ label, value, min, max, step, valueForDrag, onChange, onCommit }: SplitterProps) {
  const drag = useRef<{ startX: number; startValue: number; latest: number } | null>(null)

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startX: event.clientX, startValue: value, latest: value }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state) return
    state.latest = clamp(valueForDrag(state.startValue, event.clientX - state.startX), min, max)
    onChange(state.latest)
  }

  function handlePointerEnd() {
    const state = drag.current
    if (!state) return
    drag.current = null
    if (state.latest !== state.startValue) onCommit(state.latest)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (direction === 0) return
    event.preventDefault()
    const next = clamp(value + direction * step, min, max)
    onChange(next)
    onCommit(next)
  }

  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value * 100) / 100}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    />
  )
}
