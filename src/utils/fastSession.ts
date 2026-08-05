// Synchronously read the persisted Supabase session from localStorage so the
// dashboard can paint immediately instead of waiting for an async getSession().
export function readCachedUser(): { id: string; email?: string } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession || parsed;
      const user = session?.user;
      const expiresAt = session?.expires_at;
      if (!user?.id) continue;
      if (expiresAt && Date.now() / 1000 > Number(expiresAt)) continue;
      return { id: user.id, email: user.email };
    }
  } catch {
    // Ignore parse/storage errors; async getSession remains the source of truth.
  }
  return null;
}
