import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Check } from 'lucide-react';
import PlatformPill from './PlatformPill';
import './DiscordFeedCard.css';

export default function DiscordFeedCard({ server, channel, author, message }) {
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('idle'); // idle|sending|sent
  
  const initials = author ? author.substring(0, 2).toUpperCase() : '??';

  const handleReply = () => {
    if (!reply.trim() || status !== 'idle') return;
    setStatus('sending');
    // Simulate discord API push
    setTimeout(() => {
      setStatus('sent');
      setReply('');
      setTimeout(() => setStatus('idle'), 2000);
    }, 1200);
  };

  return (
    <div className="discord-card">
      <div className="discord-card__header">
        <div className="discord-card__meta">
          <span className="discord-card__server">{server}</span>
          <span className="discord-card__channel">#{channel}</span>
        </div>
        <PlatformPill platform="discord" />
      </div>

      <div className="discord-card__body">
        <div className="discord-card__avatar">{initials}</div>
        <div className="discord-card__content">
          <span className="discord-card__author">{author}</span>
          <p className="discord-card__message">{message}</p>
        </div>
      </div>

      <div className="discord-card__footer">
        <input 
          type="text" 
          placeholder={`Reply to #${channel}...`} 
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleReply()}
          disabled={status !== 'idle'}
        />
        <button 
          className={`discord-card__send-btn ${status !== 'idle' ? 'discord-card__send-btn--active' : ''}`}
          onClick={handleReply}
          disabled={!reply.trim() || status !== 'idle'}
        >
          <AnimatePresence mode="wait">
            {status === 'sending' ? (
              <motion.div key="sending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <MessageSquare size={14} className="spin-slow" />
              </motion.div>
            ) : status === 'sent' ? (
              <motion.div key="sent" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check size={14} />
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Send size={14} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
