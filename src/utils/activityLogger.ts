import { supabase } from "@/integrations/supabase/client";

export type ActionType = 'created' | 'updated' | 'deleted' | 'login' | 'check-in' | 'check-out' | 'confirm';

interface LogActivityParams {
  actionType: ActionType;
  entityType: string;
  entityId?: string;
  description: string;
  storeId?: string;
}

const USER_CONTEXT_TTL_MS = 60_000;
const userContextCache = new Map<string, { at: number; data: { isSuperAdmin: boolean; name: string; role: string } }>();
const userContextInflight = new Map<string, Promise<{ isSuperAdmin: boolean; name: string; role: string }>>();

async function getCachedUserContext(user: { id: string; email?: string | null }) {
  const now = Date.now();
  const cached = userContextCache.get(user.id);
  if (cached && now - cached.at < USER_CONTEXT_TTL_MS) return cached.data;

  const existing = userContextInflight.get(user.id);
  if (existing) return existing;

  const request = (async () => {
    const [{ data: isSuperAdmin }, { data: profile }, { data: roleData }] = await Promise.all([
      supabase.rpc('is_super_admin', { _user_id: user.id }),
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    ]);

    const data = {
      isSuperAdmin: Boolean(isSuperAdmin),
      name: profile?.name || user.email || 'Unknown',
      role: roleData?.role || 'user',
    };

    userContextCache.set(user.id, { at: Date.now(), data });
    return data;
  })().finally(() => userContextInflight.delete(user.id));

  userContextInflight.set(user.id, request);
  return request;
}

export async function logActivity({
  actionType,
  entityType,
  entityId,
  description,
  storeId,
}: LogActivityParams) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const userContext = await getCachedUserContext(user);
    if (userContext.isSuperAdmin) return;

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: userContext.name,
      user_role: userContext.role,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      description,
      store_id: storeId,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
