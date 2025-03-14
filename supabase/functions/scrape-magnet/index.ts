import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

serve(async (req: Request): Promise<Response> => {
  console.log('Function started');
  return new Response(JSON.stringify({ message: 'Hello from scrape-magnet' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});