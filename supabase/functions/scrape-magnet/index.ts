import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const TRAKT_API_KEY = Deno.env.get('TRAKT_API_KEY');

async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<string> {
  console.log(`Fetching: ${url}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.log(`Timeout triggered for ${url}`);
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    console.log(`Fetched ${url} - Length: ${text.length}`);
    return text;
  } catch (error) {
    console.log(`Fetch error for ${url}: ${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req: Request): Promise<Response> => {
  console.log('Function started');
  if (req.method !== 'POST') {
    console.log('Method not allowed');
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!TRAKT_API_KEY) {
    console.log('TRAKT_API_KEY missing');
    return new Response(JSON.stringify({ error: 'TRAKT_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('Parsing request body');
    const body = await req.json();
    const { traktId, type } = body as { traktId?: number; type?: 'movie' | 'show' };
    console.log(`Request: traktId=${traktId}, type=${type}`);

    if (!traktId || !type) {
      console.log('Invalid request');
      return new Response(JSON.stringify({ error: 'Trakt ID and type required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching Trakt metadata');
    const traktResponse = await fetchWithTimeout(`https://api.trakt.tv/${type}s/${traktId}?extended=full`);
    const traktData = JSON.parse(traktResponse);
    console.log(`Trakt response: ${JSON.stringify(traktData).slice(0, 100)}...`);
    const { title, year } = traktData;
    const query = `${title} ${year}`;
    console.log(`Search query: ${query}`);

    // Test one site (1337x) for now
    const searchUrl = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
    console.log(`Scraping: ${searchUrl}`);
    const searchHtml = await fetchWithTimeout(searchUrl);
    console.log(`1337x HTML length: ${searchHtml.length}`);

    return new Response(JSON.stringify({ message: 'Test complete', query }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`Error: ${errorMessage}`);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});