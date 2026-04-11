import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import PlatformPill from './PlatformPill';
import './NotionEditor.css';

export default function NotionEditor({ initialTitle = '', initialBody = '', onPush, onClose }) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState('idle'); // idle|saving|saved

  const handlePush = async () => {
    if (status !== 'idle') return;
    setStatus('saving');
    try {
      if (onPush) {
        await onPush(title, body);
      }
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (e) {
      console.error(e);
      setStatus('idle');
    }
  };

  return (
    <div className="notion-editor">
      <div className="notion-editor__topbar">
        <PlatformPill platform="notion" />
        {onClose && (
          <button className="notion-editor__close" onClick={onClose}><X size={16} /></button>
        )}
      </div>

      <div className="notion-editor__content">
        <input 
          type="text" 
          className="notion-editor__title" 
          placeholder="Untitled" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea 
          className="notion-editor__body" 
          placeholder="Start typing or copy markdown here..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="notion-editor__footer">
        <button 
          className={`notion-editor__push-btn ${status !== 'idle' ? 'notion-editor__push-btn--wait' : ''}`}
          onClick={handlePush}
        >
          <AnimatePresence mode="wait">
            {status === 'saving' ? (
              <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Pushing...
              </motion.span>
            ) : status === 'saved' ? (
              <motion.span key="saved" className="notion-editor__btn-saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Check size={16} strokeWidth={3} /> Published
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Push to Notion
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
