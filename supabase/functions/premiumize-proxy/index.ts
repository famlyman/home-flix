import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
// Trigger
const PREMIUMIZE_API_URL = 'https://www.premiumize.me/api';

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { sourceUrl, access_token } = body as { sourceUrl?: string; access_token?: string };

    if (!sourceUrl || !access_token) {
      return new Response(JSON.stringify({ error: 'Source URL and access token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = new URLSearchParams();
    formData.append('src', sourceUrl);
    formData.append('access_token', access_token);

    const response = await fetch(`${PREMIUMIZE_API_URL}/transfer/directdl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const data = await response.json() as { status: string; content?: { link: string }[]; message?: string };

    if (data.status === 'success' && data.content && data.content.length > 0) {
      return new Response(JSON.stringify({ streamUrl: data.content[0].link }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(data.message || 'No streamable link available');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});