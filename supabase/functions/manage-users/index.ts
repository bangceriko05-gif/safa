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

interface RepairUserRequest {
  action: 'repair';
  email: string;
  storeId: string;
  name?: string;
  role?: 'admin' | 'leader' | 'user';
}

interface ListAuthOrphansRequest {
  action: 'list_auth_orphans';
}

interface DeleteAuthOrphanRequest {
  action: 'delete_auth_orphan';
  email: string;
}

type RequestBody = CreateUserRequest | DeleteUserRequest | CleanupOrphanRequest | RepairUserRequest | ListAuthOrphansRequest | DeleteAuthOrphanRequest;

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

    if (body.action === 'list_auth_orphans') {
      // List all Auth users without a profile record
      const allAuthUsers: any[] = [];
      let page = 1;
      const perPage = 100;
      
      while (true) {
        const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        
        if (listError) {
          console.error('Error listing users:', listError);
          throw new Error('Gagal mengambil daftar user');
        }
        
        if (usersPage?.users) {
          allAuthUsers.push(...usersPage.users);
        }
        
        if (!usersPage?.users?.length || usersPage.users.length < perPage) {
          break;
        }
        
        page++;
        if (page > 50) break;
      }
      
      // Get all profile IDs
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id');
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw new Error('Gagal mengambil daftar profile');
      }
      
      const profileIds = new Set((profiles || []).map(p => p.id));
      
      // Find Auth users without profile
      const orphans = allAuthUsers
        .filter(u => !profileIds.has(u.id))
        .map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          name: (u.user_metadata as any)?.name || u.email,
        }));
      
      return new Response(
        JSON.stringify({
          success: true,
          orphans,
          count: orphans.length,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (body.action === 'delete_auth_orphan') {
      const { email } = body as DeleteAuthOrphanRequest;
      
      if (!email) throw new Error('Email is required');
      
      // Find the auth user
      let targetUser = null;
      let page = 1;
      const perPage = 100;
      
      while (!targetUser) {
        const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        
        const found = usersPage?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          targetUser = found;
          break;
        }
        
        if (!usersPage?.users?.length || usersPage.users.length < perPage) break;
        page++;
        if (page > 50) break;
      }
      
      if (!targetUser) {
        throw new Error('User tidak ditemukan di Auth');
      }
      
      // Verify it's truly an orphan (no profile)
      const { data: profileExists } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', targetUser.id)
        .maybeSingle();
      
      if (profileExists) {
        throw new Error('User ini memiliki profile. Gunakan hapus user biasa.');
      }
      
      // Clean up any potential related data (just in case)
      await supabaseAdmin.from('user_store_access').delete().eq('user_id', targetUser.id);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', targetUser.id);
      await supabaseAdmin.from('user_permissions').delete().eq('user_id', targetUser.id);
      await supabaseAdmin.from('activity_logs').delete().eq('user_id', targetUser.id);
      await supabaseAdmin.from('notification_preferences').delete().eq('user_id', targetUser.id);
      await supabaseAdmin.from('user_temp_passwords').delete().eq('user_id', targetUser.id);
      
      // Delete auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
      
      if (authError) {
        console.error('Error deleting auth user:', authError);
        throw new Error('Gagal menghapus user dari Auth: ' + authError.message);
      }
      
      console.log(`Auth orphan deleted: ${email} (${targetUser.id})`);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `User ${email} berhasil dihapus permanen dari sistem`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (body.action === 'repair') {
      const { email, storeId, name, role } = body as RepairUserRequest;

      if (!email) throw new Error('Email is required');
      if (!storeId) throw new Error('Store ID is required');

      // Leader cannot create/administer admin users
      if (isLeader && role === 'admin') {
        throw new Error('Leaders cannot create admin users');
      }

      // Search for user across all pages
      let existingUser = null;
      let page = 1;
      const perPage = 100;
      
      while (!existingUser) {
        const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        
        if (listError) {
          console.error('Error listing users:', listError);
          throw new Error('Gagal mencari user di sistem');
        }
        
        const found = usersPage?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          existingUser = found;
          break;
        }
        
        // No more pages
        if (!usersPage?.users?.length || usersPage.users.length < perPage) {
          break;
        }
        
        page++;
        
        // Safety limit
        if (page > 50) break;
      }
      
      if (!existingUser) {
        throw new Error('User tidak ditemukan di sistem. Pastikan email benar atau daftarkan user baru.');
      }

      const displayName = name || (existingUser.user_metadata as any)?.name || existingUser.email || email;
      const desiredRole = role || 'user';

      // Ensure profile exists (upsert)
      const { error: upsertProfileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: existingUser.id,
          email: existingUser.email || email,
          name: displayName,
        });

      if (upsertProfileError) {
        console.error('Error upserting profile:', upsertProfileError);
        throw new Error('Gagal memperbaiki profile user');
      }

      // Ensure role exists (upsert)
      const { error: upsertRoleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: existingUser.id, role: desiredRole }, { onConflict: 'user_id' });

      if (upsertRoleError) {
        console.error('Error upserting role:', upsertRoleError);
        throw new Error('Gagal memperbaiki role user');
      }

      // Ensure store access exists
      const { data: existingStoreAccess, error: existingStoreAccessError } = await supabaseAdmin
        .from('user_store_access')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('store_id', storeId)
        .maybeSingle();

      if (existingStoreAccessError) {
        console.error('Error checking store access:', existingStoreAccessError);
        throw new Error('Gagal memeriksa akses cabang');
      }

      if (!existingStoreAccess) {
        const storeRole = desiredRole === 'admin' ? 'admin' : 'staff';
        const { error: storeAccessError } = await supabaseAdmin
          .from('user_store_access')
          .insert({
            user_id: existingUser.id,
            store_id: storeId,
            role: storeRole,
          });

        if (storeAccessError) {
          console.error('Error granting store access:', storeAccessError);
          throw new Error('Gagal menambahkan akses cabang untuk user');
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: { id: existingUser.id, email: existingUser.email },
          message: 'User berhasil diperbaiki dan dipastikan punya akses cabang',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

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

      // Search for existing user across all pages
      let existingUser = null;
      let page = 1;
      const perPage = 100;
      
      while (!existingUser) {
        const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        
        if (listError) {
          console.error('Error listing users:', listError);
          break;
        }
        
        const found = usersPage?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          existingUser = found;
          break;
        }
        
        // No more pages
        if (!usersPage?.users?.length || usersPage.users.length < perPage) {
          break;
        }
        
        page++;
        
        // Safety limit
        if (page > 50) break;
      }
      
      if (existingUser) {
        // Check if this user has a profile record
        const { data: profileExists } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', existingUser.id)
          .maybeSingle();
        
        // Check if this user has a role record
        const { data: roleExists } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', existingUser.id)
          .maybeSingle();
        
        // If user exists in auth but missing profile/role, repair it instead of deleting
        if (!profileExists || !roleExists) {
          console.log(`Found auth user without complete records ${existingUser.id} for email ${email}, repairing...`);

          const displayName = name || (existingUser.user_metadata as any)?.name || existingUser.email || email;

          const { error: upsertProfileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: existingUser.id,
              email: existingUser.email || email,
              name: displayName,
            });

          if (upsertProfileError) {
            console.error('Error upserting profile:', upsertProfileError);
            throw new Error('Gagal memperbaiki profile user');
          }

          const { error: upsertRoleError } = await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: existingUser.id, role }, { onConflict: 'user_id' });

          if (upsertRoleError) {
            console.error('Error upserting role:', upsertRoleError);
            throw new Error('Gagal memperbaiki role user');
          }
        }

        // User exists - check if they already have access to this store
        const { data: existingStoreAccess } = await supabaseAdmin
          .from('user_store_access')
          .select('id')
          .eq('user_id', existingUser.id)
          .eq('store_id', storeId)
          .maybeSingle();

        if (existingStoreAccess) {
          throw new Error('Pengguna dengan email ini sudah memiliki akses ke toko ini');
        }

        console.log(`User ${existingUser.id} exists, adding access to store ${storeId}`);

        const storeRole = role === 'admin' ? 'admin' : 'staff';
        const { error: storeAccessError } = await supabaseAdmin
          .from('user_store_access')
          .insert({
            user_id: existingUser.id,
            store_id: storeId,
            role: storeRole,
          });

        if (storeAccessError) {
          console.error('Error granting store access:', storeAccessError);
          throw new Error('Gagal menambahkan akses toko untuk pengguna');
        }

        console.log(`Store access granted for existing user ${existingUser.id} to store ${storeId}`);

        return new Response(
          JSON.stringify({
            success: true,
            user: { id: existingUser.id, email: existingUser.email },
            message: 'Akses toko berhasil ditambahkan untuk pengguna yang sudah terdaftar',
            addedToStore: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
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

      // Ensure profile exists + upsert name/email
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: authData.user.email ?? email,
          name,
        });

      if (profileError) {
        console.error('Error updating profile:', profileError);
        // Don't throw, profile was likely created by trigger
      }

      // Set user role (upsert)
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: authData.user.id, role }, { onConflict: 'user_id' });

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

      // Delete all related data in order - must clean up ALL references before auth user deletion
      
      // 1. Delete activity logs
      await supabaseAdmin.from('activity_logs').delete().eq('user_id', userId);

      // 2. Delete user store access
      await supabaseAdmin.from('user_store_access').delete().eq('user_id', userId);

      // 3. Delete user permissions
      await supabaseAdmin.from('user_permissions').delete().eq('user_id', userId);
      // Also delete permissions granted by this user
      await supabaseAdmin.from('user_permissions').delete().eq('granted_by', userId);

      // 4. Delete user temp passwords
      await supabaseAdmin.from('user_temp_passwords').delete().eq('user_id', userId);
      await supabaseAdmin.from('user_temp_passwords').delete().eq('created_by', userId);

      // 5. Delete notification preferences
      await supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId);

      // 6. Delete user role
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);

      // 7. Nullify references in other tables (instead of deleting)
      // Update bookings created by this user - set to null for nullable columns
      await supabaseAdmin.from('bookings').update({ checked_in_by: null }).eq('checked_in_by', userId);
      await supabaseAdmin.from('bookings').update({ checked_out_by: null }).eq('checked_out_by', userId);
      await supabaseAdmin.from('bookings').update({ confirmed_by: null }).eq('confirmed_by', userId);
      
      // Update booking requests
      await supabaseAdmin.from('booking_requests').update({ processed_by: null }).eq('processed_by', userId);
      
      // Update room_daily_status
      await supabaseAdmin.from('room_daily_status').update({ updated_by: null }).eq('updated_by', userId);
      
      // Delete room_deposits created by this user
      await supabaseAdmin.from('room_deposits').delete().eq('created_by', userId);
      await supabaseAdmin.from('room_deposits').update({ returned_by: null }).eq('returned_by', userId);

      // 8. Delete profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
      }

      // 9. Finally delete auth user with retry
      let authDeleteSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!authDeleteSuccess && retryCount < maxRetries) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (!authError) {
          authDeleteSuccess = true;
        } else {
          console.error(`Attempt ${retryCount + 1} - Error deleting auth user:`, authError);
          retryCount++;
          
          if (retryCount < maxRetries) {
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            // Final attempt failed - but related data is already cleaned up
            // Return success anyway since the user data is effectively removed
            console.log(`Auth user ${userId} could not be deleted but all related data was cleaned up`);
          }
        }
      }

      console.log(`User deletion completed for: ${userId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: authDeleteSuccess 
            ? 'User deleted successfully' 
            : 'User data cleaned up (auth record may remain but is inaccessible)'
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
