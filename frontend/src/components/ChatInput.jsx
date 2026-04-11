import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './ChatInput.css';

/* ── Context-specific metadata ── */
const CONTEXT_META = {
  email:    { placeholder: 'Ask about your emails…' },
  calendar: { placeholder: 'Query your calendar events…' },
  drive:    { placeholder: 'Search your Drive files…' },
  notion:   { placeholder: 'Draft or search Notion pages…' },
  discord:  { placeholder: 'Ask about Discord messages…' },
  slack:    { placeholder: 'Check Slack conversations…' },
  code:     { placeholder: 'Read or explore local code…' },
  forms:    { placeholder: 'Create forms or read responses…' },
};

/**
 * ChatInput — floating pill input with multimodal image upload.
 * Props:
 *   value      {string}
 *   onChange   {fn}
 *   onSend     {fn}
 *   isLoading  {boolean}
 *   context    {string}   active context tab
 *   onImageAttach {fn}    callback when image is attached (base64)
 */
export default function ChatInput({ value, onChange, onSend, isLoading, context = 'email', onImageAttach }) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedImage, setAttachedImage] = useState(null);
  const meta = CONTEXT_META[context] || CONTEXT_META.email;

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
      if (!isLoading && value.trim()) handleSend();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Read as base64 for multimodal
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // strip data:... prefix
      setAttachedImage({ name: file.name, base64, preview: reader.result });
      if (onImageAttach) onImageAttach(base64);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const removeImage = () => {
    setAttachedImage(null);
    if (onImageAttach) onImageAttach(null);
  };

  const handleSend = () => {
    onSend(attachedImage?.base64 || null);
    setAttachedImage(null);
  };

  const canSend = !isLoading && value.trim().length > 0;

  return (
    <div className="chat-input-wrap" role="region" aria-label="Message input">
      {/* Image preview strip */}
      <AnimatePresence>
        {attachedImage && (
          <motion.div
            className="chat-input__image-preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <img src={attachedImage.preview} alt="Attached" className="chat-input__thumb" />
            <span className="chat-input__image-name">{attachedImage.name}</span>
            <button className="chat-input__image-remove" onClick={removeImage} aria-label="Remove image">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`chat-input-pill ${canSend ? 'chat-input-pill--active' : ''}`}>
        {/* Paperclip / attach button */}
        <button
          className="chat-input__attach"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file or image"
          title="Attach image"
        >
          <Paperclip size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <AnimatePresence mode="wait">
          <motion.textarea
            key={context}
            ref={textareaRef}
            id="chat-input"
            className="chat-input__textarea"
            placeholder={meta.placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
            aria-label="Message"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          />
        </AnimatePresence>
        <button
          id="chat-send-btn"
          className={`chat-input__send ${isLoading ? 'chat-input__send--pulsing' : canSend ? 'chat-input__send--active' : ''}`}
          onClick={handleSend}
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
