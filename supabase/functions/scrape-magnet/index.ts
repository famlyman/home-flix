import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

serve(async (req: Request): Promise<Response> => {
  console.log('Function started');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify([...req.headers]));

  if (req.method === 'POST') {
    console.log('Handling POST');
    // Skip body parsing, just return headers
    return new Response(`Hello, POST headers: ${JSON.stringify([...req.headers])}`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.log('Handling non-POST');
  return new Response('Hello from scrape-magnet', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
});