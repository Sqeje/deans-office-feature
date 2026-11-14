import { createContext, useContext, useState, type ReactNode } from 'react';
import { notificationExamples } from './demo';
import './notifications.css';
export type DemoState = 'filled' | 'empty' | 'loading' | 'error';
function useDemoState() {
  const [state, setState] = useState<DemoState>('filled');
  const [items, setItems] = useState(() => notificationExamples.map(item => ({ ...item })));
  function select(next: DemoState) {
    setItems(next === 'empty' ? [] : notificationExamples.map(item => ({ ...item })));
    setState(next);
  }
  return { state, items, select,
    unread: state === 'loading' || state === 'error' ? null : items.filter(item => item.unread).length,
    read: (id?: string) => setItems(current => current.map(item => id === undefined || item.id === id ? { ...item, unread: false } : item)),
  };
}
const Context = createContext<ReturnType<typeof useDemoState> | null>(null);
export function NotificationDemoProvider({ children }: { children: ReactNode }) {
  const value = useDemoState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useNotificationDemo() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing NotificationDemoProvider');
  return value;
}
export function NotificationCount() {
  const value = useContext(Context);
  return value?.unread ? <span className="notification-count" aria-label={`Непрочитанных уведомлений: ${value.unread}`}>{value.unread}</span> : null;
}
