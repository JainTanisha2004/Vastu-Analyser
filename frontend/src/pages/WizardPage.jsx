import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MandalaBackground from '../components/MandalaBackground'
import StepSidebar from '../components/StepSidebar'
import MobileStepper from '../components/MobileStepper'
import HistoryControls from '../components/HistoryControls'
import UploadStep from '../components/UploadStep'
import OrientationStep from '../components/OrientationStep'
import CenterPointStep from '../components/CenterPointStep'
import RoomLabelsStep from '../components/RoomLabelsStep'
import ReportStep from '../components/ReportStep'
import { analyzeFile, getPreview } from '../api/vastuApi'
import {
  createAnalysisFingerprint,
  createRoomId,
} from '../utils/analysisInput'
import { createEditorHistory } from '../utils/editorHistory'
import { clearSaved, loadSaved, saveSession } from '../utils/wizardSession'

const emptyEditableState = () => ({
  rooms: [],
  northOffset: 0,
  centerMode: 'automatic',
  manualCenter: null,
  houseBoundary: null,
})

const editableFromSession = (session) => ({
  rooms: session?.rooms ?? [],
  northOffset: session?.northOffset ?? 0,
  centerMode: session?.centerMode ?? 'automatic',
  manualCenter: session?.manualCenter ?? null,
  houseBoundary: session?.houseBoundary ?? null,
})

const isCanceled = (error) => (
  error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED'
)

export default function WizardPage() {
  const [savedSession] = useState(() => loadSaved())
  const [history] = useState(() => createEditorHistory(editableFromSession(savedSession)))
  const [editable, setEditable] = useState(() => history.getSnapshot())
  const [, bumpHistory] = useState(0)

  const [currentStep, setCurrentStep] = useState(savedSession?.currentStep ?? 0)
  const [fileId, setFileId] = useState(savedSession?.fileId ?? null)
  const [filename, setFilename] = useState(savedSession?.filename ?? '')
  const [sourceKind, setSourceKind] = useState(savedSession?.sourceKind ?? 'dxf')
  const [originalRooms, setOriginalRooms] = useState(savedSession?.originalRooms ?? [])
  const [drawingBounds, setDrawingBounds] = useState(savedSession?.drawingBounds ?? null)
  const [imageExtent, setImageExtent] = useState(savedSession?.imageExtent ?? null)
  const [previewImages, setPreviewImages] = useState(null)
  const [previewFingerprint, setPreviewFingerprint] = useState(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(
    savedSession?.fileId && savedSession.currentStep >= 3,
  ))
  const [error, setError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  const previewSequence = useRef(0)
  const previewAbort = useRef(null)
  const analysisSequence = useRef(0)
  const analysisAbort = useRef(null)
  const analysisFingerprint = useRef(null)

  const {
    rooms,
    northOffset,
    centerMode,
    manualCenter,
    houseBoundary,
  } = editable

  const centerParams = useMemo(() => ({
    center_mode: centerMode,
    manual_center: manualCenter,
    house_boundary: houseBoundary,
  }), [centerMode, manualCenter, houseBoundary])

  const currentFingerprint = useMemo(() => {
    if (!fileId) return null
    try {
      return createAnalysisFingerprint(fileId, northOffset, centerParams, rooms)
    } catch {
      return null
    }
  }, [fileId, northOffset, centerParams, rooms])

  useEffect(() => {
    if (!fileId) {
      clearSaved()
      return
    }
    saveSession({
      currentStep,
      fileId,
      filename,
      sourceKind,
      rooms,
      originalRooms,
      drawingBounds,
      imageExtent,
      northOffset,
      centerMode,
      manualCenter,
      houseBoundary,
    })
  }, [
    currentStep, fileId, filename, sourceKind, rooms, originalRooms,
    drawingBounds, imageExtent, northOffset, centerMode, manualCenter,
    houseBoundary,
  ])

  const invalidateAnalysis = useCallback(() => {
    analysisSequence.current += 1
    analysisAbort.current?.abort()
    analysisAbort.current = null
    analysisFingerprint.current = null
    setAnalysisData(null)
    setIsLoading(false)
  }, [])

  const applyEdit = useCallback((updater) => {
    const next = history.apply(updater)
    setEditable(next)
    bumpHistory((version) => version + 1)
    invalidateAnalysis()
    setError(null)
  }, [history, invalidateAnalysis])

  const beginEdit = useCallback(() => {
    history.beginTransaction()
  }, [history])

  const endEdit = useCallback(() => {
    setEditable(history.commitTransaction())
    bumpHistory((version) => version + 1)
  }, [history])

  const applyHistorySnapshot = useCallback((snapshot) => {
    setEditable(snapshot)
    bumpHistory((version) => version + 1)
    invalidateAnalysis()
    setError(null)
  }, [invalidateAnalysis])

  const resetEditor = useCallback((nextState = emptyEditableState()) => {
    setEditable(history.reset(nextState))
    bumpHistory((version) => version + 1)
  }, [history])

  const clearRequestState = useCallback(() => {
    previewSequence.current += 1
    previewAbort.current?.abort()
    previewAbort.current = null
    setPreviewImages(null)
    setPreviewFingerprint(null)
    setIsPreviewLoading(false)
    invalidateAnalysis()
  }, [invalidateAnalysis])

  const clearPlanSession = useCallback(() => {
    clearSaved()
    clearRequestState()
    setFileId(null)
    setFilename('')
    setSourceKind('dxf')
    setOriginalRooms([])
    setDrawingBounds(null)
    setImageExtent(null)
    resetEditor()
    setCurrentStep(0)
    setError(null)
  }, [clearRequestState, resetEditor])

  const handleSessionExpired = useCallback(() => {
    clearPlanSession()
    setSessionExpired(true)
  }, [clearPlanSession])

  const handleStartOver = useCallback(() => {
    clearPlanSession()
    setSessionExpired(false)
  }, [clearPlanSession])

  const undo = useCallback(() => {
    if (history.canUndo()) applyHistorySnapshot(history.undo())
  }, [history, applyHistorySnapshot])

  const redo = useCallback(() => {
    if (history.canRedo()) applyHistorySnapshot(history.redo())
  }, [history, applyHistorySnapshot])

  const historyEnabled = currentStep >= 1 && currentStep <= 3
  const canUndo = historyEnabled && history.canUndo()
  const canRedo = historyEnabled && history.canRedo()

  useEffect(() => {
    if (!historyEnabled) return undefined
    const onKeyDown = (event) => {
      const tagName = (event.target?.tagName || '').toLowerCase()
      if (
        ['input', 'textarea', 'select'].includes(tagName)
        || event.target?.isContentEditable
      ) return
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [historyEnabled, undo, redo])

  // Preview owns one monotonic sequence for both orientation and centre steps.
  // A late response is ignored even when cancellation loses a network race.
  useEffect(() => {
    if (!fileId || !currentFingerprint || ![1, 2].includes(currentStep)) return undefined
    if (centerMode === 'boundary' && (!houseBoundary || houseBoundary.length < 3)) {
      previewAbort.current?.abort()
      setIsPreviewLoading(false)
      return undefined
    }
    if (previewFingerprint === currentFingerprint) return undefined

    const sequence = previewSequence.current + 1
    previewSequence.current = sequence
    previewAbort.current?.abort()
    const controller = new AbortController()
    previewAbort.current = controller
    setIsPreviewLoading(true)
    const delay = currentStep === 1 ? 400 : 180
    const timer = window.setTimeout(async () => {
      try {
        const data = await getPreview(
          fileId,
          northOffset,
          centerParams,
          rooms,
          { signal: controller.signal },
        )
        if (sequence !== previewSequence.current || controller.signal.aborted) return
        setPreviewImages(data)
        setPreviewFingerprint(currentFingerprint)
        setError(null)
      } catch (previewError) {
        if (isCanceled(previewError)) return
        if (previewError.sessionExpired) {
          handleSessionExpired()
          return
        }
        if (sequence === previewSequence.current) {
          setError(previewError.message || 'Preview failed. Check the current geometry and try again.')
        }
      } finally {
        if (sequence === previewSequence.current) setIsPreviewLoading(false)
      }
    }, delay)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    fileId, currentStep, currentFingerprint, previewFingerprint, northOffset,
    centerParams, rooms, centerMode, houseBoundary, handleSessionExpired,
  ])

  const runAnalysis = useCallback(async () => {
    if (!fileId) return false
    const snapshot = history.getSnapshot()
    const params = {
      center_mode: snapshot.centerMode,
      manual_center: snapshot.manualCenter,
      house_boundary: snapshot.houseBoundary,
    }
    let fingerprint
    try {
      fingerprint = createAnalysisFingerprint(
        fileId, snapshot.northOffset, params, snapshot.rooms,
      )
    } catch (inputError) {
      setError(inputError.message)
      return false
    }

    const sequence = analysisSequence.current + 1
    analysisSequence.current = sequence
    analysisAbort.current?.abort()
    const controller = new AbortController()
    analysisAbort.current = controller
    setIsLoading(true)
    setError(null)
    try {
      const data = await analyzeFile(
        fileId,
        snapshot.northOffset,
        params,
        snapshot.rooms,
        { signal: controller.signal },
      )
      if (sequence !== analysisSequence.current || controller.signal.aborted) return false
      const latest = history.getSnapshot()
      const latestFingerprint = createAnalysisFingerprint(
        fileId,
        latest.northOffset,
        {
          center_mode: latest.centerMode,
          manual_center: latest.manualCenter,
          house_boundary: latest.houseBoundary,
        },
        latest.rooms,
      )
      if (latestFingerprint !== fingerprint) return false
      analysisFingerprint.current = fingerprint
      setAnalysisData(data)
      return true
    } catch (analysisError) {
      if (isCanceled(analysisError)) return false
      if (analysisError.sessionExpired) {
        handleSessionExpired()
        return false
      }
      if (sequence === analysisSequence.current) {
        setError(analysisError.message || 'Analysis failed. Please try again.')
      }
      return false
    } finally {
      if (sequence === analysisSequence.current) setIsLoading(false)
    }
  }, [fileId, history, handleSessionExpired])

  const didRehydrate = useRef(false)
  useEffect(() => {
    if (didRehydrate.current) return
    didRehydrate.current = true
    if (fileId && currentStep >= 3) runAnalysis()
  }, [fileId, currentStep, runAnalysis])

  const handleUploadSuccess = (data) => {
    const uploadedRooms = (data.rooms || []).map((room) => ({
      ...room,
      room_id: room.room_id || createRoomId('legacy-parsed'),
      source: room.source || 'parsed',
    }))
    const nextEditable = {
      rooms: uploadedRooms,
      northOffset: 0,
      centerMode: 'automatic',
      manualCenter: null,
      houseBoundary: null,
    }
    clearRequestState()
    setSessionExpired(false)
    setFileId(data.file_id)
    setFilename(data.filename || '')
    setSourceKind(data.source_kind || 'dxf')
    setOriginalRooms(uploadedRooms.map((room) => ({ ...room })))
    setDrawingBounds(data.drawing_bounds)
    setImageExtent(data.image_extent)
    resetEditor(nextEditable)
    setCurrentStep(1)
  }

  const handleCenterNext = async () => {
    if (isLoading) return
    if (await runAnalysis()) setCurrentStep(3)
  }

  const handleRoomLabelsSubmit = async () => {
    if (isLoading) return
    if (await runAnalysis()) setCurrentStep(4)
  }

  const goBack = () => {
    if (currentStep === 1) handleStartOver()
    else setCurrentStep((step) => Math.max(0, step - 1))
  }

  const previewIsCurrent = Boolean(
    currentFingerprint && previewFingerprint === currentFingerprint,
  )
  const freshAnalysis = analysisFingerprint.current === currentFingerprint
    ? analysisData
    : null
  const editorResponse = freshAnalysis || previewImages
  const editorFloorPlanImg = (
    editorResponse?.drawing_floor_plan_img || editorResponse?.floor_plan_img
  )
  const editorDrawingBounds = editorResponse?.drawing_bounds || drawingBounds
  const editorImageExtent = editorResponse?.drawing_image_extent || imageExtent

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <UploadStep onUploadSuccess={handleUploadSuccess} />
      case 1:
        return (
          <OrientationStep
            northOffset={northOffset}
            onNorthOffsetChange={(value) => applyEdit((state) => ({ ...state, northOffset: value }))}
            previewImages={previewImages}
            previewIsCurrent={previewIsCurrent}
            isPreviewLoading={isPreviewLoading}
            drawingBounds={drawingBounds}
            imageExtent={imageExtent}
            onEditStart={beginEdit}
            onEditEnd={endEdit}
            onBack={goBack}
            onNext={() => setCurrentStep(2)}
          />
        )
      case 2:
        return (
          <CenterPointStep
            floorPlanImg={editorFloorPlanImg}
            imageExtent={editorImageExtent}
            drawingBounds={editorDrawingBounds}
            effectiveCenter={previewIsCurrent ? previewImages?.effective_center : null}
            centerMode={centerMode}
            manualCenter={manualCenter}
            houseBoundary={houseBoundary}
            onCenterStateChange={(patch) => applyEdit((state) => ({ ...state, ...patch }))}
            onEditStart={beginEdit}
            onEditEnd={endEdit}
            isSubmitting={isLoading}
            onBack={goBack}
            onNext={handleCenterNext}
          />
        )
      case 3:
        return (
          <RoomLabelsStep
            isLoading={isLoading}
            error={error}
            floorPlanImg={editorFloorPlanImg}
            rooms={rooms}
            drawingBounds={editorDrawingBounds}
            imageExtent={editorImageExtent}
            onRoomsUpdate={(nextRooms) => applyEdit((state) => ({ ...state, rooms: nextRooms }))}
            onEditStart={beginEdit}
            onEditEnd={endEdit}
            onRetry={runAnalysis}
            onBack={goBack}
            onSubmit={handleRoomLabelsSubmit}
          />
        )
      case 4:
        return (
          <ReportStep
            analysisData={freshAnalysis}
            isLoading={isLoading}
            error={error}
            floorPlanImg={freshAnalysis?.floor_plan_img || previewImages?.floor_plan_img}
            northOffset={northOffset}
            drawingBounds={freshAnalysis?.active_bounds || drawingBounds}
            imageExtent={freshAnalysis?.image_extent || imageExtent}
            rooms={rooms}
            originalRooms={originalRooms}
            filename={filename}
            onRetry={runAnalysis}
            onStartOver={handleStartOver}
            onBack={goBack}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-5 md:p-6 relative overflow-x-hidden">
      <MandalaBackground />

      {error && (
        <div role="alert" className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-white border border-red-100 rounded-2xl px-5 py-3.5 shadow-xl flex items-center gap-3 animate-fadeSlideDown">
          <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-red-500 text-sm">!</span>
          </div>
          <p className="text-stone-700 text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="text-stone-300 hover:text-stone-500 ml-2 cursor-pointer transition-colors" aria-label="Dismiss">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg>
          </button>
        </div>
      )}

      {sessionExpired && (
        <div role="status" className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-white border border-amber-200 rounded-2xl px-5 py-3.5 shadow-xl flex items-center gap-3 animate-fadeSlideDown">
          <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-amber-500 text-sm">!</span></div>
          <p className="text-stone-700 text-sm font-medium">Your previous session expired. Please upload your floor plan again.</p>
          <button onClick={() => setSessionExpired(false)} className="text-stone-300 hover:text-stone-500 ml-2 cursor-pointer transition-colors" aria-label="Dismiss">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg>
          </button>
        </div>
      )}

      <div className="relative z-10 flex flex-col lg:flex-row gap-4 lg:gap-5 w-full max-w-[1100px] lg:min-h-[640px]">
        <div className="hidden lg:flex w-[280px] flex-shrink-0 bg-white/95 backdrop-blur-sm rounded-3xl flex-col overflow-hidden" style={{ boxShadow: '0 4px 40px rgba(124, 45, 18, 0.08), 0 1px 3px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.7)' }}>
          <div className="flex-1 min-h-0"><StepSidebar currentStep={currentStep} /></div>
          {historyEnabled && (
            <div className="px-6 pb-6 flex-shrink-0"><HistoryControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} /></div>
          )}
        </div>

        <div className="flex-1 bg-white/95 backdrop-blur-sm rounded-3xl flex flex-col min-w-0 overflow-hidden" style={{ boxShadow: '0 4px 40px rgba(124, 45, 18, 0.08), 0 1px 3px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.7)', padding: '20px', minHeight: 560 }}>
          <div className="lg:hidden mb-3 flex-shrink-0 flex items-center justify-between gap-3">
            <MobileStepper currentStep={currentStep} />
            {historyEnabled && <HistoryControls compact canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />}
          </div>
          <div className="flex-1 min-h-0">{renderStep()}</div>
        </div>
      </div>
    </div>
  )
}
