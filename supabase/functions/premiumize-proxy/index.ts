import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const USER_AGENT = 'HomeFlixApp'; // Consistent with your client-side UA

serve(async (req: Request): Promise<Response> => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // Allow CORS for your React Native app
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const body = await req.json();
    const { sourceUrl, access_token } = body as { sourceUrl?: string; access_token?: string };

    if (!sourceUrl || !access_token) {
      return new Response(JSON.stringify({ error: 'Source URL and access token are required' }), {
        status: 400,
        headers,
      });
    }

    // Verify the direct link is accessible
    const response = await fetch(sourceUrl, {
      method: 'HEAD', // Use HEAD to avoid downloading the file
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      console.error(`Invalid Premiumize link: HTTP ${response.status}`);
      return new Response(JSON.stringify({ error: `Invalid Premiumize link: HTTP ${response.status}` }), {
        status: 400,
        headers,
      });
    }

    // Return the direct link as the stream URL
    console.log(`Valid stream URL: ${sourceUrl}`);
    return new Response(JSON.stringify({ streamUrl: sourceUrl }), {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Proxy error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers,
    });
  }
});