/**
 * Staff sign-in refusals (U5 Step 13, BR1.7). Any 401 from the staff API sends the screen back to the PIN
 * screen. Staff requests go through staffFetch, which tells the listeners (the staff session hook) when
 * one comes back 401. The PIN login itself does not use it: a wrong PIN is also a 401, and is not a refusal.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

/** Listen for staff refusals; returns the function that stops listening. */
export function onStaffUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyStaffUnauthorized(): void {
  for (const listener of [...listeners]) listener();
}

/** fetch for a staff route: a 401 answer returns the screen to the PIN screen. The response is returned as is. */
export async function staffFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // With no options, fetch is called with the address alone, exactly as before the wrapper (an extra
  // undefined argument would change what a caller or a test sees).
  const res = init === undefined ? await fetch(input) : await fetch(input, init);
  if (res.status === 401) notifyStaffUnauthorized();
  return res;
}
