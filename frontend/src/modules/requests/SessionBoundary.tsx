import { useLayoutEffect, type ReactNode } from 'react';
import { useSession } from '../../shared/session';
import { resetRequestSession } from './model';
export function RequestsSessionBoundary({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const key = session ? `${session.universityId}/${session.userId}` : undefined;
  useLayoutEffect(() => { resetRequestSession(key); return () => resetRequestSession(undefined); }, [key]);
  return <>{children}</>;
}
