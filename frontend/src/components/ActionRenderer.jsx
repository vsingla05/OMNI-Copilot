import React, { useState } from 'react';
import { EmailCard, DriveCard, CalendarCard } from './ActionCards';
import { EmailDraftEditor, CalendarDraftEditor } from './DraftEditor';
import DiscordFeedCard from './DiscordFeedCard';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Loader, HelpCircle } from 'lucide-react';
import './ActionRenderer.css';

/**
 * ActionRenderer — The Brain (v2).
 */
export default function ActionRenderer({ text, onConfirmAction }) {
  if (!text) return null;

  // ── 0. Clarification request from the LLM ──
  const clarificationMatch = text.match(/\[CLARIFICATION_NEEDED\]\s*([\s\S]*)/);
  if (clarificationMatch) {
    const question = clarificationMatch[1].trim();
    return (
      <div className="action-renderer">
        <ClarificationCard question={question} />
      </div>
    );
  }

  // ── 1. Check for multi-line draft blocks first ──
  const emailDraft    = parseDraftEmail(text);
  const calendarDraft = parseDraftEvent(text);

  if (emailDraft) {
    return (
      <div className="action-renderer action-renderer--cards">
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
    const lower = line.toLowerCase();

    // Success inline badge
    if (lower.includes('sent successfully') || lower.includes('created successfully') || lower.includes('done successfully')) {
      return <SuccessBadge key={i} message={line} />;
    }

    // Extract ID prefix: "ID: <id> | <rest>"
    const idMatch = line.match(/^ID:\s*([^\s|]+)\s*\|\s*(.*)$/i);
    const content = idMatch ? idMatch[2] : line;
    const rowId   = idMatch ? idMatch[1] : null;

    // Email READ card
    const emailMatch = content.match(/^From:\s*(.+?)\s*\|\s*Subject:\s*(.+)$/i);
    if (emailMatch) return <EmailCard key={i} from={emailMatch[1]} subject={emailMatch[2]} />;

    // Drive card
    const fileMatch = content.match(/^File:\s*(.+)$/i);
    if (fileMatch) return <DriveCard key={i} filename={fileMatch[1]} />;

    // Calendar READ card
    const eventMatch = content.match(/^Event:\s*(.+?)\s*\|\s*At:\s*(.+)$/i);
    const eventMatchLegacy = content.match(/^Event:\s*(.+?)\s+at\s+(.+)$/i);
    if (eventMatch || eventMatchLegacy) {
      const match = eventMatch || eventMatchLegacy;
      return <CalendarCard key={i} eventName={match[1]} dateStr={match[2]} />;
    }

    // Discord Feed Card
    const discordMatch = content.match(/^Discord:\s*(.+?)\s*\|\s*Channel:\s*(.+?)\s*\|\s*Author:\s*(.+?)\s*\|\s*Msg:\s*(.+)$/i);
    if (discordMatch) {
      return <DiscordFeedCard key={i} server={discordMatch[1]} channel={discordMatch[2]} author={discordMatch[3]} message={discordMatch[4]} />;
    }

    // Slack Feed Card
    const slackMatch = content.match(/^Slack\s*\|\s*User:\s*(.*?)\s*\|\s*Msg:\s*(.+)$/i);
    if (slackMatch) {
      return <MiniFeedCard key={i} platform="Slack" color="#E01E5A" author={slackMatch[1]} message={slackMatch[2]} />;
    }

    // ── Notion Page Card (new format from backend) ──
    // e.g: "📄 FireReach | ID: 3454a75b-... | 🔗 https://notion.so/..."
    const notionNewMatch = line.match(/^(📄|🗄️)\s+(.+?)\s*\|\s*ID:\s*([\w-]+)(?:\s*\|\s*🔗\s*(https?:\/\/\S+))?/i);
    if (notionNewMatch) {
      const isDb  = notionNewMatch[1] === '🗄️';
      const title = notionNewMatch[2].trim();
      const pid   = notionNewMatch[3].replace(/-/g, '');
      const url   = notionNewMatch[4] || null;
      return <NotionPageCard key={i} title={title} pageId={pid} url={url} isDatabase={isDb} />;
    }

    // Notion summary line "Found N item(s)…" — render as plain text
    if (lower.startsWith('found ') && lower.includes('notion')) {
      return <p key={i} className="action-renderer__text action-renderer__notion-summary">{line}</p>;
    }

    // Notion Page Card (legacy format)
    const notionOldMatch = content.match(/^Notion:\s*(.+?)\s*\|\s*Title:\s*(.+)$/i);
    if (notionOldMatch) {
      return <NotionPageCard key={i} title={notionOldMatch[2]} pageId={rowId} url={null} isDatabase={false} />;
    }

    // Local Files (Code Explorer) — must come after notion check to avoid matching 📄 lines
    const codeMatch = content.match(/^(📁|📄)\s*(.+?)\s*(?:\((.*?)\))?$/);
    if (codeMatch && !line.includes('File:') && !notionNewMatch) {
      return <MiniIconCard key={i} platform="Code" color="#A78BFA" title={codeMatch[2]} subtitle={codeMatch[3] || 'System Dir'} icon={codeMatch[1]} />;
    }

    // Google Forms Response
    const formMatch = content.match(/^Response\s*\d+:\s*(.+)$/i);
    if (formMatch) {
      return <MiniFeedCard key={i} platform="Forms" color="#FBBF24" author="Respondent" message={formMatch[1]} />;
    }

    // Google Forms Link
    const formLinkMatch = content.match(/^Form URL:\s*(https:\/\/.*)$/i);
    if (formLinkMatch) {
      return (
        <a key={i} href={formLinkMatch[1]} target="_blank" rel="noreferrer" className="action-renderer__form-link">
          Open Google Form ↗
        </a>
      );
    }

    // Plain text
    return <p key={i} className="action-renderer__text">{line}</p>;
  });

  const hasCards = nodes.some(n => n?.type !== 'p');

  return (
    <div className={`action-renderer ${hasCards ? 'action-renderer--cards' : ''}`}>
      {nodes}
    </div>
  );
}

/* ─── Notion Page Card — clickable → opens full-content modal ── */
function NotionPageCard({ title, pageId, url, isDatabase }) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [pageData, setPageData] = useState(null);
  const [error, setError]       = useState(null);

  const handleOpen = async () => {
    setOpen(true);
    if (pageData || !pageId) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`http://localhost:8000/notion/page/${pageId}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setPageData(data);
    } catch {
      setError('Failed to connect to backend. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Card row */}
      <motion.div
        className={`notion-page-card ${isDatabase ? 'notion-page-card--db' : ''}`}
        onClick={handleOpen}
        whileHover={{ scale: 1.015, x: 2 }}
        whileTap={{ scale: 0.97 }}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleOpen()}
        aria-label={`Open Notion page: ${title}`}
      >
        <div className="notion-page-card__icon">{isDatabase ? '🗄️' : '📄'}</div>
        <div className="notion-page-card__body">
          <p className="notion-page-card__title">{title}</p>
          <p className="notion-page-card__hint">Click to view full content</p>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="notion-page-card__ext"
            onClick={e => e.stopPropagation()}
            title="Open in Notion"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </motion.div>

      {/* Full-content modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="notion-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="notion-modal"
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 20 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="notion-modal__header">
                <div className="notion-modal__header-left">
                  <span className="notion-modal__icon">{isDatabase ? '🗄️' : '📄'}</span>
                  <span className="notion-modal__title">{pageData?.title || title}</span>
                </div>
                <div className="notion-modal__header-right">
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" className="notion-modal__open-btn">
                      Open in Notion <ExternalLink size={12} />
                    </a>
                  )}
                  <button className="notion-modal__close" onClick={() => setOpen(false)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="notion-modal__body">
                {loading && (
                  <div className="notion-modal__loading">
                    <Loader size={20} className="notion-modal__spinner" />
                    <span>Loading page content…</span>
                  </div>
                )}
                {error && <p className="notion-modal__error">⚠️ {error}</p>}
                {!loading && !error && !pageId && (
                  <p className="notion-modal__no-content">No page ID — cannot fetch content.</p>
                )}
                {pageData && !loading && (
                  <pre className="notion-modal__content">{pageData.content}</pre>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Clarification Request Card ──────────── */
function ClarificationCard({ question }) {
  return (
    <motion.div
      className="clarification-card"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      role="status"
      aria-live="polite"
    >
      <div className="clarification-card__icon">
        <HelpCircle size={16} strokeWidth={2} />
      </div>
      <div className="clarification-card__body">
        <p className="clarification-card__label">Clarification needed</p>
        <p className="clarification-card__question">{question}</p>
      </div>
    </motion.div>
  );
}

/* ─── Shared UI Cards ─────────────────── */
function MiniFeedCard({ platform, color, author, message }) {
  return (
    <div className="mini-feed-card" style={{ '--pf-color': color }}>
      <div className="mini-feed-card__header">
        <span className="mini-feed-card__pf">{platform}</span>
        <span className="mini-feed-card__author">{author}</span>
      </div>
      <p className="mini-feed-card__msg">{message}</p>
    </div>
  );
}

function MiniIconCard({ platform, color, title, subtitle, icon }) {
  return (
    <div className="mini-icon-card" style={{ '--pf-color': color }}>
      <div className="mini-icon-card__icon">{icon}</div>
      <div className="mini-icon-card__info">
        <p className="mini-icon-card__title">{title}</p>
        {subtitle && <p className="mini-icon-card__sub">{subtitle}</p>}
      </div>
    </div>
  );
}

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
  let to = '', subject = '', body = '', bodyLines = [], inBody = false;
  for (const line of lines) {
    if (line.startsWith('[DRAFT_EMAIL]')) continue;
    if (!inBody) {
      const toM      = line.match(/^To:\s*(.+)$/i);
      const subjectM = line.match(/^Subject:\s*(.+)$/i);
      const bodyM    = line.match(/^Body:\s*(.*)$/i);
      if (toM)      { to      = toM[1].trim();      continue; }
      if (subjectM) { subject = subjectM[1].trim(); continue; }
      if (bodyM)    { inBody  = true; bodyLines.push(bodyM[1]); continue; }
    } else {
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
