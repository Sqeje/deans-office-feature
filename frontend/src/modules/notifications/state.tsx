import { createContext, useContext, useEffect, useCallback, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import * as api from './api';
import './notifications.css';
function useLiveState() {
  const [feed, setFeed] = useState<api.Feed>({ items: [], unreadCount: 0 });
  const [state, setState] = useState<'loading' | 'error' | 'filled'>('loading');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const revision = useRef(0); const mounted = useRef(true); const lock = useRef(false);
  const location = useLocation();
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    try { const data = await api.load(); if (mounted.current && request === revision.current) { setFeed(data); setState('filled'); setError(''); } }
    catch (e) { if (mounted.current && request === revision.current) { setState('error'); setError(api.errorText(e)); } }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; revision.current++; }; }, []);
  useEffect(() => { void refresh(); }, [refresh, location.pathname]);
  useEffect(() => { const focus = () => { if (!lock.current) void refresh(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [refresh]);
  async function read(id?: string) {
    if (lock.current) return;
    lock.current = true; ++revision.current; setBusy(true); setError('');
    try { await api.read(id); if (mounted.current) await refresh(); }
    catch (e) { if (mounted.current) setError(api.errorText(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return { items: feed.items, state, error, busy, refresh, read, unread: state === 'filled' ? feed.unreadCount : null };
}
const Context = createContext<ReturnType<typeof useLiveState> | null>(null);
export function NotificationProvider({ children }: { children: ReactNode }) {
  const value = useLiveState(); return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useNotifications() {
  const value = useContext(Context); if (!value) throw new Error('Missing NotificationProvider'); return value;
}
export function NotificationCount() {
  const value = useContext(Context);
  return value?.unread ? <span className="notification-count" aria-label={`Непрочитанных уведомлений: ${value.unread}`}>{value.unread}</span> : null;
}
