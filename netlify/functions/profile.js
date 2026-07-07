// netlify/functions/profile.js
//
// GET  -> return the caller's brand profile (or { onboarding_completed: false } if none yet)
// POST -> create/update the caller's brand profile; also ensures an `accounts`
//         row exists (first save = first-time signup completing onboarding)

const { supabaseAdmin, getAccountId } = require('./_auth');

exports.handler = async (event) => {
  const { accountId, error: authError } = await getAccountId(event);
  if (authError) {
    return { statusCode: 401, body: JSON.stringify({ error: authError }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('brand_profiles')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data || { onboarding_completed: false }) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      // Make sure the accounts row exists (created on first onboarding submit)
      const { error: accountError } = await supabaseAdmin
        .from('accounts')
        .upsert({ id: accountId, name: body.brand_name || 'My Account' }, { onConflict: 'id' });
      if (accountError) throw accountError;

      const { data, error } = await supabaseAdmin
        .from('brand_profiles')
        .upsert({
          account_id: accountId,
          brand_name: body.brand_name,
          description: body.description,
          target_audience: body.target_audience,
          tone: body.tone,
          topics: body.topics || [],
          platforms: body.platforms || [],
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data[0]) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
