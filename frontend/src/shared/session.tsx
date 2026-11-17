import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type Session } from "./api";
import { announceSessionChange, bindTabAccount, invalidateTabAccount, tabAccount, tabLoginPending, watchTabAccount } from "../modules/identity/tabAccount";
const Context = createContext<{
  session: Session | null | undefined;
  error: boolean;
  accountChanged: boolean;
  refresh: (afterLogin?: boolean) => Promise<Session | null>;
  logout: () => Promise<void>;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>();
  const [error, setError] = useState(false);
  const [accountChanged, setAccountChanged] = useState(() => tabAccount().blocked);
  const generation = useRef(0);
  async function refresh(afterLogin = false) {
    if (!afterLogin && tabLoginPending()) return null;
    if (!afterLogin && tabAccount().blocked) { setSession(null); return null; }
    const request = ++generation.current;
    try {
      const value = await api.session(afterLogin);
      if (request === generation.current) {
        if (value && !afterLogin && tabAccount().userId && tabAccount().userId !== value.userId) {
          invalidateTabAccount(); return null;
        }
        if (value) bindTabAccount(value.userId);
        setSession(value);
        setError(false);
        if (afterLogin && value) { setAccountChanged(false); announceSessionChange(); }
      }
      return value;
    } catch (e) {
      if (request === generation.current) setError(true);
      throw e;
    }
  }
  async function logout() {
    ++generation.current;
    await api.logout();
    ++generation.current;
    setSession(null);
    invalidateTabAccount();
    announceSessionChange();
  }
  useEffect(() => {
    const stop = watchTabAccount(() => {
      ++generation.current;
      setSession(null); setError(false); setAccountChanged(true);
    }, () => { void refresh().catch(() => {}); });
    const verify = () => { if (!document.hidden) void refresh().catch(() => {}); };
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);
    const timer = window.setInterval(verify, 15000);
    void refresh().catch(() => {});
    return () => {
      ++generation.current; stop(); window.clearInterval(timer);
      window.removeEventListener("focus", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  }, []);
  return (
    <Context.Provider value={{ session, error, accountChanged, refresh, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing SessionProvider");
  return value;
}
