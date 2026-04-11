import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Edit2, Trash2, Mail, HardDrive, Calendar,
  FileText, Image, Sheet, Presentation, Clock, User,
} from 'lucide-react';
import './CRUDCard.css';

/**
 * CRUDCard — universal card for email, file, or event items.
 *
 * Props:
 *   item       { id, type:'email'|'file'|'event', data:{...}, status:'draft'|'sent'|'modified'|'upcoming' }
 *   onEdit     {fn}   — push item into Workspace for editing
 *   onDelete   {fn}   — confirmed delete callback
 *   onQuickView {fn}  — optional quick view
 */
export default function CRUDCard({ item, onEdit, onDelete, onQuickView }) {
  const [deleteState, setDeleteState] = useState('idle'); // idle | confirming | deleting
  const shakeRef = useRef(null);

  const handleDeleteClick = () => {
    setDeleteState('confirming');
    // Trigger shake animation via class
    if (shakeRef.current) {
      shakeRef.current.classList.add('crud-card--shake');
      setTimeout(() => shakeRef.current?.classList.remove('crud-card--shake'), 500);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteState('deleting');
    await onDelete(item);
  };

  const handleDeleteCancel = () => setDeleteState('idle');

  const statusMeta = STATUS_META[item.status] || STATUS_META.default;

  return (
    <motion.div
      ref={shakeRef}
      className={`crud-card crud-card--${item.type} ${deleteState === 'confirming' ? 'crud-card--danger' : ''}`}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, scale: 0.94, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      whileHover={{ y: -2 }}
      role="article"
      aria-label={`${item.type} item`}
    >
      {/* Left icon / avatar */}
      <CardIcon item={item} />

      {/* Content */}
      <div className="crud-card__body">
        <CardContent item={item} />
        {/* Status badge */}
        <span
          className="crud-card__status"
          style={{ '--status-color': statusMeta.color, '--status-bg': statusMeta.bg }}
        >
          {statusMeta.label}
        </span>
      </div>

      {/* Hover action overlay */}
      <AnimatePresence>
        {deleteState === 'idle' && (
          <motion.div
            className="crud-card__actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {onQuickView && (
              <button
                className="crud-card__action-btn"
                onClick={() => onQuickView(item)}
                aria-label="Quick view"
                title="Quick View"
              >
                <Eye size={13} />
              </button>
            )}
            <button
              className="crud-card__action-btn crud-card__action-btn--edit"
              onClick={() => onEdit(item)}
              aria-label="Edit in Workspace"
              title="Edit in Workspace"
            >
              <Edit2 size={13} />
            </button>
            <button
              className="crud-card__action-btn crud-card__action-btn--delete"
              onClick={handleDeleteClick}
              aria-label="Delete"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </motion.div>
        )}

        {/* Delete confirmation */}
        {deleteState === 'confirming' && (
          <motion.div
            className="crud-card__delete-confirm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="crud-card__delete-msg">Delete this {item.type}?</span>
            <button className="crud-card__delete-yes" onClick={handleDeleteConfirm} aria-label="Confirm delete">
              Yes
            </button>
            <button className="crud-card__delete-no" onClick={handleDeleteCancel} aria-label="Cancel delete">
              No
            </button>
          </motion.div>
        )}

        {deleteState === 'deleting' && (
          <div className="crud-card__delete-spinner" aria-label="Deleting…" />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Per-type icon ──────────────────────────── */
function getInitials(name = '') {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function fileIcon(name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return <Image size={17} />;
  if (['xls','xlsx','csv'].includes(ext))   return <Sheet size={17} />;
  if (['ppt','pptx'].includes(ext))          return <Presentation size={17} />;
  return <FileText size={17} />;
}

function CardIcon({ item }) {
  if (item.type === 'email') {
    const name = (item.data.from || '').replace(/<.*>/, '').trim();
    return <div className="crud-card__avatar">{getInitials(name) || '?'}</div>;
  }
  if (item.type === 'file') {
    return <div className="crud-card__file-icon">{fileIcon(item.data.name || '')}</div>;
  }
  // event
  return (
    <div className="crud-card__date-block">
      <span className="crud-card__date-month">
        {new Date(item.data.start || Date.now()).toLocaleString('en', { month: 'short' }).toUpperCase()}
      </span>
      <span className="crud-card__date-day">
        {new Date(item.data.start || Date.now()).getDate()}
      </span>
    </div>
  );
}

/* ─── Per-type content ───────────────────────── */
function CardContent({ item }) {
  if (item.type === 'email') {
    const name = (item.data.from || 'Unknown').replace(/<.*>/, '').trim();
    return (
      <>
        <p className="crud-card__title">{item.data.subject || 'No Subject'}</p>
        <p className="crud-card__sub"><User size={11} /> {name}</p>
      </>
    );
  }
  if (item.type === 'file') {
    return (
      <>
        <p className="crud-card__title">{item.data.name || 'Untitled'}</p>
        <p className="crud-card__sub"><HardDrive size={11} /> Google Drive</p>
      </>
    );
  }
  // event
  const start = item.data.start ? new Date(item.data.start) : null;
  return (
    <>
      <p className="crud-card__title">{item.data.title || 'Untitled Event'}</p>
      <p className="crud-card__sub">
        <Clock size={11} />
        {start ? start.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : 'All day'}
      </p>
    </>
  );
}

/* ─── Status meta ────────────────────────────── */
const STATUS_META = {
  draft:    { label: 'Draft',    color: '#D97706', bg: '#FEF3C7' },
  sent:     { label: 'Sent',     color: '#059669', bg: '#D1FAE5' },
  modified: { label: 'Modified', color: '#7C3AED', bg: '#EDE9FE' },
  upcoming: { label: 'Upcoming', color: '#2563EB', bg: '#DBEAFE' },
  default:  { label: 'Active',   color: '#6B7280', bg: '#F3F4F6' },
};
