import React from 'react';
import './StatusPill.css';

/**
 * StatusPill — glassmorphic badge showing which model/service handled the response.
 * Props:
 *   model {string}  — e.g. "Gmail Agent" | "Drive Agent" | "Calendar Agent"
 */
export default function StatusPill({ model }) {
  const label = model || 'Omni Agent';

  // Pick a subtle hue per service
  const colorMap = {
    'Gmail':    '#F87171',
    'Drive':    '#34D399',
    'Calendar': '#60A5FA',
    'Omni':     '#818CF8',
  };
  const key = Object.keys(colorMap).find(k => label.includes(k)) || 'Omni';
  const dotColor = colorMap[key];

  return (
    <span className="status-pill glass" aria-label={`Powered by ${label}`}>
      <span className="status-pill__dot" style={{ background: dotColor }} />
      <span className="status-pill__label">{label}</span>
    </span>
  );
}
