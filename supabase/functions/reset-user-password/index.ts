import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Helper to decode JWT and extract user ID
function getUserIdFromToken(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Extract user ID from JWT token
    const requestingUserId = getUserIdFromToken(authHeader);
    if (!requestingUserId) {
      throw new Error('Invalid token');
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify requesting user is an admin or leader
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUserId)
      .single();

    if (roleError || !roleData) {
      console.error('Error fetching user role:', roleError);
      throw new Error('Failed to verify user permissions');
    }

    const isAdmin = roleData.role === 'admin';
    const isLeader = roleData.role === 'leader';

    if (!isAdmin && !isLeader) {
      throw new Error('Only admins and leaders can reset passwords');
    }

    const body: ResetPasswordRequest = await req.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      throw new Error('Missing required fields: userId or newPassword');
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Check if target user is an admin (leaders cannot reset admin passwords)
    if (isLeader) {
      const { data: targetRoleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (targetRoleData?.role === 'admin') {
        throw new Error('Leaders cannot reset admin passwords');
      }
    }

    // Update user password using admin API
    const { data: userData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Failed to update password: ' + updateError.message);
    }

    console.log(`Password reset successfully for user: ${userId}`);

    // Store temp password for reference
    const { error: tempError } = await supabaseAdmin
      .from('user_temp_passwords')
      .insert({
        user_id: userId,
        temp_password: newPassword,
        created_by: requestingUserId,
      });

    if (tempError) {
      console.error('Error storing temp password:', tempError);
      // Don't throw, password was updated successfully
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password berhasil direset',
        user: { id: userData.user.id, email: userData.user.email }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in reset-user-password function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
