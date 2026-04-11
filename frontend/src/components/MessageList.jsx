import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ActionRenderer from './ActionRenderer';
import StatusPill from './StatusPill';
import './MessageList.css';

/* ─── Skeleton loader for pending AI reply ─── */
function SkeletonLoader() {
  return (
    <div className="skeleton-wrap" aria-label="Loading response" role="status">
      <div className="skeleton-avatar" />
      <div className="skeleton-lines">
        <div className="skeleton-line skeleton-line--long" />
        <div className="skeleton-line skeleton-line--short" />
      </div>
    </div>
  );
}

/* ─── Detect which model/service responded ─── */
function detectModel(text = '') {
  if (text.toLowerCase().includes('inbox') || /from:.+subject:/i.test(text)) return 'Gmail Agent';
  if (/file:/i.test(text)) return 'Drive Agent';
  if (/event:/i.test(text)) return 'Calendar Agent';
  return 'Omni Agent';
}

/* ─── Spring animation variants ─── */
const msgVariants = {
  hidden:  { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 280, damping: 26 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: .15 } },
};

/**
 * MessageList
 * Props:
 *   messages        [{role: 'user'|'assistant', text: string}]
 *   isLoading       {boolean}
 *   onConfirmAction {fn} — (message: string) => Promise<string>
 */
export default function MessageList({ messages, isLoading, onConfirmAction }) {
  return (
    <div className="message-list" role="log" aria-live="polite">
      <AnimatePresence initial={false}>
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            className={`message message--${msg.role}`}
            variants={msgVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {msg.role === 'assistant' ? (
              <div className="message__ai">
                <div className="message__ai-icon" aria-hidden="true">
                  <span>✦</span>
                </div>
                <div className="message__ai-content">
                  <ActionRenderer text={msg.text} onConfirmAction={onConfirmAction} />
                  <div className="message__meta">
                    <StatusPill model={detectModel(msg.text)} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="message__user">
                <p className="message__user-text">{msg.text}</p>
              </div>
            )}
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            key="skeleton"
            className="message message--assistant"
            variants={msgVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="message__ai">
              <div className="message__ai-icon message__ai-icon--pulse" aria-hidden="true">
                <span>✦</span>
              </div>
              <div className="message__ai-content">
                <SkeletonLoader />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
