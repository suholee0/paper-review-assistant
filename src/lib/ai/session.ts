const SESSION_PREFIX = "codex:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only resume threads created by this provider, never another runtime's IDs. */
export function codexThreadId(sessionId?: string | null): string | undefined {
  if (!sessionId?.startsWith(SESSION_PREFIX)) return undefined;
  const id = sessionId.slice(SESSION_PREFIX.length);
  return UUID_RE.test(id) ? id : undefined;
}

export function codexSessionId(threadId: string): string {
  if (!UUID_RE.test(threadId)) throw new Error("Codex returned an invalid thread ID.");
  return SESSION_PREFIX + threadId;
}
