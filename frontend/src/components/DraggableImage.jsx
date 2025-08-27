import React, { useEffect, useRef, useState } from 'react'

/**
 * DraggableImage
 * - Render an image at x,y with width/height
 * - Draggable with mouse/touch
 * - Emits onChange({ x, y, width, height })
 */
export default function DraggableImage({
  src,
  x = 20,
  y = 20,
  width = 80,
  height = 80,
  rotation = 0,
  locked = false,
  snapToGrid = false,
  gridSize = 8,
  getBounds, // function returning DOMRect of the card/container
  onChange,
  onSelect,
  selected = false,
  enableResize = true,
  // filters
  brightness = 1,
  contrast = 1,
  saturation = 1,
  hue = 0,
  opacity = 1,
  style,
  imageStyle,
}) {
  const ref = useRef(null)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)
  const startRef = useRef({ mx: 0, my: 0, x, y })
  const resizingRef = useRef(null) // { mx, my, w, h }

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
  }, [])

  const onDown = (e) => {
    if (locked) return
    // Prevent native selections/scroll
    e.preventDefault()
    const isTouch = e.type === 'touchstart'
    const p = isTouch ? e.touches[0] : e
    startRef.current = { mx: p.clientX, my: p.clientY, x, y }
    setDragging(true)
    draggingRef.current = true
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    onSelect && onSelect()
  }

  const onMove = (e) => {
    // Resize has precedence
    if (resizingRef.current) {
      const isTouch = e.type === 'touchmove'
      const p = isTouch ? e.touches[0] : e
      if (isTouch) e.preventDefault()
      let nw = Math.max(16, resizingRef.current.w + (p.clientX - resizingRef.current.mx))
      let nh = Math.max(16, resizingRef.current.h + (p.clientY - resizingRef.current.my))

      // Clamp within bounds if provided
      const bounds = typeof getBounds === 'function' ? getBounds() : null
      if (bounds && ref.current) {
        const maxW = Math.max(16, bounds.width - x)
        const maxH = Math.max(16, bounds.height - y)
        nw = Math.min(nw, maxW)
        nh = Math.min(nh, maxH)
      }

      onChange && onChange({ width: nw, height: nh })
      return
    }

    if (!draggingRef.current) return
    const isTouch = e.type === 'touchmove'
    const p = isTouch ? e.touches[0] : e
    if (isTouch) e.preventDefault()
    const dx = p.clientX - startRef.current.mx
    const dy = p.clientY - startRef.current.my
    let nx = startRef.current.x + dx
    let ny = startRef.current.y + dy

    // Snap to grid if enabled
    const snap = (v) => (gridSize > 0 ? Math.round(v / gridSize) * gridSize : v)
    if (snapToGrid) {
      nx = snap(nx)
      ny = snap(ny)
    }

    // Clamp to bounds if provided
    const bounds = typeof getBounds === 'function' ? getBounds() : null
    const el = ref.current
    if (bounds && el) {
      const elW = el.clientWidth || width
      const elH = el.clientHeight || height
      const maxX = Math.max(0, bounds.width - elW)
      const maxY = Math.max(0, bounds.height - elH)
      nx = Math.min(Math.max(0, nx), maxX)
      ny = Math.min(Math.max(0, ny), maxY)
    }

    onChange && onChange({ x: nx, y: ny, width, height, rotation })
  }

  const onUp = () => {
    setDragging(false)
    draggingRef.current = false
    resizingRef.current = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onUp)
  }

  const onResizeStart = (e) => {
    if (locked || !enableResize) return
    e.stopPropagation()
    e.preventDefault()
    const isTouch = e.type === 'touchstart'
    const p = isTouch ? e.touches[0] : e
    resizingRef.current = { mx: p.clientX, my: p.clientY, w: width, h: height }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    onSelect && onSelect()
  }

  return (
    <div
      ref={ref}
      onMouseDown={onDown}
      onTouchStart={onDown}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: `rotate(${rotation}deg)`,
        cursor: 'move',
        userSelect: 'none',
        touchAction: 'none',
        opacity,
        filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg)`,
        outline: selected ? '2px solid #3b82f6' : 'none',
        boxShadow: selected ? '0 0 0 2px rgba(59,130,246,0.3)' : 'none',
        ...style,
      }}
    >
      {/* eslint-disable-next-line */}
      <img
        src={src}
        alt="asset"
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', ...imageStyle }}
      />
      {enableResize && selected && (
        <div
          onMouseDown={onResizeStart}
          onTouchStart={onResizeStart}
          style={{
            position: 'absolute',
            right: -6,
            bottom: -6,
            width: 12,
            height: 12,
            background: '#3b82f6',
            borderRadius: 3,
            cursor: 'nwse-resize',
            boxShadow: '0 0 0 2px #fff',
          }}
        />
      )}
    </div>
  )
}
