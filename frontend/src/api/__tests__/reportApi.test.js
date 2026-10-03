import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { generateAIReport, checkReportStatus } from '../reportApi'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('reportApi client tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks report status successfully', async () => {
    axios.get.mockResolvedValueOnce({
      data: { llm_configured: true, model: 'gemini-2.5-flash' },
    })

    const status = await checkReportStatus()
    expect(status.llm_configured).toBe(true)
    expect(status.model).toBe('gemini-2.5-flash')
  })

  it('handles status check failure gracefully', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network error'))

    const status = await checkReportStatus()
    expect(status.llm_configured).toBe(false)
  })

  it('calls /api/report/generate with analysisData and fileId', async () => {
    const mockReport = {
      report_id: 'rep-1',
      compliance_percent: 70,
      room_analyses: [],
    }
    axios.post.mockResolvedValueOnce({ data: mockReport })

    const sampleAnalysis = { compliance_percent: 70, rows: [] }
    const result = await generateAIReport(sampleAnalysis, 'file-123')

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/report/generate'),
      {
        file_id: 'file-123',
        analysis_data: sampleAnalysis,
      },
      expect.any(Object),
    )
    expect(result.report_id).toBe('rep-1')
  })

  it('wraps server error detail if available', async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { detail: 'Custom error from backend' }, status: 400 },
    })

    await expect(generateAIReport({}, 'file-1')).rejects.toThrow('Custom error from backend')
  })
})
