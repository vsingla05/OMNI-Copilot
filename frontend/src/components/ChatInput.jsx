import React, { useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import './ChatInput.css';

/**
 * ChatInput — floating pill input at the bottom.
 * Props:
 *   value      {string}
 *   onChange   {fn}
 *   onSend     {fn}
 *   isLoading  {boolean}
 */
export default function ChatInput({ value, onChange, onSend, isLoading }) {
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) onSend();
    }
  };

  const canSend = !isLoading && value.trim().length > 0;

  return (
    <div className="chat-input-wrap" role="region" aria-label="Message input">
      <div className={`chat-input-pill ${canSend ? 'chat-input-pill--active' : ''}`}>
        <textarea
          ref={textareaRef}
          id="chat-input"
          className="chat-input__textarea"
          placeholder="Ask about your emails, files, or calendar…"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
          aria-label="Message"
        />
        <button
          id="chat-send-btn"
          className={`chat-input__send ${isLoading ? 'chat-input__send--pulsing' : canSend ? 'chat-input__send--active' : ''}`}
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
        >
          {isLoading ? (
            <span className="chat-input__spinner" aria-hidden="true" />
          ) : (
            <ArrowUp size={16} strokeWidth={2.5} />
          )}
        </button>
      </div>
      <p className="chat-input__hint">
        Press <kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for new line
      </p>
    </div>
  );
}
