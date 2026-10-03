import React from 'react'

const UndoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
  </svg>
)

const RedoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9a5 5 0 0 0 0 10h4" />
  </svg>
)

function Btn({ disabled, onClick, title, children, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex items-center justify-center gap-1.5 rounded-xl border font-bold text-[11px] transition-all ${compact ? 'h-8 w-8' : 'h-8 flex-1 px-2'} ${
        disabled
          ? 'border-stone-100 text-stone-300 cursor-not-allowed'
          : 'border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-800 cursor-pointer'
      }`}
    >
      {children}
    </button>
  )
}

// Undo / Redo control. `compact` renders icon-only buttons (used on mobile).
export default function HistoryControls({ canUndo, canRedo, onUndo, onRedo, compact = false }) {
  return (
    <div className="flex items-center gap-2">
      <Btn disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)" compact={compact}>
        <UndoIcon />{!compact && <span>Undo</span>}
      </Btn>
      <Btn disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Shift+Z)" compact={compact}>
        <RedoIcon />{!compact && <span>Redo</span>}
      </Btn>
    </div>
  )
}
