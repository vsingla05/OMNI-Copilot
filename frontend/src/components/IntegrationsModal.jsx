import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ChevronRight, Settings, FileText, MessageSquare, HardDrive } from 'lucide-react';
import './IntegrationsModal.css';

import axios from 'axios';

const INITIAL_PLATFORMS = [
  { id: 'google', name: 'Google Workspace', icon: HardDrive, status: 'connected', color: '#10B981' },
  { id: 'notion', name: 'Notion', icon: FileText, status: 'disconnected', color: '#000000' },
  { id: 'discord', name: 'Discord', icon: MessageSquare, status: 'disconnected', color: '#5865F2' },
  { id: 'local', name: 'Local Files', icon: Settings, status: 'toggle', color: '#6B7280' }
];

export default function IntegrationsModal({ isOpen, onClose }) {
  const [activeInput, setActiveInput] = useState(null);
  const [keys, setKeys] = useState({ notion: '', discord: '' });
  const [localEnabled, setLocalEnabled] = useState(true);
  const [platforms, setPlatforms] = useState(INITIAL_PLATFORMS);

  const handleSave = async (platId) => {
    const key = keys[platId]?.trim();
    if (key && key.length > 0) {
      try {
        await axios.post('http://localhost:8000/update-keys', {
          notion: platId === 'notion' ? key : '',
          discord: platId === 'discord' ? key : ''
        });
        setPlatforms(prev => prev.map(p => p.id === platId ? { ...p, status: 'connected' } : p));
      } catch (err) {
        console.error("Failed to update keys:", err);
      }
    }
    setActiveInput(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="int-modal-overlay"
        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
        animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
        onClick={onClose}
      >
        <motion.div 
          className="int-modal"
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
        >
          <header className="int-modal__header">
            <div>
              <h2>Integrations Hub</h2>
              <p>Connect Omni Copilot to your external platforms.</p>
            </div>
            <button className="int-modal__close" onClick={onClose}><X size={18} /></button>
          </header>

          <div className="int-modal__list">
            {platforms.map((plat) => (
              <div key={plat.id} className="int-modal__item">
                <div className="int-modal__item-info">
                  <div className="int-modal__icon-wrap" style={{ color: plat.color }}>
                    <plat.icon size={20} />
                  </div>
                  <div>
                    <h3>{plat.name}</h3>
                    {plat.status === 'connected' && <span className="int-modal__status int-modal__status--green">Connected</span>}
                  </div>
                </div>

                <div className="int-modal__item-action">
                  {plat.status === 'connected' && <CheckCircle2 color="#10B981" size={20} />}
                  
                  {plat.status === 'disconnected' && activeInput !== plat.id && (
                    <button className="int-modal__connect-btn" onClick={() => setActiveInput(plat.id)}>
                      Connect <ChevronRight size={14} />
                    </button>
                  )}

                  {plat.status === 'disconnected' && activeInput === plat.id && (
                    <motion.div 
                      className="int-modal__input-wrap"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 180 }}
                    >
                      <input 
                        type="password" 
                        placeholder="Paste API Key..." 
                        value={keys[plat.id]}
                        onChange={e => setKeys(p => ({ ...p, [plat.id]: e.target.value }))}
                        autoFocus
                      />
                      <button className="int-modal__save-btn" onClick={() => handleSave(plat.id)}>Save</button>
                    </motion.div>
                  )}

                  {plat.status === 'toggle' && (
                    <div 
                      className={`int-modal__toggle ${localEnabled ? 'int-modal__toggle--on' : ''}`}
                      onClick={() => setLocalEnabled(!localEnabled)}
                    >
                      <motion.div className="int-modal__toggle-knob" layout />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
