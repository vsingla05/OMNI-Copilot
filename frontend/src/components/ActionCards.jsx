import React from 'react';
import { Share2, FileText, Image, Sheet, Presentation } from 'lucide-react';
import './ActionCards.css';

/* ─── Helpers ─────────────────────────────────── */

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return <Image size={18} />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <Sheet size={18} />;
  if (['ppt', 'pptx'].includes(ext)) return <Presentation size={18} />;
  return <FileText size={18} />;
}

function formatEventDate(dateStr = '') {
  try {
    const d = new Date(dateStr);
    return {
      day:   d.getDate().toString().padStart(2, '0'),
      month: d.toLocaleString('en', { month: 'short' }).toUpperCase(),
      time:  d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { day: '--', month: '---', time: '--:--' };
  }
}

/* ─── Email Card ──────────────────────────────── */

export function EmailCard({ from, subject }) {
  const displayName = from?.replace(/<.*>/, '').trim() || 'Unknown';
  const email = from?.match(/<(.+)>/)?.[1] || from || '';

  return (
    <div className="action-card email-card" role="article" aria-label={`Email from ${displayName}`}>
      <div className="email-card__avatar">
        {getInitials(displayName)}
      </div>
      <div className="email-card__body">
        <p className="action-card__title">{subject || 'No Subject'}</p>
        <p className="action-card__sub">{displayName}</p>
        {email && displayName !== email && (
          <p className="action-card__meta">{email}</p>
        )}
      </div>
      <div className="email-card__badge">Mail</div>
    </div>
  );
}

/* ─── Drive Card ─────────────────────────────── */

export function DriveCard({ filename }) {
  return (
    <div className="action-card drive-card" role="article" aria-label={`Drive file: ${filename}`}>
      <div className="drive-card__icon">
        {fileIcon(filename)}
      </div>
      <div className="drive-card__body">
        <p className="action-card__title">{filename || 'Untitled'}</p>
        <p className="action-card__sub">Google Drive</p>
      </div>
      <button
        className="drive-card__share"
        aria-label={`Share ${filename}`}
        onClick={e => e.stopPropagation()}
      >
        <Share2 size={14} />
      </button>
    </div>
  );
}

/* ─── Calendar Card ──────────────────────────── */

export function CalendarCard({ eventName, dateStr }) {
  const { day, month, time } = formatEventDate(dateStr);

  return (
    <div className="action-card calendar-card" role="article" aria-label={`Event: ${eventName}`}>
      <div className="calendar-card__date">
        <span className="calendar-card__month">{month}</span>
        <span className="calendar-card__day">{day}</span>
      </div>
      <div className="calendar-card__body">
        <p className="action-card__title">{eventName || 'Untitled Event'}</p>
        <p className="action-card__sub">{time !== '--:--' ? time : 'All day'} · Google Calendar</p>
      </div>
    </div>
  );
}
