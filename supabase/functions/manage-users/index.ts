import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

interface CreateUserRequest {
  action: 'create';
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'leader' | 'user';
}

interface DeleteUserRequest {
  action: 'delete';
  userId: string;
}

type RequestBody = CreateUserRequest | DeleteUserRequest;

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

    // Verify requesting user is an admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUserId)
      .single();

    if (roleError || !roleData) {
      console.error('Error fetching user role:', roleError);
      throw new Error('Failed to verify user permissions');
    }

    if (roleData.role !== 'admin') {
      throw new Error('Only admins can manage users');
    }

    const body: RequestBody = await req.json();
    console.log('Received request:', body.action);

    if (body.action === 'create') {
      const { email, password, name, role } = body as CreateUserRequest;

      if (!email || !password || !name) {
        throw new Error('Missing required fields: email, password, or name');
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (authError) {
        console.error('Auth error creating user:', authError);
        throw new Error(authError.message);
      }
      
      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      console.log(`User created: ${authData.user.id}`);

      // Update profile with name
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ name })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        // Don't throw, profile was likely created by trigger
      }

      // Set user role
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', authData.user.id);

      if (roleUpdateError) {
        console.error('Error updating role:', roleUpdateError);
        throw new Error('Failed to set user role');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          user: { id: authData.user.id, email: authData.user.email },
          message: 'User created successfully' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } else if (body.action === 'delete') {
      const { userId } = body as DeleteUserRequest;

      if (!userId) {
        throw new Error('Missing userId');
      }

      // Prevent self-deletion
      if (userId === requestingUserId) {
        throw new Error('Cannot delete your own account');
      }

      // Delete user role first
      const { error: roleDeleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleDeleteError) {
        console.error('Error deleting user role:', roleDeleteError);
        // Continue anyway, role might not exist
      }

      // Delete profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        // Continue anyway
      }

      // Delete auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Error deleting auth user:', authError);
        throw new Error(authError.message);
      }

      console.log(`User deleted: ${userId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User deleted successfully' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } else {
      throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in manage-users function:', error);
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
