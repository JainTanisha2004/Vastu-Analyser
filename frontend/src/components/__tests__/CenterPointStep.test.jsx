import React from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CenterPointStep from '../CenterPointStep'

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  }
})

const baseProps = {
  floorPlanImg: null,
  imageExtent: { x_min: -25, x_max: 125, y_min: -25, y_max: 125 },
  drawingBounds: {
    min_x: 0, max_x: 100, min_y: 0, max_y: 100, auto_cx: 50, auto_cy: 50,
  },
  effectiveCenter: { x: 42.5, y: 57.25 },
  centerMode: 'automatic',
  manualCenter: null,
  houseBoundary: null,
  onCenterStateChange: vi.fn(),
  onEditStart: vi.fn(),
  onEditEnd: vi.fn(),
  onBack: vi.fn(),
  onNext: vi.fn(),
}

describe('CenterPointStep', () => {
  it('initializes manual mode from the latest backend effective centre', async () => {
    const user = userEvent.setup()
    const onCenterStateChange = vi.fn()
    render(<CenterPointStep {...baseProps} onCenterStateChange={onCenterStateChange} />)

    await user.click(screen.getByRole('button', { name: 'Manual Position' }))
    expect(onCenterStateChange).toHaveBeenCalledWith({
      centerMode: 'manual',
      manualCenter: { x: 42.5, y: 57.25 },
    })
  })

  it('does not continue with an incomplete boundary or null manual centre', () => {
    const { rerender } = render(
      <CenterPointStep {...baseProps} centerMode="boundary" houseBoundary={[{ x: 0, y: 0 }]} />,
    )
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    rerender(<CenterPointStep {...baseProps} centerMode="manual" manualCenter={null} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
