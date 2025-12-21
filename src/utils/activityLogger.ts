import { supabase } from "@/integrations/supabase/client";

export type ActionType = 'created' | 'updated' | 'deleted' | 'login' | 'check-in' | 'check-out' | 'confirm';

interface LogActivityParams {
  actionType: ActionType;
  entityType: string;
  entityId?: string;
  description: string;
  storeId?: string;
}

export async function logActivity({
  actionType,
  entityType,
  entityId,
  description,
  storeId,
}: LogActivityParams) {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile?.name || user.email || 'Unknown',
      user_role: roleData?.role || 'user',
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
