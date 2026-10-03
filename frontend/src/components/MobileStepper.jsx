import React from 'react'

const STEP_TITLES = [
  'Upload Floor Plan',
  'Set Orientation',
  'Confirm Center',
  'Verify Room Labels',
  'Get Report',
]

// Compact horizontal step indicator shown only on small screens.
export default function MobileStepper({ currentStep }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        {STEP_TITLES.map((_, i) => {
          const isComplete = i < currentStep
          const isActive = i === currentStep
          return (
            <React.Fragment key={i}>
              <div
                className="rounded-full flex-shrink-0 transition-all duration-300"
                style={{
                  width: isActive ? 22 : 8,
                  height: 8,
                  backgroundColor: isComplete || isActive ? '#EA580C' : '#E7E5E4',
                }}
              />
              {i < STEP_TITLES.length - 1 && (
                <div className="flex-1 h-[2px] rounded-full" style={{ backgroundColor: i < currentStep ? '#EA580C' : '#F0EEEC' }} />
              )}
            </React.Fragment>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-orange-600">Step {currentStep + 1} of {STEP_TITLES.length}</span>
        <span className="text-[11px] text-stone-400 truncate">· {STEP_TITLES[currentStep]}</span>
      </div>
    </div>
  )
}
