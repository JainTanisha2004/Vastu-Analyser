import axios from 'axios'
import { buildAnalysisRequest, toBackendNorthOffset } from '../utils/analysisInput'

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']
const DEFAULT_TIMEOUT = 90000

export { toBackendNorthOffset }

export function resolveApiBaseUrl(configuredUrl, hostname) {
  return configuredUrl
    || (LOCAL_HOSTS.includes(hostname)
      ? 'http://localhost:8000'
      : 'https://vastu-analyser-backend.onrender.com')
}

const BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  window.location.hostname,
)

function isCancellation(error) {
  return error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED'
}

function wrapError(error, fallbackMessage) {
  const status = error.response?.status
  const serverDetail = error.response?.data?.detail
  const message = typeof serverDetail === 'string' ? serverDetail : fallbackMessage
  const wrapped = new Error(message)
  wrapped.sessionExpired = status === 404
  wrapped.status = status
  return wrapped
}

export async function uploadFile(file, options = {}) {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const response = await axios.post(`${BASE_URL}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: options.signal,
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  } catch (error) {
    if (isCancellation(error)) throw error
    if (error.code === 'ECONNABORTED') {
      throw new Error('Upload timed out. Please check your connection and try again.')
    }
    throw wrapError(error, 'Upload failed')
  }
}

export async function analyzeFile(fileId, northOffset, centerParams, rooms, options = {}) {
  const payload = buildAnalysisRequest(fileId, northOffset, centerParams, rooms)
  try {
    const response = await axios.post(`${BASE_URL}/api/analyze`, payload, {
      signal: options.signal,
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  } catch (error) {
    if (isCancellation(error)) throw error
    if (error.code === 'ECONNABORTED') {
      throw new Error('Analysis timed out. Please try again.')
    }
    throw wrapError(error, 'Analysis failed')
  }
}

export async function getPreview(fileId, northOffset, centerParams, rooms, options = {}) {
  const payload = buildAnalysisRequest(fileId, northOffset, centerParams, rooms)
  try {
    const response = await axios.post(`${BASE_URL}/api/preview`, payload, {
      signal: options.signal,
      timeout: DEFAULT_TIMEOUT,
    })
    return response.data
  } catch (error) {
    if (isCancellation(error)) throw error
    if (error.code === 'ECONNABORTED') {
      throw new Error('Preview timed out. Please try again.')
    }
    throw wrapError(error, 'Preview failed')
  }
}
