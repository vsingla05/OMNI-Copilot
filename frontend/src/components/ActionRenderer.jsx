import React from 'react';
import { EmailCard, DriveCard, CalendarCard } from './ActionCards';
import { EmailDraftEditor, CalendarDraftEditor } from './DraftEditor';
import { motion } from 'framer-motion';
import './ActionRenderer.css';

/**
 * ActionRenderer — The Brain (v2).
 *
 * READ patterns (single-line):
 *   "From: <sender> | Subject: <subject>"  → EmailCard
 *   "File: <filename>"                      → DriveCard
 *   "Event: <name> at <dateStr>"            → CalendarCard
 *
 * WRITE / DRAFT patterns (multi-line blocks):
 *   [DRAFT_EMAIL]
 *   To: recipient@example.com
 *   Subject: Meeting Tomorrow
 *   Body: Hi there…
 *
 *   [DRAFT_EVENT]
 *   Title: Team Standup
 *   Date: April 15, 2025
 *   Time: 10:00 AM
 *   Duration: 30 minutes
 *
 * SUCCESS patterns (inline, any line):
 *   "…sent successfully…"   → inline success badge
 *   "…created successfully…" → inline success badge
 *
 * Props:
 *   text            {string}  — raw AI response
 *   onConfirmAction {fn}      — (message: string) => Promise<string>
 */
export default function ActionRenderer({ text, onConfirmAction }) {
  if (!text) return null;

  // ── 1. Check for multi-line draft blocks first ──
  const emailDraft    = parseDraftEmail(text);
  const calendarDraft = parseDraftEvent(text);

  if (emailDraft) {
    return (
      <div className="action-renderer action-renderer--cards">
        {/* Preamble lines before the block */}
        {emailDraft.preamble && (
          <p className="action-renderer__text">{emailDraft.preamble}</p>
        )}
        <EmailDraftEditor
          to={emailDraft.to}
          subject={emailDraft.subject}
          body={emailDraft.body}
          onConfirm={onConfirmAction}
          onCancel={() => {}}
        />
      </div>
    );
  }

  if (calendarDraft) {
    return (
      <div className="action-renderer action-renderer--cards">
        {calendarDraft.preamble && (
          <p className="action-renderer__text">{calendarDraft.preamble}</p>
        )}
        <CalendarDraftEditor
          title={calendarDraft.title}
          date={calendarDraft.date}
          time={calendarDraft.time}
          duration={calendarDraft.duration}
          onConfirm={onConfirmAction}
          onCancel={() => {}}
        />
      </div>
    );
  }

  // ── 2. Line-by-line classification ──
  const lines = text.split('\n').filter(Boolean);

  const nodes = lines.map((line, i) => {
    // Success inline badge
    const lower = line.toLowerCase();
    if (lower.includes('sent successfully') || lower.includes('created successfully') || lower.includes('done successfully')) {
      return <SuccessBadge key={i} message={line} />;
    }

    // Email READ card
    const emailMatch = line.match(/^From:\s*(.+?)\s*\|\s*Subject:\s*(.+)$/i);
    if (emailMatch) {
      return <EmailCard key={i} from={emailMatch[1]} subject={emailMatch[2]} />;
    }

    // Drive card
    const fileMatch = line.match(/^File:\s*(.+)$/i);
    if (fileMatch) {
      return <DriveCard key={i} filename={fileMatch[1]} />;
    }

    // Calendar READ card
    const eventMatch = line.match(/^Event:\s*(.+?)\s+at\s+(.+)$/i);
    if (eventMatch) {
      return <CalendarCard key={i} eventName={eventMatch[1]} dateStr={eventMatch[2]} />;
    }

    // Plain text
    return (
      <p key={i} className="action-renderer__text">{line}</p>
    );
  });

  const hasCards = nodes.some(n => n.type !== 'p');

  return (
    <div className={`action-renderer ${hasCards ? 'action-renderer--cards' : ''}`}>
      {nodes}
    </div>
  );
}

/* ─── Inline success badge ─────────────────── */
function SuccessBadge({ message }) {
  return (
    <motion.div
      className="success-badge"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <span className="success-badge__icon">✓</span>
      <span className="success-badge__text">{message}</span>
    </motion.div>
  );
}

/* ─── Draft block parsers ───────────────────── */

function parseDraftEmail(text) {
  if (!text.includes('[DRAFT_EMAIL]')) return null;

  const after    = text.slice(text.indexOf('[DRAFT_EMAIL]'));
  const preamble = text.slice(0, text.indexOf('[DRAFT_EMAIL]')).trim();
  const lines    = after.split('\n').filter(Boolean);

  let to = '', subject = '', body = '';
  let bodyLines = [];
  let inBody = false;

  for (const line of lines) {
    if (line.startsWith('[DRAFT_EMAIL]')) continue;
    if (!inBody) {
      const toM      = line.match(/^To:\s*(.+)$/i);
      const subjectM = line.match(/^Subject:\s*(.+)$/i);
      const bodyM    = line.match(/^Body:\s*(.*)$/i);
      if (toM)      { to = toM[1].trim();      continue; }
      if (subjectM) { subject = subjectM[1].trim(); continue; }
      if (bodyM)    { inBody = true; bodyLines.push(bodyM[1]); continue; }
    } else {
      // Stop at next block marker
      if (line.startsWith('[')) break;
      bodyLines.push(line);
    }
  }

  body = bodyLines.join('\n').trim();

  if (!to && !subject) return null;
  return { preamble, to, subject, body };
}

function parseDraftEvent(text) {
  if (!text.includes('[DRAFT_EVENT]')) return null;

  const after    = text.slice(text.indexOf('[DRAFT_EVENT]'));
  const preamble = text.slice(0, text.indexOf('[DRAFT_EVENT]')).trim();
  const lines    = after.split('\n').filter(Boolean);

  let title = '', date = '', time = '', duration = '1 hour';

  for (const line of lines) {
    if (line.startsWith('[DRAFT_EVENT]')) continue;
    if (line.startsWith('[')) break;
    const titleM    = line.match(/^Title:\s*(.+)$/i);
    const dateM     = line.match(/^Date:\s*(.+)$/i);
    const timeM     = line.match(/^Time:\s*(.+)$/i);
    const durationM = line.match(/^Duration:\s*(.+)$/i);
    if (titleM)    title    = titleM[1].trim();
    if (dateM)     date     = dateM[1].trim();
    if (timeM)     time     = timeM[1].trim();
    if (durationM) duration = durationM[1].trim();
  }

  if (!title) return null;
  return { preamble, title, date, time, duration };
}
