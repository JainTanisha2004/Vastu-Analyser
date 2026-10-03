// DXF → fraction of image (0 to 1)
export function dxfToImageFrac(dxfX, dxfY, imageExtent) {
  if (!imageExtent) return { fracX: 0.5, fracY: 0.5 }
  return {
    fracX: (dxfX - imageExtent.x_min) / (imageExtent.x_max - imageExtent.x_min),
    fracY: 1 - (dxfY - imageExtent.y_min) / (imageExtent.y_max - imageExtent.y_min), // Y inverted
  }
}

// Image fraction → screen position (accounts for object-contain letterboxing)
export function fracToScreen(fracX, fracY, containerEl, imgEl) {
  if (!containerEl || !imgEl) return { px: 0, py: 0, pctX: 50, pctY: 50 }
  const cRect = containerEl.getBoundingClientRect()
  const natW = imgEl.naturalWidth || 1500
  const natH = imgEl.naturalHeight || 1500
  const imgAsp = natW / natH
  const cAsp = cRect.width / cRect.height
  let rW, rH, oX, oY

  if (imgAsp > cAsp) {
    rW = cRect.width
    rH = rW / imgAsp
    oX = 0
    oY = (cRect.height - rH) / 2
  } else {
    rH = cRect.height
    rW = rH * imgAsp
    oX = (cRect.width - rW) / 2
    oY = 0
  }

  const px = oX + fracX * rW
  const py = oY + fracY * rH
  return {
    px,
    py,
    pctX: (px / cRect.width) * 100,
    pctY: (py / cRect.height) * 100,
  }
}

// Screen position → DXF (reverse of above)
export function screenToDxf(clientX, clientY, containerEl, imgEl, imageExtent) {
  if (!containerEl || !imgEl || !imageExtent) return { x: 0, y: 0 }
  const cRect = containerEl.getBoundingClientRect()
  const relX = clientX - cRect.left
  const relY = clientY - cRect.top
  const natW = imgEl.naturalWidth || 1500
  const natH = imgEl.naturalHeight || 1500
  const imgAsp = natW / natH
  const cAsp = cRect.width / cRect.height
  let rW, rH, oX, oY

  if (imgAsp > cAsp) {
    rW = cRect.width
    rH = rW / imgAsp
    oX = 0
    oY = (cRect.height - rH) / 2
  } else {
    rH = cRect.height
    rW = rH * imgAsp
    oX = (cRect.width - rW) / 2
    oY = 0
  }

  const fracX = (relX - oX) / rW
  const fracY = (relY - oY) / rH

  return {
    x: imageExtent.x_min + fracX * (imageExtent.x_max - imageExtent.x_min),
    y: imageExtent.y_max - fracY * (imageExtent.y_max - imageExtent.y_min), // Y inverted
  }
}

// Combined convenience function
export function dxfToScreenPct(dxfX, dxfY, imageExtent, containerEl, imgEl) {
  const { fracX, fracY } = dxfToImageFrac(dxfX, dxfY, imageExtent)
  return fracToScreen(fracX, fracY, containerEl, imgEl)
}

// Render-safe variant for React components. Resize/image handlers capture the
// dimensions in state, so render does not read mutable DOM refs.
export function dxfToViewportPct(dxfX, dxfY, imageExtent, viewport) {
  if (!viewport || !imageExtent || viewport.width <= 0 || viewport.height <= 0) {
    return { px: 0, py: 0, pctX: 50, pctY: 50 }
  }
  const { fracX, fracY } = dxfToImageFrac(dxfX, dxfY, imageExtent)
  const imageWidth = viewport.imageWidth || 1500
  const imageHeight = viewport.imageHeight || 1500
  const imageAspect = imageWidth / imageHeight
  const containerAspect = viewport.width / viewport.height
  let renderedWidth
  let renderedHeight
  let offsetX
  let offsetY
  if (imageAspect > containerAspect) {
    renderedWidth = viewport.width
    renderedHeight = renderedWidth / imageAspect
    offsetX = 0
    offsetY = (viewport.height - renderedHeight) / 2
  } else {
    renderedHeight = viewport.height
    renderedWidth = renderedHeight * imageAspect
    offsetX = (viewport.width - renderedWidth) / 2
    offsetY = 0
  }
  const px = offsetX + fracX * renderedWidth
  const py = offsetY + fracY * renderedHeight
  return {
    px,
    py,
    pctX: (px / viewport.width) * 100,
    pctY: (py / viewport.height) * 100,
  }
}

// Frontend centroid calculation for house boundary polygon
export function polygonCentroid(points) {
  const n = points.length
  let area = 0, cx = 0, cy = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const cross = points[i].x * points[j].y - points[j].x * points[i].y
    area += cross
    cx += (points[i].x + points[j].x) * cross
    cy += (points[i].y + points[j].y) * cross
  }
  area /= 2
  if (Math.abs(area) < 1e-10) {
    const ax = points.reduce((s, p) => s + p.x, 0) / n
    const ay = points.reduce((s, p) => s + p.y, 0) / n
    return { x: ax, y: ay }
  }
  return { x: cx / (6 * area), y: cy / (6 * area) }
}
