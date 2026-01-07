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

interface CreateUserRequest {
  action: 'create';
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'leader' | 'user';
  storeId: string; // Store where user is being registered
}

interface DeleteUserRequest {
  action: 'delete';
  userId: string;
}

interface CleanupOrphanRequest {
  action: 'cleanup_orphan';
  email: string;
}

type RequestBody = CreateUserRequest | DeleteUserRequest | CleanupOrphanRequest;

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

    const isAdmin = roleData.role === 'admin';
    const isLeader = roleData.role === 'leader';

    if (!isAdmin && !isLeader) {
      throw new Error('Only admins and leaders can manage users');
    }

    const body: RequestBody = await req.json();
    console.log('Received request:', body.action);

    if (body.action === 'create') {
      const { email, password, name, role, storeId } = body as CreateUserRequest;

      if (!email || !password || !name) {
        throw new Error('Missing required fields: email, password, or name');
      }

      if (!storeId) {
        throw new Error('Store ID is required for user registration');
      }

      // Leader cannot create admin users
      if (isLeader && role === 'admin') {
        throw new Error('Leaders cannot create admin users');
      }

      // First, check if user already exists in auth and try to clean up orphaned records
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);
      
      if (existingUser) {
        // Check if this user has a profile record
        const { data: profileExists } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', existingUser.id)
          .single();
        
        // Check if this user has a role record
        const { data: roleExists } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', existingUser.id)
          .single();
        
        // If user exists in auth but not in profiles or user_roles, it's an orphan - delete it
        if (!profileExists || !roleExists) {
          console.log(`Found orphaned auth user ${existingUser.id} for email ${email}, cleaning up...`);
          
          // Clean up all related data first
          await supabaseAdmin.from('user_store_access').delete().eq('user_id', existingUser.id);
          await supabaseAdmin.from('user_permissions').delete().eq('user_id', existingUser.id);
          await supabaseAdmin.from('user_temp_passwords').delete().eq('user_id', existingUser.id);
          await supabaseAdmin.from('user_roles').delete().eq('user_id', existingUser.id);
          await supabaseAdmin.from('profiles').delete().eq('id', existingUser.id);
          
          // Delete the orphaned auth user
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
          if (deleteError) {
            console.error('Error deleting orphaned user:', deleteError);
            throw new Error('Email sudah terdaftar tapi tidak bisa dibersihkan. Coba lagi nanti.');
          }
          
          console.log(`Orphaned user ${existingUser.id} cleaned up successfully`);
        } else {
          // User exists and has proper records, this is a real duplicate
          throw new Error('Email sudah terdaftar, gunakan email lain');
        }
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
        if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
          throw new Error('Email sudah terdaftar, gunakan email lain');
        }
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

      // Automatically grant access to the store where user is being registered
      const storeRole = role === 'admin' ? 'admin' : 'staff';
      const { error: storeAccessError } = await supabaseAdmin
        .from('user_store_access')
        .insert({
          user_id: authData.user.id,
          store_id: storeId,
          role: storeRole,
        });

      if (storeAccessError) {
        console.error('Error granting store access:', storeAccessError);
        // Don't throw, user is created but store access failed - can be added manually
      } else {
        console.log(`Store access granted for user ${authData.user.id} to store ${storeId}`);
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

      // Check if target user is an admin (leaders cannot delete admins)
      if (isLeader) {
        const { data: targetRoleData } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .single();
        
        if (targetRoleData?.role === 'admin') {
          throw new Error('Leaders cannot delete admin users');
        }
      }

      console.log(`Starting full deletion for user: ${userId}`);

      // Delete all related data in order
      // 1. Delete user store access
      const { error: storeAccessError } = await supabaseAdmin
        .from('user_store_access')
        .delete()
        .eq('user_id', userId);
      
      if (storeAccessError) {
        console.error('Error deleting user_store_access:', storeAccessError);
      }

      // 2. Delete user permissions
      const { error: permissionsError } = await supabaseAdmin
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);
      
      if (permissionsError) {
        console.error('Error deleting user_permissions:', permissionsError);
      }

      // 3. Delete user temp passwords
      const { error: tempPassError } = await supabaseAdmin
        .from('user_temp_passwords')
        .delete()
        .eq('user_id', userId);
      
      if (tempPassError) {
        console.error('Error deleting user_temp_passwords:', tempPassError);
      }

      // 4. Delete notification preferences
      const { error: notifError } = await supabaseAdmin
        .from('notification_preferences')
        .delete()
        .eq('user_id', userId);
      
      if (notifError) {
        console.error('Error deleting notification_preferences:', notifError);
      }

      // 5. Delete user role
      const { error: roleDeleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleDeleteError) {
        console.error('Error deleting user role:', roleDeleteError);
      }

      // 6. Delete profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
      }

      // 7. Finally delete auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Error deleting auth user:', authError);
        throw new Error(authError.message);
      }

      console.log(`User fully deleted: ${userId}`);

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
