import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import GlobalSidebar from './components/GlobalSidebar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import Workspace from './components/Workspace';
import { ToastProvider, useToast } from './components/SuccessNotification';
import './App.css';

const API_BASE = 'http://localhost:8000';

const WELCOME = {
  role: 'assistant',
  text: "Hey there! I'm Omni Copilot ✦\n\nI can read, compose, and manage your Gmail, Drive, and Calendar. Try asking:\n• \"Show my latest emails\"\n• \"List my Drive files\"\n• \"What events do I have coming up?\"\n\nYou can also click **Compose** in the sidebar to create something new!",
};

/* ════════════════════════════════════════════════
   Utility — parse AI text into CRUD items
   ════════════════════════════════════════════════ */
let _id = 0;
function parseItemsFromText(text = '') {
  const items = [];
  text.split('\n').filter(Boolean).forEach(line => {
    // Attempt to grab actual backend ID if present
    const idMatch = line.match(/^ID:\s*([^\s\|]+)\s*\|\s*(.*)$/i);
    let id = idMatch ? idMatch[1] : `item-${++_id}`;
    let content = idMatch ? idMatch[2] : line;

    const emailMatch = content.match(/^From:\s*(.+?)\s*\|\s*Subject:\s*(.+)$/i);
    if (emailMatch) {
      items.push({ id, type: 'email', status: 'sent', data: { from: emailMatch[1], subject: emailMatch[2] } });
    }
    const fileMatch = content.match(/^File:\s*(.+)$/i);
    if (fileMatch) {
      items.push({ id, type: 'file', status: 'modified', data: { name: fileMatch[1] } });
    }
    const eventMatch = content.match(/^Event:\s*(.+?)\s*\|\s*At:\s*(.+)$/i);
    // Add fallback for old regex just in case
    const eventMatchLegacy = content.match(/^Event:\s*(.+?)\s+at\s+(.+)$/i);
    if (eventMatch || eventMatchLegacy) {
      const match = eventMatch || eventMatchLegacy;
      items.push({ id, type: 'event', status: 'upcoming', data: { title: match[1], start: match[2] } });
    }
  });
  return items;
}

/* ════════════════════════════════════════════════
   Inner App
   ════════════════════════════════════════════════ */
function AppInner() {
  const { addToast } = useToast();

  // Layout state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection]       = useState('chat');
  const [isMobile, setIsMobile]                 = useState(window.innerWidth < 900);
  const [mobileTab, setMobileTab]               = useState('chat'); // 'chat' | 'workspace'

  // Chat state
  const [messages, setMessages]   = useState([WELCOME]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);

  // Workspace state
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceItems, setWorkspaceItems] = useState([]);
  const [workspaceSection, setWorkspaceSection] = useState('mail');

  // Responsive listener
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  /* ── Section change ──────────────────────────── */
  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (section !== 'chat') {
      setWorkspaceSection(section);
      setWorkspaceOpen(true);
      if (isMobile) setMobileTab('workspace');
    } else {
      if (isMobile) setMobileTab('chat');
    }
  };

  /* ── Compose ─────────────────────────────────── */
  const handleCompose = () => {
    setWorkspaceOpen(true);
    setWorkspaceItems([]); // empty = compose mode
    if (isMobile) setMobileTab('workspace');
  };

  /* ── Chat send ───────────────────────────────── */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await axios.post(`${API_BASE}/chat`, { message: text });
      const response = data.response;
      setMessages(prev => [...prev, { role: 'assistant', text: response }]);

      // Parse items for workspace
      const parsed = parseItemsFromText(response);
      if (parsed.length > 0) {
        setWorkspaceItems(parsed);
        setWorkspaceSection(
          parsed[0].type === 'file' ? 'files' :
          parsed[0].type === 'event' ? 'calendar' : 'mail'
        );
        setWorkspaceOpen(true);
      }

      const lower = response.toLowerCase();
      if (lower.includes('sent successfully'))    addToast('Email sent! ✉️', 'success');
      if (lower.includes('created successfully')) addToast('Event created! 📅', 'success');

    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Request failed.';
      setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${msg}` }]);
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Confirm action (draft editors) ──────────── */
  const handleConfirmAction = useCallback(async (confirmMessage) => {
    try {
      const { data } = await axios.post(`${API_BASE}/chat`, { message: confirmMessage });
      const response = data.response;
      setMessages(prev => [...prev, { role: 'assistant', text: response }]);
      const lower = response.toLowerCase();
      if (lower.includes('success')) addToast('Done!', 'success');
      else addToast(response.slice(0, 80), 'info');
      return response;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      addToast(msg, 'error');
      throw err;
    }
  }, [addToast]);

  /* ── CRUD handlers ───────────────────────────── */
  const handleDelete = useCallback(async (item) => {
    try {
      let endpoint = '';
      if (item.type === 'email') endpoint = `/email/trash/${item.id}`;
      else if (item.type === 'file') endpoint = `/drive/delete/${item.id}`;
      else if (item.type === 'event') endpoint = `/calendar/delete/${item.id}`;
      
      await axios.delete(`${API_BASE}${endpoint}`);
      addToast(`${item.type} deleted`, 'success');
    } catch {
      addToast(`Removed from view`, 'info');
    }
  }, [addToast]);

  const handleUpdate = useCallback(async (actionId, fields) => {
    try {
      let endpoint = '';
      if (actionId === 'email') endpoint = '/email/send';
      else if (actionId === 'drive') endpoint = '/drive/upload';
      else if (actionId === 'calendar') endpoint = '/calendar/create';

      const { data } = await axios.post(`${API_BASE}${endpoint}`, fields);
      addToast('Saved successfully!', 'success');
      return data.response || 'Saved successfully';
    } catch (err) {
       // fallback: post to /chat
       const msg = `fallback error: ${err.message}`;
       return handleConfirmAction(msg);
    }
  }, [handleConfirmAction, addToast]);

  /* ── Render helpers ──────────────────────────── */
  const chatPane = (
    <div className="app-chat-pane">
      <header className="app-topbar">
        <div className="app-topbar__inner">
          <h1 className="app-topbar__title">
            <span className="app-topbar__star">✦</span> Omni Copilot
          </h1>
          <p className="app-topbar__sub">Your intelligent Google Workspace agent</p>
        </div>
      </header>
      <section className="app-chat" aria-label="Conversation">
        <MessageList messages={messages} isLoading={isLoading} onConfirmAction={handleConfirmAction} />
        <div ref={bottomRef} />
      </section>
      <footer className="app-footer">
        <ChatInput value={input} onChange={setInput} onSend={handleSend} isLoading={isLoading} />
      </footer>
    </div>
  );

  const workspacePane = (
    <Workspace
      section={workspaceSection}
      items={workspaceItems}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
      isOpen={workspaceOpen}
      onClose={() => setWorkspaceOpen(false)}
    />
  );

  return (
    <div className="app-shell">
      <GlobalSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onCompose={handleCompose}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(c => !c)}
      />

      {isMobile ? (
        /* ── Mobile: tabbed view ── */
        <div className="app-main app-main--mobile">
          <div className="mobile-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mobileTab === 'chat'}
              className={`mobile-tab ${mobileTab === 'chat' ? 'mobile-tab--active' : ''}`}
              onClick={() => setMobileTab('chat')}
            >Chat</button>
            <button
              role="tab"
              aria-selected={mobileTab === 'workspace'}
              className={`mobile-tab ${mobileTab === 'workspace' ? 'mobile-tab--active' : ''}`}
              onClick={() => { setMobileTab('workspace'); setWorkspaceOpen(true); }}
            >Workbench</button>
          </div>
          <div className="mobile-content">
            {mobileTab === 'chat' ? chatPane : workspacePane}
          </div>
        </div>
      ) : (
        /* ── Desktop: dual-pane ── */
        <main className="app-main" id="main-content">
          {chatPane}
          {workspaceOpen && workspacePane}
          {!workspaceOpen && (
            <button
              className="workspace-open-hint"
              onClick={handleCompose}
              aria-label="Open workbench"
            >
              <span>✦</span> Open Workbench
            </button>
          )}
        </main>
      )}
    </div>
  );
}

/* ── Root export ── */
export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
