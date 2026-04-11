import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Save, CalendarPlus, Check, X, UploadCloud } from 'lucide-react';
import './WritePanel.css';

const ACTIONS = [
  { id: 'email',    label: 'Send Email',      icon: Send,        color: '#F87171' },
  { id: 'drive',    label: 'Upload to Drive', icon: Save,        color: '#34D399' },
  { id: 'calendar', label: 'Create Event',    icon: CalendarPlus, color: '#60A5FA' },
];

/**
 * WritePanel — professional compose / edit area for the right pane.
 */
export default function WritePanel({ mode = 'compose', itemType = 'email', initialData = {}, onSubmit, onClose }) {
  const getInitialFields = () => {
    if (itemType === 'email') return { to: initialData.to || '', subject: initialData.subject || '', body: initialData.body || '' };
    if (itemType === 'event') return { title: initialData.title || '', date: initialData.date || '', time: initialData.time || '', duration: initialData.duration || '' };
    return { name: initialData.name || '', file: null };
  };

  const [fields, setFields]         = useState(getInitialFields);
  const [state, setState]           = useState('idle');   // idle|loading|success|error
  const [activeAction, setAction]   = useState(itemType === 'email' ? 'email' : itemType === 'event' ? 'calendar' : 'drive');
  const [errorMsg, setErrorMsg]     = useState('');
  
  const fileInputRef = useRef(null);

  const update = (key) => (e) => setFields(p => ({ ...p, [key]: e.target.value }));
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
        setFields(p => ({ ...p, file: e.target.files[0], name: e.target.files[0].name }));
    }
  };

  const handleSubmit = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      let submissionData = fields;
      
      // For Drive uploads, wrap into FormData
      if (activeAction === 'drive' && fields.file) {
          const formData = new FormData();
          formData.append('file', fields.file);
          submissionData = formData;
      }
      
      const result = await onSubmit(activeAction, submissionData);
      
      const lower = (result || '').toLowerCase();
      if (lower.includes('error') || lower.includes('fail')) {
        setErrorMsg(result);
        setState('error');
      } else {
        setState('success');
        setTimeout(() => setState('idle'), 3200);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong');
      setState('error');
    }
  };

  const isLoading  = state === 'loading';
  const isSuccess  = state === 'success';

  return (
    <div className="write-panel" role="region" aria-label="Compose panel">
      {/* Header */}
      <div className="write-panel__header">
        <div className="write-panel__header-info">
          <p className="write-panel__header-title">
            {mode === 'edit' ? 'Edit Item' : 'Compose New'}
          </p>
          <p className="write-panel__header-sub">
            {mode === 'edit' ? 'Modify and save changes' : 'Create and send to your workspace'}
          </p>
        </div>
        {onClose && (
          <button className="write-panel__close" onClick={onClose} aria-label="Close panel">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Action selector (shown in compose mode) */}
      {mode === 'compose' && (
        <div className="write-panel__action-tabs" role="tablist">
          {ACTIONS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeAction === id}
              className={`write-panel__tab ${activeAction === id ? 'write-panel__tab--active' : ''}`}
              style={{ '--tab-color': color }}
              onClick={() => { setAction(id); setFields({}); }}
              id={`tab-${id}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Fields */}
      <div className="write-panel__fields">
        <AnimatePresence mode="wait">

          {/* Email fields */}
          {activeAction === 'email' && (
            <motion.div
              key="email-fields"
              className="write-panel__form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <WField id="wp-to"      label="To"      value={fields.to || ''}      onChange={update('to')}      placeholder="recipient@example.com" />
              <WField id="wp-subject" label="Subject" value={fields.subject || ''} onChange={update('subject')} placeholder="Email subject…" />
              <WField id="wp-body"    label="Body"    value={fields.body || ''}    onChange={update('body')}    placeholder="Write your message…" type="textarea" rows={9} />
            </motion.div>
          )}

          {/* Calendar / Event fields */}
          {activeAction === 'calendar' && (
            <motion.div
              key="event-fields"
              className="write-panel__form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <WField id="wp-title"    label="Event Title" value={fields.title || ''}    onChange={update('title')}    placeholder="e.g. Team Standup" />
              <WField id="wp-date"     label="Date"        value={fields.date || ''}     onChange={update('date')}     placeholder="e.g. April 11, 2026" />
              <WField id="wp-time"     label="Time"        value={fields.time || ''}     onChange={update('time')}     placeholder="e.g. 4:00 PM" />
              <WField id="wp-duration" label="Duration"    value={fields.duration || ''} onChange={update('duration')} placeholder="e.g. 1 hour" />
            </motion.div>
          )}

          {/* Drive / File fields */}
          {activeAction === 'drive' && (
            <motion.div
              key="file-fields"
              className="write-panel__form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              {mode === 'edit' ? (
                <WField id="wp-name" label="File Name" value={fields.name || ''} onChange={update('name')} placeholder="Document name…" />
              ) : (
                <div className="write-field">
                  <label className="write-field__label">Upload File</label>
                  <div 
                    className="write-panel__file-drop" 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud size={24} color="var(--accent)" />
                    <p>{fields.file ? fields.file.name : "Click to select a file from your computer"}</p>
                    <input 
                      type="file" 
                      style={{ display: 'none' }} 
                      onChange={handleFileChange} 
                      ref={fileInputRef} 
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer — submit + status */}
      <div className="write-panel__footer">
        {/* Error message */}
        <AnimatePresence>
          {state === 'error' && (
            <motion.p
              className="write-panel__error"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              ⚠️ {errorMsg}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="write-panel__footer-row">
          <button
            id="write-panel-submit-btn"
            className={`write-panel__submit ${isLoading ? 'write-panel__submit--loading' : ''} ${isSuccess ? 'write-panel__submit--success' : ''}`}
            onClick={handleSubmit}
            disabled={isLoading || (activeAction === 'drive' && mode === 'compose' && !fields.file)}
            aria-label="Submit"
          >
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.span
                  key="success"
                  className="write-panel__submit-icon"
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 18 }}
                >
                  <Check size={16} strokeWidth={2.5} />
                  Saved!
                </motion.span>
              ) : isLoading ? (
                <motion.span key="loading" className="write-panel__spinner" />
              ) : (
                <motion.span key="idle" className="write-panel__submit-label">
                  {ACTIONS.find(a => a.id === activeAction)?.label || 'Submit'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared field ───────────────────── */
function WField({ id, label, value, onChange, placeholder, type = 'input', rows = 4 }) {
  return (
    <div className="write-field">
      <label className="write-field__label" htmlFor={id}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          id={id}
          className="write-field__input write-field__textarea"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
        />
      ) : (
        <input
          id={id}
          className="write-field__input"
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
