import React from 'react';
import { HardDrive, FileText, MessageSquare } from 'lucide-react';
import './PlatformPill.css';

const PLATFORM_CONFIG = {
  drive:   { label: 'Drive',   icon: HardDrive,   color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' },
  notion:  { label: 'Notion',  icon: FileText,    color: '#000000', bg: 'rgba(0, 0, 0, 0.06)' },
  discord: { label: 'Discord', icon: MessageSquare, color: '#5865F2', bg: 'rgba(88, 101, 242, 0.1)' },
  gmail:   { label: 'Gmail',   icon: null,        color: '#F87171', bg: 'rgba(248, 113, 113, 0.1)' } // Optional placeholder
};

export default function PlatformPill({ platform }) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.drive;
  const Icon = config.icon;

  return (
    <div 
      className="platform-pill" 
      style={{ color: config.color, backgroundColor: config.bg, borderColor: config.color }}
    >
      {Icon && <Icon size={10} strokeWidth={3} />}
      <span>{config.label}</span>
    </div>
  );
}
