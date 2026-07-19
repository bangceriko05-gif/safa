import { supabase } from "@/integrations/supabase/client";

const ADMIN_ROLES = new Set(["admin", "owner", "akuntan"]);
const TTL_MS = 60_000;

type PermissionAccess = {
  names: Set<string>;
  role: string | null;
};

const cache = new Map<string, { at: number; data: PermissionAccess }>();
const inflight = new Map<string, Promise<PermissionAccess>>();

export async function fetchCurrentUserPermissionAccess(
  knownRole?: string | null,
  force = false
): Promise<PermissionAccess> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) return { names: new Set(), role: null };

  const cacheKey = `${user.id}:${knownRole ?? "unknown"}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (!force && hit && now - hit.at < TTL_MS) return hit.data;

  const existing = inflight.get(cacheKey);
  if (!force && existing) return existing;

  const request = (async () => {
    let role = knownRole ?? null;

    if (!role) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      role = roleData?.role ?? "user";
    }

    if (ADMIN_ROLES.has(role)) {
      const data = { names: new Set(["__admin__"]), role };
      cache.set(cacheKey, { at: Date.now(), data });
      return data;
    }

    const { data: userPerms, error } = await supabase
      .from("user_permissions")
      .select("permission_id, permissions(name)")
      .eq("user_id", user.id);

    if (error) throw error;

    const names = new Set<string>();
    userPerms?.forEach((up: any) => {
      const name = up.permissions?.name;
      if (name) names.add(name);
    });

    const data = { names, role };
    cache.set(cacheKey, { at: Date.now(), data });
    return data;
  })().finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, request);
  return request;
}

export function clearPermissionCache() {
  cache.clear();
  inflight.clear();
}