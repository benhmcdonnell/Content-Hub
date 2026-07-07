// netlify/functions/saves.js
//
// GET    -> list this account's cards (all statuses)
// POST   -> create or update a card (include body.id to update, omit to create)
// DELETE -> permanently remove a card (body: { id })
//
// Every query is scoped to the caller's account_id, resolved from their
// Supabase session token via _auth.js.

const { supabaseAdmin, getAccountId } = require('./_auth');

exports.handler = async (event) => {
  const { accountId, error: authError } = await getAccountId(event);
  if (authError) {
    return { statusCode: 401, body: JSON.stringify({ error: authError }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('saves')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      const row = {
        type: body.type,       // 'forum' | 'newsletter'
        status: body.status,   // 'saved' | 'trashed' | 'published'
        data: body.data,       // { platform, topic, content, ... }
        account_id: accountId,
        updated_at: new Date().toISOString()
      };
      if (body.id) row.id = body.id; // present = update existing card

      const { data, error } = await supabaseAdmin
        .from('saves')
        .upsert(row)
        .select();

      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data[0]) };
    }

    if (event.httpMethod === 'DELETE') {
      const { id } = JSON.parse(event.body);

      const { error } = await supabaseAdmin
        .from('saves')
        .delete()
        .eq('id', id)
        .eq('account_id', accountId); // guard: can't delete another account's row

      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
