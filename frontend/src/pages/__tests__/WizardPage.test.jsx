import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { analyzeFile, getPreview } from '../../api/vastuApi'
import { saveSession } from '../../utils/wizardSession'
import WizardPage from '../WizardPage'

vi.mock('../../api/vastuApi', () => ({
  analyzeFile: vi.fn(),
  getPreview: vi.fn(),
}))

vi.mock('../../components/MandalaBackground', () => ({ default: () => null }))
vi.mock('../../components/StepSidebar', () => ({ default: () => null }))
vi.mock('../../components/MobileStepper', () => ({ default: () => null }))
vi.mock('../../components/HistoryControls', () => ({ default: () => null }))
vi.mock('../../components/UploadStep', () => ({
  default: ({ onUploadSuccess }) => (
    <button onClick={() => onUploadSuccess({
      file_id: 'file-123',
      filename: 'synthetic.dxf',
      source_kind: 'dxf',
      rooms: [{
        room_id: 'parsed-room-a', type: 'Kitchen', x: 25, y: 25,
        confidence: 'high', source: 'parsed',
      }],
      drawing_bounds: { min_x: 0, max_x: 100, min_y: 0, max_y: 100, auto_cx: 50, auto_cy: 50 },
      image_extent: { x_min: -25, x_max: 125, y_min: -25, y_max: 125 },
    })}>
      Complete upload
    </button>
  ),
}))
vi.mock('../../components/OrientationStep', () => ({
  default: ({ onNext, onNorthOffsetChange, previewImages }) => (
    <div>
      <button onClick={onNext}>Confirm orientation</button>
      <button onClick={() => onNorthOffsetChange(22.5)}>Rotate north</button>
      {previewImages?.marker && <p>{previewImages.marker}</p>}
    </div>
  ),
}))
vi.mock('../../components/CenterPointStep', () => ({
  default: ({ onNext, onCenterStateChange, floorPlanImg, drawingBounds, imageExtent }) => (
    <div
      data-testid="center-canvas"
      data-image={floorPlanImg}
      data-max-x={drawingBounds?.max_x}
      data-extent-max-x={imageExtent?.x_max}
    >
      <button onClick={onNext}>Confirm centre</button>
      <button onClick={() => onCenterStateChange({
        centerMode: 'manual', manualCenter: { x: 40, y: 45 },
      })}>
        Change centre
      </button>
    </div>
  ),
}))
vi.mock('../../components/RoomLabelsStep', () => ({
  default: ({ isLoading, onSubmit, floorPlanImg, drawingBounds, imageExtent }) => (
    isLoading
      ? <p>Analysing rooms</p>
      : (
        <div
          data-testid="room-canvas"
          data-image={floorPlanImg}
          data-max-x={drawingBounds?.max_x}
          data-extent-max-x={imageExtent?.x_max}
        >
          <p>{floorPlanImg}</p><button onClick={onSubmit}>Submit rooms</button>
        </div>
      )
  ),
}))
vi.mock('../../components/ReportStep', () => ({
  default: () => <section aria-label="Analysis report" />,
}))

const analysisResponse = (marker = 'floor-plan', drawingMarker = marker) => ({
  rows: [{ room_id: 'parsed-room-a', room_type: 'Kitchen', actual_zone: 'SW', score: 0, max_score: 12 }],
  all_rooms: [{ room_id: 'parsed-room-a', type: 'Kitchen', x: 25, y: 25, confidence: 'high', source: 'parsed' }],
  active_rooms: [{ room_id: 'parsed-room-a', type: 'Kitchen', x: 25, y: 25, confidence: 'high', source: 'parsed' }],
  scored_rooms: [{
    room_id: 'parsed-room-a', type: 'Kitchen', room_type: 'Kitchen', x: 25, y: 25,
    confidence: 'high', source: 'parsed', actual_zone: 'SW', score: 0, max_score: 12,
  }],
  drawing_floor_plan_img: drawingMarker,
  drawing_bounds: { min_x: 0, max_x: 100, min_y: 0, max_y: 100 },
  drawing_image_extent: { x_min: -25, x_max: 125, y_min: -25, y_max: 125 },
  floor_plan_img: marker,
  zone_map_img: 'zone-map',
})

describe('wizard request freshness and transitions', () => {
  beforeEach(() => {
    analyzeFile.mockReset()
    getPreview.mockReset()
    getPreview.mockResolvedValue({
      floor_plan_img: 'preview-plan',
      effective_center: { x: 50, y: 50 },
      active_bounds: { min_x: 0, max_x: 100, min_y: 0, max_y: 100 },
      image_extent: { x_min: -25, x_max: 125, y_min: -25, y_max: 125 },
    })
    analyzeFile.mockResolvedValue(analysisResponse())
  })

  it('moves through upload, orientation, centre, room review, and report with stable IDs', async () => {
    const user = userEvent.setup()
    render(<WizardPage />)

    await user.click(screen.getByRole('button', { name: 'Complete upload' }))
    await user.click(screen.getByRole('button', { name: 'Confirm orientation' }))
    await user.click(screen.getByRole('button', { name: 'Confirm centre' }))

    const submitRooms = await screen.findByRole('button', { name: 'Submit rooms' })
    expect(analyzeFile).toHaveBeenCalledWith(
      'file-123',
      0,
      { center_mode: 'automatic', manual_center: null, house_boundary: null },
      [expect.objectContaining({ room_id: 'parsed-room-a', type: 'Kitchen' })],
      { signal: expect.any(AbortSignal) },
    )

    await user.click(submitRooms)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Analysis report' })).toBeInTheDocument())
    expect(analyzeFile).toHaveBeenCalledTimes(2)
  })

  it('keeps centre and room editing on the full drawing canvas', async () => {
    getPreview.mockResolvedValueOnce({
      marker: 'preview ready',
      drawing_floor_plan_img: 'stable-drawing',
      drawing_bounds: { min_x: 0, max_x: 100, min_y: 0, max_y: 100 },
      drawing_image_extent: { x_min: -25, x_max: 125, y_min: -25, y_max: 125 },
      floor_plan_img: 'boundary-clipped-preview',
      effective_center: { x: 30, y: 30 },
      active_bounds: { min_x: 10, max_x: 60, min_y: 10, max_y: 60 },
      image_extent: { x_min: 0, x_max: 70, y_min: 0, y_max: 70 },
    })
    analyzeFile.mockResolvedValueOnce(
      analysisResponse('boundary-clipped-analysis', 'stable-drawing'),
    )
    const user = userEvent.setup()
    render(<WizardPage />)

    await user.click(screen.getByRole('button', { name: 'Complete upload' }))
    await screen.findByText('preview ready', {}, { timeout: 1500 })
    await user.click(screen.getByRole('button', { name: 'Confirm orientation' }))

    const centerCanvas = screen.getByTestId('center-canvas')
    expect(centerCanvas).toHaveAttribute('data-image', 'stable-drawing')
    expect(centerCanvas).toHaveAttribute('data-max-x', '100')
    expect(centerCanvas).toHaveAttribute('data-extent-max-x', '125')

    await user.click(screen.getByRole('button', { name: 'Confirm centre' }))
    const roomCanvas = await screen.findByTestId('room-canvas')
    expect(roomCanvas).toHaveAttribute('data-image', 'stable-drawing')
    expect(roomCanvas).toHaveAttribute('data-max-x', '100')
    expect(roomCanvas).toHaveAttribute('data-extent-max-x', '125')
  })

  it('ignores preview A when newer preview B resolves first', async () => {
    let resolveFirst
    let resolveSecond
    getPreview
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
    const user = userEvent.setup()
    render(<WizardPage />)
    await user.click(screen.getByRole('button', { name: 'Complete upload' }))
    await waitFor(() => expect(getPreview).toHaveBeenCalledTimes(1), { timeout: 1500 })

    await user.click(screen.getByRole('button', { name: 'Rotate north' }))
    await waitFor(() => expect(getPreview).toHaveBeenCalledTimes(2), { timeout: 1500 })
    resolveSecond({ marker: 'new preview', floor_plan_img: 'new' })
    await screen.findByText('new preview')
    resolveFirst({ marker: 'stale preview', floor_plan_img: 'old' })
    await waitFor(() => expect(screen.queryByText('stale preview')).not.toBeInTheDocument())
    expect(screen.getByText('new preview')).toBeInTheDocument()
  })

  it('ignores an analysis invalidated by a newer centre transaction', async () => {
    let resolveFirst
    let resolveSecond
    analyzeFile
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
    const user = userEvent.setup()
    render(<WizardPage />)
    await user.click(screen.getByRole('button', { name: 'Complete upload' }))
    await user.click(screen.getByRole('button', { name: 'Confirm orientation' }))
    await user.click(screen.getByRole('button', { name: 'Confirm centre' }))
    await waitFor(() => expect(analyzeFile).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Change centre' }))
    await user.click(screen.getByRole('button', { name: 'Confirm centre' }))
    await waitFor(() => expect(analyzeFile).toHaveBeenCalledTimes(2))
    resolveSecond(analysisResponse('current-analysis'))
    await screen.findByText('current-analysis')
    resolveFirst(analysisResponse('stale-analysis'))
    await waitFor(() => expect(screen.queryByText('stale-analysis')).not.toBeInTheDocument())
    expect(screen.getByText('current-analysis')).toBeInTheDocument()
  })

  it('recovers a restored session cleanly when the backend cache expired', async () => {
    saveSession({
      currentStep: 1,
      fileId: 'expired-file',
      filename: 'expired.dxf',
      sourceKind: 'dxf',
      rooms: [{
        room_id: 'room-a', type: 'Kitchen', x: 1, y: 2,
        confidence: 'high', source: 'parsed',
      }],
      originalRooms: [{
        room_id: 'room-a', type: 'Kitchen', x: 1, y: 2,
        confidence: 'high', source: 'parsed',
      }],
      drawingBounds: { min_x: 0, max_x: 10, min_y: 0, max_y: 10 },
      imageExtent: { x_min: -2, x_max: 12, y_min: -2, y_max: 12 },
      northOffset: 0,
      centerMode: 'automatic',
      manualCenter: null,
      houseBoundary: null,
    })
    getPreview.mockRejectedValue(Object.assign(new Error('File not found. Please upload again.'), {
      sessionExpired: true,
      status: 404,
    }))

    render(<WizardPage />)
    await screen.findByText('Your previous session expired. Please upload your floor plan again.', {}, { timeout: 1500 })
    expect(screen.getByRole('button', { name: 'Complete upload' })).toBeInTheDocument()
  })
})
