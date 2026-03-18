import { supabase } from "@/integrations/supabase/client";

export type AccountingActionType = 'created' | 'updated' | 'deleted' | 'converted';

interface LogAccountingActivityParams {
  actionType: AccountingActionType;
  entityType: string;
  entityId?: string;
  description: string;
  storeId?: string;
}

export async function logAccountingActivity({
  actionType,
  entityType,
  entityId,
  description,
  storeId,
}: LogAccountingActivityParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', {
      _user_id: user.id
    });
    if (isSuperAdmin) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    await supabase.from('accounting_activity_logs' as any).insert({
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
    console.error('Failed to log accounting activity:', error);
  }
}
