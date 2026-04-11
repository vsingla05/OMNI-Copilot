import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertCircle, Info } from 'lucide-react';
import './SuccessNotification.css';

/* ─── Toast Context ──────────────────────────── */
const ToastContext = createContext(null);

const ICONS = {
  success: Check,
  error:   AlertCircle,
  info:    Info,
};

const DURATION = { success: 3800, error: 5000, info: 4000 };

/* ─── Individual Toast ───────────────────────── */
function Toast({ id, message, type = 'success', onDismiss }) {
  const Icon = ICONS[type] || Check;

  return (
    <motion.div
      className={`toast toast--${type}`}
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0,  scale: 1,
                 transition: { type: 'spring', stiffness: 320, damping: 22 } }}
      exit={{    opacity: 0, x: 60, scale: 0.92,
                 transition: { duration: 0.22 } }}
      layout
    >
      <div className="toast__icon-wrap">
        <Icon size={15} strokeWidth={2.5} />
      </div>
      <p className="toast__message">{message}</p>
      <button
        className="toast__close"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        <X size={13} />
      </button>

      {/* Progress bar */}
      <motion.div
        className="toast__progress"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: DURATION[type] / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

/* ─── Toast Provider ─────────────────────────── */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, DURATION[type] || 4000);

    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast container — portal-like fixed layer */}
      <div className="toast-container" aria-label="Notifications">
        <AnimatePresence>
          {toasts.map(t => (
            <Toast key={t.id} {...t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/* ─── Hook ───────────────────────────────────── */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
