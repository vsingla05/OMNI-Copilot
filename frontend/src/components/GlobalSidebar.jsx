import React from 'react';
import {
  Mail, Calendar, HardDrive, FileText, MessageSquare,
  Hash, Code, ClipboardList,
  ChevronLeft, ChevronRight, PenSquare, Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './GlobalSidebar.css';

const NAV_ITEMS = [
  { id: 'omni', label: 'Omni Chat', icon: MessageSquare, dot: '#818CF8' },
];

/**
 * GlobalSidebar — slim left navigation for 8 context tabs.
 */
export default function GlobalSidebar({ activeSection, onSectionChange, onCompose, collapsed, onCollapse, onSettingsClick }) {
  return (
    <aside
      className={`global-sidebar ${collapsed ? 'global-sidebar--collapsed' : ''}`}
      aria-label="Global navigation"
    >
      {/* Logo */}
      <div className="global-sidebar__logo">
        <span className="global-sidebar__logo-mark">✦</span>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="global-sidebar__logo-text"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              Omni
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="global-sidebar__nav" aria-label="Main navigation">
        {!collapsed && <p className="global-sidebar__section-label">Workspace</p>}
        {NAV_ITEMS.map(({ id, label, icon: Icon, dot }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              id={`nav-${id}`}
              className={`global-sidebar__item ${isActive ? 'global-sidebar__item--active' : ''}`}
              onClick={() => onSectionChange(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="global-sidebar__item-icon">
                <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
              </span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    className="global-sidebar__item-label"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {dot && (
                <span
                  className={`global-sidebar__dot ${collapsed ? 'global-sidebar__dot--floating' : ''}`}
                  style={{ '--dot-color': dot }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Compose button */}
      <button
        id="compose-btn"
        className="global-sidebar__compose"
        onClick={onCompose}
        aria-label="Compose new item"
      >
        <PenSquare size={16} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
            >
              Compose
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Settings toggle */}
      <button
        className="global-sidebar__settings"
        onClick={onSettingsClick}
        aria-label="Integrations Hub"
      >
        <Settings size={18} />
      </button>

      {/* Collapse toggle */}
      <button
        className="global-sidebar__toggle"
        onClick={onCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}
