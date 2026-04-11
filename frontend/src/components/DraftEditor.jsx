import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Check, AlertCircle, RefreshCw, Calendar } from 'lucide-react';
import './DraftEditor.css';

/* ─── Shared animation variants ─────────────── */
const fadeSlide = {
  hidden:  { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0,  scale: 1,
             transition: { type: 'spring', stiffness: 300, damping: 24 } },
  exit:    { opacity: 0, y: -8, scale: 0.97,
             transition: { duration: 0.18 } },
};

/* ─── Shared state overlay ───────────────────── */
function StateOverlay({ state, noun, onRetry }) {
  return (
    <AnimatePresence mode="wait">
      {state === 'loading' && (
        <motion.div key="loading" className="draft-overlay" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
          <div className="draft-spinner" aria-label="Sending…" />
          <p className="draft-overlay__text">Processing…</p>
        </motion.div>
      )}

      {state === 'success' && (
        <motion.div key="success" className="draft-overlay draft-overlay--success" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
          <motion.div
            className="draft-checkmark"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20, delay: 0.06 }}
          >
            <Check size={26} strokeWidth={2.5} />
          </motion.div>
          <p className="draft-overlay__title">{noun} confirmed!</p>
          <p className="draft-overlay__sub">All done. You're good to go.</p>
        </motion.div>
      )}

      {state === 'error' && (
        <motion.div key="error" className="draft-overlay draft-overlay--error" variants={fadeSlide} initial="hidden" animate="visible" exit="exit">
          <AlertCircle size={28} />
          <p className="draft-overlay__title">Something went wrong</p>
          <button className="draft-btn draft-btn--ghost" onClick={onRetry}>
            <RefreshCw size={13} /> Try again
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════════
   EMAIL DRAFT EDITOR
   ════════════════════════════════════════════════ */
export function EmailDraftEditor({ to: initTo = '', subject: initSubject = '', body: initBody = '', onConfirm, onCancel }) {
  const [fields, setFields] = useState({ to: initTo, subject: initSubject, body: initBody });
  const [state, setState]   = useState('idle'); // idle | loading | success | error

  const update = (key) => (e) => setFields(prev => ({ ...prev, [key]: e.target.value }));

  const handleConfirm = async () => {
    if (!fields.to.trim()) return;
    setState('loading');
    try {
      const result = await onConfirm(
        `send email to ${fields.to} with subject "${fields.subject}" and body: ${fields.body}`
      );
      const lower = (result || '').toLowerCase();
      setState(lower.includes('fail') || lower.includes('error') ? 'error' : 'success');
    } catch {
      setState('error');
    }
  };

  const canConfirm = fields.to.trim().length > 0 && state === 'idle';

  return (
    <div className="draft-editor email-draft-editor" role="region" aria-label="Email draft">
      {/* Header */}
      <div className="draft-editor__header">
        <span className="draft-editor__header-icon">✉️</span>
        <div>
          <p className="draft-editor__header-title">Email Draft</p>
          <p className="draft-editor__header-sub">Review & edit before sending</p>
        </div>
        {state === 'idle' && (
          <button className="draft-editor__close" onClick={onCancel} aria-label="Discard draft">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Form / State overlay */}
      <div className="draft-editor__body">
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div key="form" variants={fadeSlide} initial="hidden" animate="visible" exit="exit" className="draft-form">
              <DraftField id="email-to"      label="To"      type="input"    value={fields.to}      onChange={update('to')}      placeholder="recipient@example.com" />
              <DraftField id="email-subject" label="Subject" type="input"    value={fields.subject} onChange={update('subject')} placeholder="Enter subject…" />
              <DraftField id="email-body"    label="Body"    type="textarea" value={fields.body}    onChange={update('body')}    placeholder="Write your message…" rows={5} />

              <div className="draft-editor__actions">
                <button className="draft-btn draft-btn--cancel" onClick={onCancel} id="email-cancel-btn">
                  <X size={13} /> Discard
                </button>
                <button
                  className={`draft-btn draft-btn--confirm ${!canConfirm ? 'draft-btn--disabled' : ''}`}
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  id="email-confirm-btn"
                >
                  <Send size={13} /> Confirm & Send
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <StateOverlay state={state} noun="Email sent" onRetry={() => setState('idle')} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   CALENDAR DRAFT EDITOR
   ════════════════════════════════════════════════ */
export function CalendarDraftEditor({ title: initTitle = '', date: initDate = '', time: initTime = '', duration: initDuration = '1 hour', onConfirm, onCancel }) {
  const [fields, setFields] = useState({ title: initTitle, date: initDate, time: initTime, duration: initDuration });
  const [state, setState]   = useState('idle');

  const update = (key) => (e) => setFields(prev => ({ ...prev, [key]: e.target.value }));

  const handleConfirm = async () => {
    if (!fields.title.trim()) return;
    setState('loading');
    try {
      const result = await onConfirm(
        `create event "${fields.title}" on ${fields.date} at ${fields.time} for ${fields.duration}`
      );
      const lower = (result || '').toLowerCase();
      setState(lower.includes('fail') || lower.includes('error') ? 'error' : 'success');
    } catch {
      setState('error');
    }
  };

  const canConfirm = fields.title.trim().length > 0 && state === 'idle';

  // Build mini week calendar
  const miniWeek = buildMiniWeek(fields.date);

  return (
    <div className="draft-editor calendar-draft-editor" role="region" aria-label="Calendar event draft">
      {/* Header */}
      <div className="draft-editor__header">
        <span className="draft-editor__header-icon">📅</span>
        <div>
          <p className="draft-editor__header-title">New Event Draft</p>
          <p className="draft-editor__header-sub">Review & edit before creating</p>
        </div>
        {state === 'idle' && (
          <button className="draft-editor__close" onClick={onCancel} aria-label="Discard event">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="draft-editor__body">
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div key="form" variants={fadeSlide} initial="hidden" animate="visible" exit="exit" className="draft-form">
              {/* Mini calendar strip */}
              {miniWeek.length > 0 && (
                <div className="mini-calendar" aria-label="Week preview">
                  {miniWeek.map((day, i) => (
                    <div
                      key={i}
                      className={`mini-calendar__day ${day.isTarget ? 'mini-calendar__day--active' : ''} ${day.isToday ? 'mini-calendar__day--today' : ''}`}
                    >
                      <span className="mini-calendar__dow">{day.dow}</span>
                      <span className="mini-calendar__num">{day.num}</span>
                    </div>
                  ))}
                </div>
              )}

              <DraftField id="cal-title"    label="Event Title" type="input"  value={fields.title}    onChange={update('title')}    placeholder="e.g. Team Standup" />
              <DraftField id="cal-date"     label="Date"        type="input"  value={fields.date}     onChange={update('date')}     placeholder="e.g. April 15, 2025" />
              <DraftField id="cal-time"     label="Time"        type="input"  value={fields.time}     onChange={update('time')}     placeholder="e.g. 10:00 AM" />
              <DraftField id="cal-duration" label="Duration"    type="input"  value={fields.duration} onChange={update('duration')} placeholder="e.g. 1 hour" />

              <div className="draft-editor__actions">
                <button className="draft-btn draft-btn--cancel" onClick={onCancel} id="cal-cancel-btn">
                  <X size={13} /> Reschedule
                </button>
                <button
                  className={`draft-btn draft-btn--confirm ${!canConfirm ? 'draft-btn--disabled' : ''}`}
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  id="cal-confirm-btn"
                >
                  <Calendar size={13} /> Confirm Event
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <StateOverlay state={state} noun="Event created" onRetry={() => setState('idle')} />
      </div>
    </div>
  );
}

/* ─── Shared field component ─────────────────── */
function DraftField({ id, label, type, value, onChange, placeholder, rows }) {
  return (
    <div className="draft-field">
      <label className="draft-field__label" htmlFor={id}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          id={id}
          className="draft-field__input draft-field__textarea"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows || 4}
        />
      ) : (
        <input
          id={id}
          className="draft-field__input"
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

/* ─── Mini week calendar helper ──────────────── */
function buildMiniWeek(dateStr) {
  try {
    if (!dateStr) return [];
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find Monday of the target's week
    const day = target.getDay(); // 0=Sun
    const monday = new Date(target);
    monday.setDate(target.getDate() - ((day + 6) % 7));

    const dows = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return {
        dow: dows[i],
        num: d.getDate(),
        isTarget: d.getTime() === target.setHours(0, 0, 0, 0),
        isToday:  d.getTime() === today.getTime(),
      };
    });
  } catch {
    return [];
  }
}
