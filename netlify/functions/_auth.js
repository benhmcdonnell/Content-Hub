// netlify/functions/_auth.js
//
// Shared helper used by every other function. Verifies the Supabase access
// token the frontend sends in the Authorization header, and returns the
// account_id it belongs to. Because this app uses one shared login per
// account, account_id is just the Supabase Auth user's id.

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getAccountId(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    return { error: 'Invalid or expired session' };
  }

  return { accountId: data.user.id };
}

module.exports = { supabaseAdmin, getAccountId };
