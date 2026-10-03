import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import OrientationStep from '../OrientationStep'

vi.mock('../CompassRose', () => ({
  default: ({ onNorthOffsetChange, onInteractionStart, onInteractionEnd }) => (
    <div>
      <button onClick={() => onNorthOffsetChange(0.1)}>Set compass decimal</button>
      <button onClick={() => { onInteractionStart(); onInteractionEnd() }}>Complete compass drag</button>
    </div>
  ),
}))

const baseProps = {
  previewImages: { floor_plan_img: 'preview' },
  previewIsCurrent: true,
  isPreviewLoading: false,
  drawingBounds: { min_x: 0, max_x: 100, min_y: 0, max_y: 100 },
  imageExtent: { x_min: -25, x_max: 125, y_min: -25, y_max: 125 },
  onEditStart: vi.fn(),
  onEditEnd: vi.fn(),
  onBack: vi.fn(),
  onNext: vi.fn(),
}

function Harness(props) {
  const [bearing, setBearing] = useState(props.initialBearing ?? 0)
  return (
    <OrientationStep
      {...baseProps}
      {...props}
      northOffset={bearing}
      onNorthOffsetChange={setBearing}
    />
  )
}

describe('OrientationStep', () => {
  it('accepts decimal bearings and wraps coarse changes deterministically', async () => {
    const user = userEvent.setup()
    render(<Harness initialBearing={359.5} />)
    const input = screen.getByRole('spinbutton', { name: 'Compass orientation in degrees' })

    fireEvent.change(input, { target: { value: '22.5' } })
    expect(input).toHaveValue(22.5)
    await user.click(screen.getByRole('button', { name: '+22.5° Coarse' }))
    expect(input).toHaveValue(45)
    await user.click(screen.getByRole('button', { name: 'Set compass decimal' }))
    expect(input).toHaveValue(0.1)
  })

  it('requires a current completed preview before continuing', () => {
    const { rerender } = render(<Harness previewIsCurrent={false} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    rerender(<Harness previewIsCurrent isPreviewLoading />)
    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled()
  })

  it('forwards compass drag transaction boundaries', async () => {
    const user = userEvent.setup()
    const onEditStart = vi.fn()
    const onEditEnd = vi.fn()
    render(<Harness onEditStart={onEditStart} onEditEnd={onEditEnd} />)
    await user.click(screen.getByRole('button', { name: 'Complete compass drag' }))
    expect(onEditStart).toHaveBeenCalledTimes(1)
    expect(onEditEnd).toHaveBeenCalledTimes(1)
  })
})
