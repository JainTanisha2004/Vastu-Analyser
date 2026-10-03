import { describe, it, expect } from 'vitest'
import { dxfToImageFrac, fracToScreen, screenToDxf, dxfToScreenPct, dxfToViewportPct, polygonCentroid } from '../coordinateUtils'

describe('polygonCentroid', () => {
  it('computes correct L-shape centroid', () => {
    const points = [
      {x:0,y:0}, {x:10,y:0}, {x:10,y:5}, {x:5,y:5}, {x:5,y:10}, {x:0,y:10}
    ]
    const c = polygonCentroid(points)
    expect(c.x).toBeCloseTo(25/6, 3)
    expect(c.y).toBeCloseTo(25/6, 3)
  })

  it('computes correct rectangle centroid', () => {
    const c = polygonCentroid([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}])
    expect(c.x).toBeCloseTo(5, 3)
    expect(c.y).toBeCloseTo(5, 3)
  })

  it('falls back to mean points when area is zero', () => {
    // Collinear points representing a zero-area polygon
    const points = [{x:0,y:0}, {x:5,y:5}, {x:10,y:10}]
    const c = polygonCentroid(points)
    expect(c.x).toBeCloseTo(5, 3)
    expect(c.y).toBeCloseTo(5, 3)
  })
})

describe('dxfToImageFrac', () => {
  it('maps bounds correctly', () => {
    const extent = { x_min: 10, x_max: 110, y_min: 20, y_max: 120 }
    // Min bounds
    const minRes = dxfToImageFrac(10, 20, extent)
    expect(minRes.fracX).toBe(0)
    expect(minRes.fracY).toBe(1) // Y is inverted

    // Max bounds
    const maxRes = dxfToImageFrac(110, 120, extent)
    expect(maxRes.fracX).toBe(1)
    expect(maxRes.fracY).toBe(0)

    // Center
    const midRes = dxfToImageFrac(60, 70, extent)
    expect(midRes.fracX).toBe(0.5)
    expect(midRes.fracY).toBe(0.5)
  })

  it('returns default 0.5 when extent is null', () => {
    expect(dxfToImageFrac(10, 20, null)).toEqual({ fracX: 0.5, fracY: 0.5 })
  })
})

describe('fracToScreen and screenToDxf roundtrip', () => {
  it('reconstitutes screen coordinates correctly', () => {
    // Mock container and image dimensions
    const container = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 })
    }
    const img = {
      naturalWidth: 1500,
      naturalHeight: 1500
    }
    const extent = { x_min: 0, x_max: 1000, y_min: 0, y_max: 1000 }

    // Convert from DXF to screen
    const screenPos = dxfToScreenPct(500, 500, extent, container, img)
    expect(screenPos.pctX).toBe(50)
    expect(screenPos.pctY).toBe(50)

    // Convert back from screen to DXF
    const dxfPos = screenToDxf(screenPos.px, screenPos.py, container, img, extent)
    expect(dxfPos.x).toBeCloseTo(500, 1)
    expect(dxfPos.y).toBeCloseTo(500, 1)
  })

  it.each([
    { width: 500, height: 250, left: 10, top: 20 },
    { width: 250, height: 500, left: 30, top: 40 },
  ])('round-trips through object-contain letterboxing for $width x $height', (rect) => {
    const container = { getBoundingClientRect: () => rect }
    const img = { naturalWidth: 1500, naturalHeight: 1500 }
    const extent = { x_min: -50, x_max: 150, y_min: -100, y_max: 300 }

    const screenPos = dxfToScreenPct(35.5, 125.25, extent, container, img)
    const dxfPos = screenToDxf(
      rect.left + screenPos.px,
      rect.top + screenPos.py,
      container,
      img,
      extent,
    )

    expect(dxfPos.x).toBeCloseTo(35.5, 8)
    expect(dxfPos.y).toBeCloseTo(125.25, 8)
  })

  it('places a square image at the centre of a wide container', () => {
    const container = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 200 }),
    }
    const img = { naturalWidth: 1500, naturalHeight: 1500 }
    expect(fracToScreen(0, 0, container, img)).toEqual({ px: 100, py: 0, pctX: 25, pctY: 0 })
    expect(fracToScreen(1, 1, container, img)).toEqual({ px: 300, py: 200, pctX: 75, pctY: 100 })
  })
})

describe('render-safe viewport mapping', () => {
  it('matches object-contain placement without reading DOM elements', () => {
    const extent = { x_min: 0, x_max: 100, y_min: 0, y_max: 100 }
    const viewport = { width: 400, height: 200, imageWidth: 1500, imageHeight: 1500 }
    expect(dxfToViewportPct(0, 100, extent, viewport))
      .toEqual({ px: 100, py: 0, pctX: 25, pctY: 0 })
    expect(dxfToViewportPct(100, 0, extent, viewport))
      .toEqual({ px: 300, py: 200, pctX: 75, pctY: 100 })
  })
})
