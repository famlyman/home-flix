import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PREMIUMIZE_API_URL = 'https://www.premiumize.me/api';
const PREMIUMIZE_API_KEY = Deno.env.get('PREMIUMIZE_API_KEY'); // Store in Supabase env vars

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { sourceUrl } = await req.json();
    if (!sourceUrl) {
      return new Response(JSON.stringify({ error: 'Source URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`${PREMIUMIZE_API_URL}/transfer/directdl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        src: sourceUrl,
        apikey: PREMIUMIZE_API_KEY,
      }),
    });

    const data = await response.json();
    if (data.status === 'success' && data.content && data.content.length > 0) {
      const streamUrl = data.content[0].link;
      return new Response(JSON.stringify({ streamUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error(data.message || 'No streamable link found');
    }
  } catch (error) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
