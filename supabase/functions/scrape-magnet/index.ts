import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

serve(async (req: Request): Promise<Response> => {
  console.log('Function started');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify([...req.headers]));

  if (req.method === 'POST') {
    console.log('Handling POST');
    try {
      const body = await req.json();
      console.log('Body:', JSON.stringify(body));
      return new Response(`Hello with body: ${JSON.stringify(body)}`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch (e) {
      console.log('Body parse error:', e instanceof Error ? e.message : 'Unknown');
      return new Response('Hello, POST failed', { status: 500 });
    }
  }

  console.log('Handling non-POST');
  return new Response('Hello from scrape-magnet', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
});