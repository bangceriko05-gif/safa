// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, name, secret_key } = await req.json();

    // Secure secret key check using environment variable
    const expectedSecret = Deno.env.get('MASTER_ADMIN_SECRET_KEY');
    if (!expectedSecret) {
      console.error('MASTER_ADMIN_SECRET_KEY not configured');
      throw new Error('Server configuration error');
    }
    if (secret_key !== expectedSecret) {
      console.warn(`Invalid secret key attempt for email: ${email}`);
      throw new Error('Invalid secret key');
    }

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let userId: string;

    // Try to create user
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email }
    });

    if (createError) {
      // Check if user already exists
      if (createError.message.includes('already') || createError.message.includes('exists')) {
        // Get existing user
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === email);
        
        if (existingUser) {
          userId = existingUser.id;
          
          // Update password
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password,
            email_confirm: true
          });
        } else {
          throw new Error('User not found');
        }
      } else {
        throw createError;
      }
    } else {
      userId = userData.user?.id ?? '';
    }

    if (!userId) {
      throw new Error('Failed to get user ID');
    }

    // Ensure user has admin role
    const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({
      user_id: userId,
      role: 'admin'
    }, { onConflict: 'user_id' });

    if (roleError) {
      console.error('Role error:', roleError);
    }

    // Get all stores and give super_admin access
    const { data: stores } = await supabaseAdmin.from('stores').select('id');
    
    if (stores && stores.length > 0) {
      for (const store of stores) {
        await supabaseAdmin.from('user_store_access').upsert({
          user_id: userId,
          store_id: store.id,
          role: 'super_admin'
        }, { onConflict: 'user_id,store_id' });
      }
    }

    console.log(`Master admin created/updated: ${email} (${userId})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Master admin created successfully',
        userId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating master admin:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
