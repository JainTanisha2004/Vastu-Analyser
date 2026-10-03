import React from 'react'

const STEPS = [
  {
    title: 'Upload Floor Plan',
    desc: 'Upload your floor plan DXF file. Drag and drop or click to get started.',
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    title: 'Set Orientation',
    desc: "Rotate the compass to match your property's true north. Drag the ring, type an exact degree, or nudge in fine/coarse steps.",
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="12,2 10,8 14,8" fill={color} stroke="none" />
        <line x1="12" y1="8" x2="12" y2="16" />
      </svg>
    ),
  },
  {
    title: 'Confirm Center Point',
    desc: "Verify the building's center point (Brahmasthan). Adjust it if needed for correct energy mapping.",
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    title: 'Verify Room Labels',
    desc: 'Review detected room labels on your floor plan. Add missing rooms or remove incorrect ones.',
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    ),
  },
  {
    title: 'Get Report',
    desc: 'View your instant Vaastu compliance summary with insights, scores, and recommendations.',
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </svg>
    ),
  },
]

export default function StepSidebar({ currentStep }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '32px 24px 32px 24px',
      }}
    >
      {/* Title */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          className="playfair"
          style={{
            fontSize: '26px',
            fontWeight: 800,
            color: '#1C1917',
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
          }}
        >
          Generate Home&apos;s<br />Vaastu Report
        </h1>
      </div>

      {/* Steps */}
      <div style={{ position: 'relative', flex: 1 }}>
        {STEPS.map((step, i) => {
          const isActive   = i === currentStep
          const isComplete = i < currentStep
          const isPending  = i > currentStep
          const iconColor  = isPending ? '#A8A29E' : '#FFFFFF'
          const titleColor = isPending ? '#78716C' : '#EA580C'

          return (
            <div
              key={i}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: '16px',                   // <-- gap between circle and text
                paddingBottom: i < STEPS.length - 1 ? '28px' : '0',
              }}
            >
              {/* Connector line — drawn from bottom of this circle to top of next */}
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '19px',              // center of 40px circle
                    top: '40px',
                    width: '2px',
                    bottom: '0',
                    backgroundColor: isComplete ? '#EA580C' : '#E7E5E4',
                    transition: 'background-color 0.4s ease',
                  }}
                />
              )}

              {/* Circle badge — flex-shrink-0 keeps it from being squished */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isPending ? 'transparent' : '#EA580C',
                    border: isPending ? '2px solid #D6D3D1' : '2px solid #EA580C',
                    boxShadow: isActive ? '0 0 0 4px rgba(234, 88, 12, 0.15)' : 'none',
                    transition: 'all 0.3s ease',
                    zIndex: 1,
                  }}
                >
                  {step.icon(iconColor)}
                </div>
                {isComplete && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#16A34A',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Text block — sits in its own column, never overlaps circle */}
              <div
                style={{
                  paddingTop: '10px',          // vertically align text with circle center
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <p
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: titleColor,
                    lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                    marginBottom: '4px',
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#A8A29E',
                    lineHeight: 1.5,
                    maxWidth: '195px',
                  }}
                >
                  {step.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}