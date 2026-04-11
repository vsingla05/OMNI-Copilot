import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, HardDrive, Calendar, PenSquare, Inbox } from 'lucide-react';
import CRUDCard from './CRUDCard';
import WritePanel from './WritePanel';
import NotionEditor from './NotionEditor';
import './Workspace.css';

/**
 * Workspace — right pane workbench.
 *
 * States:
 *   empty      — welcome/empty state with compose prompt
 *   inventory  — list of CRUDCards (mail/files/calendar)
 *   editor     — WritePanel for creating or editing
 *
 * Props:
 *   section    {'mail'|'files'|'calendar'|'chat'}
 *   items      [{id, type, data, status}]  — list from AI responses
 *   onDelete   {fn}  async (item) => void
 *   onUpdate   {fn}  async (actionId, fields) => string
 *   isOpen     {boolean}
 *   onClose    {fn}
 */
export default function Workspace({ section, items = [], onDelete, onUpdate, isOpen, onClose }) {
  const [mode, setMode]           = useState('empty');   // empty | inventory | editor
  const [editItem, setEditItem]   = useState(null);
  const [localItems, setLocalItems] = useState(items);

  // Sync from parent when items change
  React.useEffect(() => {
    if (items.length > 0) {
      setLocalItems(items);
      setMode('inventory');
    }
  }, [items]);

  const handleEdit = useCallback((item) => {
    setEditItem(item);
    setMode('editor');
  }, []);

  const handleDelete = useCallback(async (item) => {
    await onDelete?.(item);
    setLocalItems(prev => prev.filter(i => i.id !== item.id));
    if (localItems.length <= 1) setMode('empty');
  }, [onDelete, localItems]);

  const handleCompose = () => {
    setEditItem(null);
    setMode('editor');
  };

  const handleSubmit = async (actionId, fields) => {
    const result = await onUpdate?.(actionId, fields);
    if (editItem) {
      // Update the item locally on success
      setLocalItems(prev =>
        prev.map(i => i.id === editItem.id
          ? { ...i, data: { ...i.data, ...fields }, status: 'modified' }
          : i
        )
      );
      setMode('inventory');
      setEditItem(null);
    }
    return result;
  };

  const META = SECTION_META[section] || SECTION_META.mail;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          className="workspace"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0,  opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          aria-label="Workbench panel"
        >
          {/* Header */}
          <div className="workspace__header">
            <div className="workspace__header-icon" style={{ '--ws-color': META.color }}>
              <META.icon size={16} />
            </div>
            <div>
              <p className="workspace__header-title">{META.title}</p>
              <p className="workspace__header-sub">{META.sub}</p>
            </div>
            <div className="workspace__header-actions">
              {mode === 'inventory' && (
                <button className="workspace__compose-mini" onClick={handleCompose} aria-label="Compose new">
                  <PenSquare size={14} /> New
                </button>
              )}
              {mode === 'editor' && localItems.length > 0 && (
                <button className="workspace__back-btn" onClick={() => setMode('inventory')}>
                  ← Back
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="workspace__body">
            <AnimatePresence mode="wait">

              {/* Empty state */}
              {mode === 'empty' && (
                <motion.div
                  key="empty"
                  className="workspace__empty"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="workspace__empty-icon" style={{ '--ws-color': META.color }}>
                    <META.icon size={24} />
                  </div>
                  <p className="workspace__empty-title">Your {META.title} Workbench</p>
                  <p className="workspace__empty-sub">Ask the AI about your {section}, or compose a new item below.</p>
                  <button className="workspace__empty-cta" onClick={handleCompose}>
                    <PenSquare size={14} /> Compose New
                  </button>
                </motion.div>
              )}

              {/* Inventory — list of CRUD cards */}
              {mode === 'inventory' && (
                <motion.div
                  key="inventory"
                  className="workspace__inventory"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="workspace__inventory-count">
                    {localItems.length} item{localItems.length !== 1 ? 's' : ''}
                  </p>
                  <AnimatePresence>
                    {localItems.map(item => (
                      <CRUDCard
                        key={item.id}
                        item={item}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                  {localItems.length === 0 && (
                    <p className="workspace__inventory-empty">All items removed.</p>
                  )}
                </motion.div>
              )}

              {/* Editor — WritePanel or NotionEditor */}
              {mode === 'editor' && (
                <motion.div
                  key="editor"
                  className="workspace__editor"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {(editItem?.type === 'notion' || section === 'notion') ? (
                    <NotionEditor
                      initialTitle={editItem?.data?.title || ''}
                      initialBody={editItem?.data?.body || ''}
                      onClose={localItems.length > 0 ? () => setMode('inventory') : undefined}
                    />
                  ) : (
                    <WritePanel
                      mode={editItem ? 'edit' : 'compose'}
                      itemType={editItem?.type || (section === 'calendar' ? 'event' : section === 'files' ? 'file' : 'email')}
                      initialData={editItem?.data || {}}
                      onSubmit={handleSubmit}
                      onClose={localItems.length > 0 ? () => setMode('inventory') : undefined}
                    />
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ─── Section metadata ───────────────────────── */
const SECTION_META = {
  mail:     { title: 'Mail',     sub: 'Emails & Drafts',     icon: Mail,      color: '#F87171' },
  files:    { title: 'Drive',    sub: 'Files & Documents',    icon: HardDrive, color: '#34D399' },
  calendar: { title: 'Calendar', sub: 'Events & Schedule',    icon: Calendar,  color: '#60A5FA' },
  chat:     { title: 'Chat',     sub: 'AI Conversation',      icon: Inbox,     color: '#818CF8' },
};
