import axios from 'axios'
import { resolveApiBaseUrl } from './vastuApi'

const BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  window.location.hostname,
)

export async function checkReportStatus() {
  try {
    const res = await axios.get(`${BASE_URL}/api/report/status`, { timeout: 5000 })
    return res.data
  } catch {
    return { llm_configured: false, model: 'gemini-2.5-flash' }
  }
}

export async function generateAIReport(analysisData, fileId = null, options = {}) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/report/generate`,
      {
        file_id: fileId,
        analysis_data: analysisData,
      },
      {
        signal: options.signal,
        timeout: 90000,
      },
    )
    return response.data
  } catch (error) {
    const serverDetail = error.response?.data?.detail
    const msg = typeof serverDetail === 'string' ? serverDetail : (error.message || 'Failed to generate AI report')
    throw new Error(msg)
  }
}

export function streamChatMessage(fileId, message, analysisData, reportData, callbacks = {}, options = {}) {
  const { onDelta, onDone, onError } = callbacks
  const controller = new AbortController()

  const signal = options.signal || controller.signal

  fetch(`${BASE_URL}/api/report/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_id: fileId || 'default-session',
      message: message,
      analysis_data: analysisData,
      report_data: reportData || null,
    }),
    signal: signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || `Server responded with ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete chunk in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const jsonStr = trimmed.replace('data: ', '').trim()
          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.delta && onDelta) {
              onDelta(parsed.delta)
            }
            if (parsed.done) {
              if (onDone) onDone(parsed)
              return
            }
          } catch (e) {
            console.error('Failed to parse SSE line:', jsonStr, e)
          }
        }
      }

      if (onDone) onDone({ done: true })
    })
    .catch((err) => {
      if (err.name === 'AbortError') return
      console.error('SSE chat error:', err)
      if (onError) onError(err)
    })

  return () => controller.abort()
}
