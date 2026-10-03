import { beforeEach, describe, expect, it, vi } from 'vitest'

import axios from 'axios'
import {
  analyzeFile,
  getPreview,
  resolveApiBaseUrl,
  toBackendNorthOffset,
  uploadFile,
} from '../vastuApi'

vi.mock('axios', () => ({
  default: { post: vi.fn() },
}))

describe('API base URL selection', () => {
  it('prefers an explicitly configured deployment URL', () => {
    expect(resolveApiBaseUrl('https://api.example.test', 'localhost')).toBe('https://api.example.test')
  })

  it.each(['localhost', '127.0.0.1', '0.0.0.0'])('uses the local backend for %s', (hostname) => {
    expect(resolveApiBaseUrl('', hostname)).toBe('http://localhost:8000')
  })

  it('uses the hosted backend for a deployed frontend hostname', () => {
    expect(resolveApiBaseUrl(undefined, 'vastu-analyser.vercel.app'))
      .toBe('https://vastu-analyser-backend.onrender.com')
  })
})

describe('frontend-to-backend north angle conversion', () => {
  it.each([
    [0, 0],
    [22.5, 337.5],
    [359.5, 0.5],
    [360, 0],
  ])('maps %s degrees to %s degrees', (frontendAngle, backendAngle) => {
    expect(toBackendNorthOffset(frontendAngle)).toBe(backendAngle)
  })
})

describe('request and error contracts', () => {
  beforeEach(() => {
    axios.post.mockReset()
  })

  it('sends the canonical room and centre contract without UI-only fields', async () => {
    axios.post.mockResolvedValue({ data: { rows: [] } })
    const rooms = [{
      room_id: 'room-stable-id',
      type: 'Kitchen',
      x: 12.25,
      y: 33.75,
      confidence: 'medium',
      source: 'manual',
      isNew: true,
    }]
    const center = {
      center_mode: 'manual',
      manual_center: { x: 50, y: 45 },
      house_boundary: null,
    }

    await analyzeFile('file-123', 22.5, center, rooms)

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8000/api/analyze',
      {
        file_id: 'file-123',
        north_offset: 337.5,
        rooms: [{
          room_id: 'room-stable-id', type: 'Kitchen', x: 12.25, y: 33.75,
          confidence: 'medium', source: 'manual',
        }],
        ...center,
      },
      { signal: undefined, timeout: 90000 },
    )
  })

  it('keeps omitted and explicitly empty room arrays distinct', async () => {
    axios.post.mockResolvedValue({ data: {} })
    await analyzeFile('file-123', 0, {}, undefined)
    await analyzeFile('file-123', 0, {}, [])

    expect(axios.post.mock.calls[0][1].rooms).toBeUndefined()
    expect(axios.post.mock.calls[1][1].rooms).toEqual([])
  })

  it('marks analyze 404 responses as expired sessions', async () => {
    axios.post.mockRejectedValue({
      response: { status: 404, data: { detail: 'File not found. Please upload again.' } },
    })

    await expect(analyzeFile('expired', 0, {}, [])).rejects.toMatchObject({
      message: 'File not found. Please upload again.',
      sessionExpired: true,
      status: 404,
    })
  })

  it('keeps ordinary network failures distinct from session expiry', async () => {
    axios.post.mockRejectedValue(new Error('socket closed'))
    await expect(analyzeFile('file-123', 0, {}, [])).rejects.toMatchObject({
      message: 'Analysis failed',
      sessionExpired: false,
    })
  })

  it('provides a specific upload timeout message', async () => {
    axios.post.mockRejectedValue({ code: 'ECONNABORTED' })
    await expect(uploadFile(new File(['0'], 'plan.dxf'))).rejects.toThrow(
      'Upload timed out. Please check your connection and try again.',
    )
  })

  it('passes preview cancellation through unchanged with the AbortSignal', async () => {
    const controller = new AbortController()
    const canceled = Object.assign(new Error('canceled'), {
      name: 'CanceledError',
      code: 'ERR_CANCELED',
    })
    axios.post.mockRejectedValue(canceled)

    await expect(getPreview('file-123', 0, {}, [], { signal: controller.signal }))
      .rejects.toBe(canceled)
    expect(axios.post.mock.calls[0][2]).toEqual({ signal: controller.signal, timeout: 90000 })
  })

  it('maps preview 404s to the same expired-session contract as analyze', async () => {
    axios.post.mockRejectedValue({
      response: { status: 404, data: { detail: 'File not found. Please upload again.' } },
    })
    await expect(getPreview('expired', 0, {}, []))
      .rejects.toMatchObject({ sessionExpired: true, status: 404 })
  })
})
