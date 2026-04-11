import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import GlobalSidebar from './components/GlobalSidebar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import Workspace from './components/Workspace';
import IntegrationsModal from './components/IntegrationsModal';
import { ToastProvider, useToast } from './components/SuccessNotification';
import './App.css';

const API_BASE = 'http://localhost:8000';

/* ── Context-specific titles ── */
const CONTEXT_HEADER = {
  email:    { title: 'Email Copilot',           sub: 'Read, compose, and manage your Gmail',          color: '#F87171' },
  calendar: { title: 'Calendar Intelligence',   sub: 'Create, query, and organize your schedule',     color: '#60A5FA' },
  drive:    { title: 'Drive Navigator',          sub: 'Search, upload, and manage your files',         color: '#34D399' },
  notion:   { title: 'Notion Workspace',         sub: 'Search, create, and draft Notion pages',        color: '#1a1a1a' },
  discord:  { title: 'Discord Intelligence',     sub: 'Read channels and send messages',               color: '#5865F2' },
  slack:    { title: 'Slack Agent',              sub: 'Browse conversations and post messages',        color: '#E01E5A' },
  code:     { title: 'Code Explorer',            sub: 'Read and explore local code files',             color: '#A78BFA' },
  forms:    { title: 'Forms Builder',            sub: 'Create Google Forms and read responses',        color: '#FBBF24' },
};

const WELCOME_MESSAGES = {
  email:    "Hey there! I'm your Email Copilot ✦\n\nAsk me anything about your Gmail:\n• \"Show my latest emails\"\n• \"Send an email to hr@company.com\"\n• \"Delete that email\"",
  calendar: "Hey there! I'm your Calendar Agent ✦\n\nI manage your Google Calendar:\n• \"What events do I have today?\"\n• \"Create a meeting at 3 PM tomorrow\"\n• \"Cancel my 4 PM standup\"",
  drive:    "Hey there! I'm your Drive Navigator ✦\n\nI can explore your Google Drive:\n• \"List my Drive files\"\n• \"Search for project docs\"\n• \"Upload a new document\"",
  notion:   "Hey there! I'm your Notion Agent ✦\n\nI work with your Notion workspace:\n• \"Search my Notion pages\"\n• \"Create a page titled 'Roadmap'\"\n• \"Draft meeting notes\"",
  discord:  "Hey there! I'm your Discord Agent ✦\n\nI can interact with your Discord servers:\n• \"Read my Discord messages\"\n• \"Send a message to #general\"\n• \"Check latest activity\"",
  slack:    "Hey there! I'm your Slack Agent ✦\n\nI can browse your Slack workspace:\n• \"Check my Slack messages\"\n• \"Post an update to #engineering\"\n• \"Read the latest threads\"",
  code:     "Hey there! I'm your Code Explorer ✦\n\nI can read local files on your machine:\n• \"List files in my project\"\n• \"Read the README.md\"\n• \"Show me the config file\"",
  forms:    "Hey there! I'm your Forms Builder ✦\n\nI can create Google Forms:\n• \"Create a feedback survey\"\n• \"Build a form with 5 questions\"\n• \"Read form responses\"",
};

/* ════════════════════════════════════════════════
   Utility — parse AI text into CRUD items
   ════════════════════════════════════════════════ */
let _id = 0;
function parseItemsFromText(text = '') {
  const items = [];
  text.split('\n').filter(Boolean).forEach(line => {
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
    const eventMatchLegacy = content.match(/^Event:\s*(.+?)\s+at\s+(.+)$/i);
    if (eventMatch || eventMatchLegacy) {
      const match = eventMatch || eventMatchLegacy;
      items.push({ id, type: 'event', status: 'upcoming', data: { title: match[1], start: match[2] } });
    }
    const discordMatch = content.match(/^Discord:\s*(.+?)\s*\|\s*Channel:\s*(.+?)\s*\|\s*Author:\s*(.+?)\s*\|\s*Msg:\s*(.+)$/i);
    if (discordMatch) {
      items.push({ id, type: 'discord', status: 'read', data: { server: discordMatch[1], channel: discordMatch[2], author: discordMatch[3], message: discordMatch[4] } });
    }
    const notionMatch = content.match(/^Notion:\s*(.+?)\s*\|\s*Title:\s*(.+)$/i);
    if (notionMatch) {
      items.push({ id, type: 'notion', status: 'draft', data: { workspace: notionMatch[1], title: notionMatch[2] } });
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
  const [activeSection, setActiveSection]       = useState('email');
  const [isMobile, setIsMobile]                 = useState(window.innerWidth < 900);
  const [mobileTab, setMobileTab]               = useState('chat');
  const [isIntegrationsOpen, setIntegrationsOpen] = useState(false);

  // Per-context chat history
  const [chatHistories, setChatHistories] = useState(() => {
    const h = {};
    for (const key of Object.keys(WELCOME_MESSAGES)) {
      h[key] = [{ role: 'assistant', text: WELCOME_MESSAGES[key] }];
    }
    return h;
  });

  // Chat state
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const bottomRef = useRef(null);

  // Workspace state
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceItems, setWorkspaceItems] = useState([]);
  const [workspaceSection, setWorkspaceSection] = useState('mail');

  // Active messages
  const messages = chatHistories[activeSection] || [];

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  /* ── Section change ── */
  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (section === 'email') setWorkspaceSection('mail');
    else if (section === 'drive') setWorkspaceSection('files');
    else setWorkspaceSection(section);
  };

  /* ── Compose ── */
  const handleCompose = () => {
    setWorkspaceOpen(true);
    setWorkspaceItems([]);
    if (isMobile) setMobileTab('workspace');
  };

  /* ── Chat send ── */
  const handleSend = async (imageBase64 = null) => {
    const text = input.trim();
    if (!text || isLoading) return;

    setChatHistories(prev => ({
      ...prev,
      [activeSection]: [...(prev[activeSection] || []), { role: 'user', text }]
    }));
    setInput('');
    setIsLoading(true);

    try {
      const payload = {
        message: text,
        context: activeSection.charAt(0).toUpperCase() + activeSection.slice(1),
      };
      if (imageBase64) payload.image_data = imageBase64;

      const { data } = await axios.post(`${API_BASE}/chat`, payload);
      const response = data.response;

      setChatHistories(prev => ({
        ...prev,
        [activeSection]: [...(prev[activeSection] || []), { role: 'assistant', text: response }]
      }));

      const parsed = parseItemsFromText(response);
      if (parsed.length > 0) {
        setWorkspaceItems(parsed);
        setWorkspaceSection(
          parsed[0].type === 'file' ? 'files' :
          parsed[0].type === 'event' ? 'calendar' :
          parsed[0].type === 'discord' ? 'discord' :
          parsed[0].type === 'notion' ? 'notion' : 'mail'
        );
        setWorkspaceOpen(true);
      }

      const lower = response.toLowerCase();
      if (lower.includes('sent successfully'))    addToast('Sent! ✉️', 'success');
      if (lower.includes('created successfully')) addToast('Created! ✦', 'success');
      if (lower.includes('deleted successfully')) addToast('Deleted!', 'success');

    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Request failed.';
      setChatHistories(prev => ({
        ...prev,
        [activeSection]: [...(prev[activeSection] || []), { role: 'assistant', text: `⚠️ ${msg}` }]
      }));
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
      setPendingImage(null);
    }
  };

  /* ── Confirm action (draft editors) ── */
  const handleConfirmAction = useCallback(async (confirmMessage) => {
    try {
      const { data } = await axios.post(`${API_BASE}/chat`, {
        message: confirmMessage,
        context: activeSection.charAt(0).toUpperCase() + activeSection.slice(1)
      });
      const response = data.response;
      setChatHistories(prev => ({
        ...prev,
        [activeSection]: [...(prev[activeSection] || []), { role: 'assistant', text: response }]
      }));
      const lower = response.toLowerCase();
      if (lower.includes('success')) addToast('Done!', 'success');
      else addToast(response.slice(0, 80), 'info');
      return response;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      addToast(msg, 'error');
      throw err;
    }
  }, [addToast, activeSection]);

  /* ── CRUD handlers ── */
  const handleDelete = useCallback(async (item) => {
    try {
      let endpoint = '';
      if (item.type === 'email') endpoint = `/email/trash/${item.id}`;
      else if (item.type === 'file') endpoint = `/drive/delete/${item.id}`;
      else if (item.type === 'event') endpoint = `/calendar/delete/${item.id}`;
      await axios.delete(`${API_BASE}${endpoint}`);
      addToast(`${item.type} deleted`, 'success');
    } catch {
      addToast('Removed from view', 'info');
    }
  }, [addToast]);

  const handleUpdate = useCallback(async (actionId, fields) => {
    if (actionId === 'document') {
      const destination = fields.destination === 'notion' ? 'Notion' : 'Google Docs';
      const command = `Please create a ${destination} page titled "${fields.title}" with the content "${fields.body}".`;
      return handleConfirmAction(command);
    }
    if (actionId === 'message') {
      const command = `Please send a message to the "${fields.channel}" channel with the following text: ${fields.body}`;
      return handleConfirmAction(command);
    }
    if (actionId === 'form') {
      const command = `Please create a Google Form titled "${fields.title}" with the following questions (split by lines):\n${fields.questions}`;
      return handleConfirmAction(command);
    }
    try {
      let endpoint = '';
      if (actionId === 'email') endpoint = '/email/send';
      else if (actionId === 'drive') endpoint = '/drive/upload';
      else if (actionId === 'calendar') endpoint = '/calendar/create';
      const { data } = await axios.post(`${API_BASE}${endpoint}`, fields);
      addToast('Saved!', 'success');
      return data.response || 'Saved successfully';
    } catch (err) {
      return handleConfirmAction(`fallback: ${err.message}`);
    }
  }, [handleConfirmAction, addToast]);

  /* ── Dynamic header ── */
  const header = CONTEXT_HEADER[activeSection] || CONTEXT_HEADER.email;

  /* ── Render ── */
  const chatPane = (
    <div className="app-chat-pane">
      <header className="app-topbar">
        <div className="app-topbar__inner">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <h1 className="app-topbar__title">
                <span className="app-topbar__star" style={{ color: header.color }}>✦</span> {header.title}
              </h1>
              <p className="app-topbar__sub">{header.sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="app-topbar__context-pill" style={{ '--ctx-color': header.color }}>
          {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
        </div>
      </header>
      <section className="app-chat" aria-label="Conversation">
        <MessageList messages={messages} isLoading={isLoading} onConfirmAction={handleConfirmAction} />
        <div ref={bottomRef} />
      </section>
      <footer className="app-footer">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          context={activeSection}
          onImageAttach={setPendingImage}
        />
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
        onSettingsClick={() => setIntegrationsOpen(true)}
      />
      <IntegrationsModal isOpen={isIntegrationsOpen} onClose={() => setIntegrationsOpen(false)} />

      {isMobile ? (
        <div className="app-main app-main--mobile">
          <div className="mobile-tabs" role="tablist">
            <button role="tab" aria-selected={mobileTab === 'chat'} className={`mobile-tab ${mobileTab === 'chat' ? 'mobile-tab--active' : ''}`} onClick={() => setMobileTab('chat')}>Chat</button>
            <button role="tab" aria-selected={mobileTab === 'workspace'} className={`mobile-tab ${mobileTab === 'workspace' ? 'mobile-tab--active' : ''}`} onClick={() => { setMobileTab('workspace'); setWorkspaceOpen(true); }}>Workbench</button>
          </div>
          <div className="mobile-content">{mobileTab === 'chat' ? chatPane : workspacePane}</div>
        </div>
      ) : (
        <main className="app-main" id="main-content">
          {chatPane}
          {workspaceOpen && workspacePane}
          {!workspaceOpen && (
            <button className="workspace-open-hint" onClick={handleCompose} aria-label="Open workbench">
              <span>✦</span> Open Workbench
            </button>
          )}
        </main>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
