import React, { useRef } from 'react'
import { getIconById } from '../data/icons.jsx'

const DraggableIcon = ({
  iconId,
  x,
  y,
  size = 24,
  color = '#ffffff',
  locked = false,
  snapToGrid = true,
  gridSize = 8,
  onChange = () => {},
  getBounds
}) => {
  const draggingRef = useRef(false)
  const startRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 })

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
  const snap = (v) => (gridSize > 0 ? Math.round(v / gridSize) * gridSize : v)

  const onStart = (e) => {
    if (locked) return
    draggingRef.current = true
    const isTouch = e.type === 'touchstart'
    const point = isTouch ? e.touches[0] : e
    startRef.current = {
      mouseX: point.clientX,
      mouseY: point.clientY,
      startX: x,
      startY: y
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }

  const onMove = (e) => {
    if (!draggingRef.current) return
    const isTouch = e.type === 'touchmove'
    const point = isTouch ? e.touches[0] : e
    if (isTouch) e.preventDefault()

    let nextX = startRef.current.startX + (point.clientX - startRef.current.mouseX)
    let nextY = startRef.current.startY + (point.clientY - startRef.current.mouseY)

    if (snapToGrid) {
      nextX = snap(nextX)
      nextY = snap(nextY)
    }

    const bounds = getBounds ? getBounds() : null
    if (bounds) {
      const maxX = bounds.width - size - 4
      const maxY = bounds.height - size - 4
      nextX = clamp(nextX, 0, maxX)
      nextY = clamp(nextY, 0, maxY)
    }

    onChange({ x: nextX, y: nextY })
  }

  const onEnd = () => {
    draggingRef.current = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
  }

  const icon = getIconById(iconId)
  if (!icon) return null

  const Svg = icon.Svg

  return (
    <div
      onMouseDown={onStart}
      onTouchStart={onStart}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        cursor: locked ? 'default' : 'move',
        userSelect: 'none',
        touchAction: 'none',
        zIndex: 2
      }}
    >
      <Svg size={size} color={color} />
    </div>
  )
}

export default DraggableIcon
