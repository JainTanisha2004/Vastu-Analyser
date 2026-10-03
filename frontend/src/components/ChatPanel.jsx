import React, { useState, useEffect, useRef, useMemo } from 'react'
import { streamChatMessage } from '../api/reportApi'

// Lightweight Markdown Formatter
function FormattedMessage({ content }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-2 text-[13px] leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} className="h-1" />

        // Headings
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-stone-900 text-sm mt-2 mb-1">
              {trimmed.replace('### ', '')}
            </h4>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-stone-900 text-base mt-2 mb-1">
              {trimmed.replace('## ', '')}
            </h3>
          )
        }

        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[-*]\s+/, '')
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-orange-500 font-bold leading-none mt-1">•</span>
              <span>{parseInlineStyles(itemText)}</span>
            </div>
          )
        }

        return <p key={idx}>{parseInlineStyles(line)}</p>
      })}
    </div>
  )
}

function parseInlineStyles(text) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-stone-900">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} className="italic text-stone-700">{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="bg-stone-100 text-orange-600 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}

export default function ChatPanel({
  isOpen,
  onClose,
  fileId,
  analysisData,
  reportData,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hello! I am your **Vastu AI Consultant**. I have analyzed your floor plan evaluation and can answer questions about specific rooms, directional energies, recommended remedies, or layout optimizations. What would you like to explore?",
    },
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const abortControllerRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  // Contextual question chips
  const suggestedQuestions = useMemo(() => {
    const chips = []
    const rows = analysisData?.rows || []
    const unfavourable = rows.filter((r) => Number(r.score) <= 0)

    if (unfavourable.length > 0) {
      chips.push(`How do I fix the ${unfavourable[0].room_type}?`)
    }
    if (analysisData?.optimization?.move) {
      chips.push('Explain the recommended room swap')
    }
    chips.push("What are my home's greatest strengths?")
    chips.push('Give me a top 3 priority action list')
    return chips.slice(0, 4)
  }, [analysisData])

  const handleSend = (textToSend = null) => {
    const query = (textToSend || inputMessage).trim()
    if (!query || isStreaming) return

    setInputMessage('')
    const newMessages = [...messages, { role: 'user', content: query }]
    setMessages(newMessages)
    setIsStreaming(true)

    let currentResponse = ''
    // Add empty assistant placeholder
    setMessages([...newMessages, { role: 'assistant', content: '' }])

    const abortFn = streamChatMessage(
      fileId,
      query,
      analysisData,
      reportData,
      {
        onDelta: (token) => {
          currentResponse += token
          setMessages((prev) => {
            const updated = [...prev]
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                role: 'assistant',
                content: currentResponse,
              }
            }
            return updated
          })
        },
        onDone: () => {
          setIsStreaming(false)
        },
        onError: (err) => {
          setIsStreaming(false)
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `*Error generating response: ${err.message || 'Connection failed'}. Please try again.*`,
            },
          ])
        },
      },
    )

    abortControllerRef.current = abortFn
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-out Drawer */}
      <div className="relative w-full max-w-md md:max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-fadeSlideIn">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-orange-50/70 to-amber-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-stone-900 font-extrabold text-sm flex items-center gap-2">
                Vastu AI Consultant
                <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-800 rounded-full border border-green-200">
                  Grounded
                </span>
              </h3>
              <p className="text-stone-500 text-[11px] font-medium">
                Grounded in your floor plan & scores
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setMessages([
                  {
                    role: 'assistant',
                    content:
                      "Conversation reset. How can I assist you with your Vastu evaluation?",
                  },
                ])
              }
              title="Clear conversation"
              className="p-2 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user'
            return (
              <div
                key={index}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-tr-xs'
                      : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs'
                  }`}
                >
                  <FormattedMessage content={msg.content} />
                </div>

                {!isUser && msg.content && (
                  <button
                    onClick={() => handleCopy(msg.content, index)}
                    className="text-[10px] text-stone-400 hover:text-stone-600 mt-1 ml-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedIndex === index ? (
                      <span className="text-green-600 font-bold">✓ Copied</span>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}

          {isStreaming && (
            <div className="flex items-center gap-2 text-stone-400 text-xs pl-2 py-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span>Consultant is formulating response…</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length < 3 && (
          <div className="px-4 py-2 border-t border-stone-100 bg-white flex flex-wrap gap-1.5">
            {suggestedQuestions.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip)}
                className="text-[11px] font-medium bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200/60 rounded-full px-3 py-1 text-left transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-stone-200">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about a room, direction, or remedy…"
              disabled={isStreaming}
              className="flex-1 bg-stone-100 focus:bg-white text-stone-900 text-[13px] border border-stone-200 focus:border-orange-500 rounded-2xl px-4 py-2.5 focus:outline-none transition-all placeholder:text-stone-400"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-2xl transition-colors cursor-pointer"
                title="Stop streaming"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="p-2.5 bg-gradient-to-r from-orange-600 to-amber-600 disabled:opacity-40 hover:from-orange-700 hover:to-amber-700 text-white rounded-2xl shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </form>
          <p className="text-[10px] text-stone-400 text-center mt-1.5">
            Strictly grounded in your calculated Vastu coordinates & scores.
          </p>
        </div>
      </div>
    </div>
  )
}
