import React from 'react'
import CompassRose from './CompassRose'
import { normalizeDegrees } from '../utils/analysisInput'

export default function OrientationStep({
  northOffset,
  onNorthOffsetChange,
  previewImages,
  previewIsCurrent,
  isPreviewLoading,
  drawingBounds,
  imageExtent,
  onEditStart,
  onEditEnd,
  onBack,
  onNext,
}) {
  const adjustAngle = (delta) => {
    onNorthOffsetChange(Math.round(normalizeDegrees(northOffset + delta) * 10) / 10)
  }

  const handleInputChange = (event) => {
    if (event.target.value === '') return
    const value = Number(event.target.value)
    if (Number.isFinite(value)) {
      onNorthOffsetChange(Math.round(normalizeDegrees(value) * 10) / 10)
    }
  }

  const canContinue = Boolean(previewImages && previewIsCurrent && !isPreviewLoading)

  return (
    <div className="animate-fadeSlideIn" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-9 overflow-y-auto lg:overflow-hidden py-2">
        <div className="flex-shrink-0" style={{ width: 'min(78vw, 400px)', maxWidth: '400px', aspectRatio: '1 / 1' }}>
          <CompassRose
            size="100%"
            northOffset={northOffset}
            floorPlanImg={previewImages?.drawing_floor_plan_img || previewImages?.floor_plan_img}
            drawingBounds={previewImages?.drawing_bounds || drawingBounds}
            imageExtent={previewImages?.drawing_image_extent || imageExtent}
            interactive
            onNorthOffsetChange={onNorthOffsetChange}
            onInteractionStart={onEditStart}
            onInteractionEnd={onEditEnd}
          />
        </div>

        <div className="flex flex-col items-center gap-6 flex-shrink-0">
          <div className="flex flex-col items-center gap-2">
            <label className="text-stone-600 text-xs font-bold uppercase tracking-wider">North direction</label>
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm">
              <input
                type="number"
                step="any"
                value={northOffset}
                onChange={handleInputChange}
                aria-label="Compass orientation in degrees"
                className="w-20 text-center font-bold text-stone-800 text-lg bg-transparent focus:outline-none"
              />
              <span className="text-stone-400 font-bold text-lg">°</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '130px' }}>
            <button type="button" onClick={() => adjustAngle(-22.5)} className="py-2.5 px-4 bg-stone-800 hover:bg-stone-700 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer text-center">-22.5° Coarse</button>
            <button type="button" onClick={() => adjustAngle(-1)} className="py-2.5 px-4 bg-stone-800 hover:bg-stone-700 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer text-center">-1° Fine</button>
            <button type="button" onClick={() => adjustAngle(1)} className="py-2.5 px-4 bg-stone-800 hover:bg-stone-700 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer text-center">+1° Fine</button>
            <button type="button" onClick={() => adjustAngle(22.5)} className="py-2.5 px-4 bg-stone-800 hover:bg-stone-700 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer text-center">+22.5° Coarse</button>
            <button type="button" onClick={() => onNorthOffsetChange(0)} className="py-2.5 px-4 bg-red-600 hover:bg-red-500 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer text-center">Reset to 0°</button>
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderTop: '1px solid #FED7AA', backgroundColor: '#FFFBEB', borderRadius: '0 0 12px 12px', padding: '12px 16px', minHeight: '60px', overflow: 'hidden' }}>
        <p style={{ fontSize: '13px', color: '#78716C', lineHeight: 1.5, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontWeight: 700, color: '#57534E' }}>Tip:</span>{' '}
          Drag the compass ring, use the buttons, or type a decimal bearing to align North on your plan.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <button onClick={onBack} className="min-w-[100px] h-11 px-[22px] rounded-[10px] border-0 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold cursor-pointer transition-colors">Back</button>
          <button
            onClick={onNext}
            disabled={!canContinue}
            aria-busy={isPreviewLoading || undefined}
            className="min-w-[100px] h-11 px-[22px] rounded-[10px] border-0 text-white text-sm font-bold transition-all"
            style={{
              backgroundColor: canContinue ? '#EAB308' : '#D1D5DB',
              cursor: canContinue ? 'pointer' : 'not-allowed',
              boxShadow: canContinue ? '0 3px 10px rgba(234,179,8,0.3)' : 'none',
            }}
          >
            {isPreviewLoading ? 'Updating…' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
