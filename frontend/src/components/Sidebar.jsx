import React, { useState } from 'react';
import { Mail, HardDrive, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import './Sidebar.css';

const services = [
  {
    id: 'mail',
    label: 'Gmail',
    icon: Mail,
    connected: true,
    color: '#F87171',
  },
  {
    id: 'drive',
    label: 'Drive',
    icon: HardDrive,
    connected: true,
    color: '#34D399',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    connected: true,
    color: '#60A5FA',
  },
];

/**
 * Sidebar — collapsible, minimalist, shows service icons with lavender pulse
 */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`} aria-label="Service sidebar">
      {/* Logo / brand mark */}
      <div className="sidebar__header">
        <div className="sidebar__logo" aria-label="Omni Copilot">
          <span className="sidebar__logo-mark">✦</span>
          {!collapsed && <span className="sidebar__logo-text">Omni</span>}
        </div>
        <button
          className="sidebar__toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Service icons */}
      <nav className="sidebar__nav" aria-label="Connected services">
        {!collapsed && (
          <p className="sidebar__section-label">Services</p>
        )}
        {services.map(({ id, label, icon: Icon, connected, color }) => (
          <div
            key={id}
            className={`sidebar__item ${connected ? 'sidebar__item--connected' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${label}${connected ? ' (connected)' : ''}`}
          >
            <span className="sidebar__item-icon">
              <Icon size={18} />
            </span>
            {!collapsed && (
              <span className="sidebar__item-label">{label}</span>
            )}
            {connected && (
              <span
                className="sidebar__pulse"
                style={{ '--pulse-color': color }}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <div className="sidebar__avatar" aria-label="User account">
          U
        </div>
        {!collapsed && (
          <div className="sidebar__footer-info">
            <p className="sidebar__footer-name">User</p>
            <p className="sidebar__footer-sub">Connected</p>
          </div>
        )}
      </div>
    </aside>
  );
}
