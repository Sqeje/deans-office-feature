// This is a UI identity binding, not a credential. Authentication remains in the HttpOnly cookie.
const storageKey = "dean.tab-account";
const invalidatedEvent = "dean:account-invalidated";
export const accountHeader = "X-Dean-Account";
type Binding = { userId?: string; blocked: boolean };
function read(): Binding {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    return { userId: typeof value?.userId === "string" ? value.userId : undefined, blocked: value?.blocked === true };
  } catch { return { blocked: false }; }
}
let binding = read();
let channel: BroadcastChannel | undefined;
let loggingIn = false;
export const tabLoginPending = () => loggingIn;
export function setTabLoginPending(value: boolean) { loggingIn = value; }
function store(value: Binding) {
  binding = value;
  try { sessionStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Memory binding still protects the current document. */ }
}
export const tabAccount = () => binding;
export function bindTabAccount(userId: string) { store({ userId, blocked: false }); }
export function invalidateTabAccount() {
  store({ ...binding, blocked: true });
  window.dispatchEvent(new Event(invalidatedEvent));
}
export function announceSessionChange() { channel?.postMessage("session-changed"); }
export function watchTabAccount(invalidated: () => void, changedElsewhere: () => void) {
  window.addEventListener(invalidatedEvent, invalidated);
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("dean-session");
    channel.onmessage = e => { if (e.data === "session-changed") changedElsewhere(); };
  }
  return () => {
    window.removeEventListener(invalidatedEvent, invalidated);
    channel?.close(); channel = undefined;
  };
}
