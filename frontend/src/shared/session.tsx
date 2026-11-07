import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type Session } from "./api";
const Context = createContext<{
  session: Session | null | undefined;
  error: boolean;
  refresh: () => Promise<Session | null>;
  logout: () => Promise<void>;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>();
  const [error, setError] = useState(false);
  const generation = useRef(0);
  async function refresh() {
    const request = ++generation.current;
    try {
      const value = await api.session();
      if (request === generation.current) {
        setSession(value);
        setError(false);
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
  }
  useEffect(() => {
    void refresh().catch(() => {});
    return () => { ++generation.current; };
  }, []);
  return (
    <Context.Provider value={{ session, error, refresh, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing SessionProvider");
  return value;
}
