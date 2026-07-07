// netlify/functions/generate.js
//
// POST { type: 'forum'|'newsletter', platform, topic } -> { content }
//
// Looks up the caller's brand_profiles row and builds the prompt from it,
// instead of a hardcoded brand block. This is the only real difference
// from the original Cortix-only version of this function.

const Anthropic = require('@anthropic-ai/sdk');
const { supabaseAdmin, getAccountId } = require('./_auth');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { accountId, error: authError } = await getAccountId(event);
  if (authError) {
    return { statusCode: 401, body: JSON.stringify({ error: authError }) };
  }

  try {
    const { type, platform, topic } = JSON.parse(event.body);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('brand_profiles')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || !profile.onboarding_completed) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Brand profile not set up yet. Complete onboarding first.' })
      };
    }

    const brandContext = `
Brand name: ${profile.brand_name}
What the brand does: ${profile.description}
Target audience: ${profile.target_audience}
Tone of voice: ${profile.tone}
    `.trim();

    const platformInstructions = type === 'forum'
      ? `Write a single word-for-word post for the "${platform}" community about "${topic}". Sound like a genuine member of that community, not a marketer -- match how real people actually write on ${platform}, including formatting conventions. No obvious self-promotion.`
      : `Write a single word-for-word newsletter issue about "${topic}", in the brand's voice, ready to send as-is.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `${brandContext}\n\n${platformInstructions}\n\nReturn only the post/issue text itself -- no preamble, no explanation, no markdown formatting unless the platform calls for it.`
      }]
    });

    const content = message.content[0].text;

    return {
      statusCode: 200,
      body: JSON.stringify({ type, platform: platform || null, topic, content })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
