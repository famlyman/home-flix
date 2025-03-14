import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const TRAKT_API_KEY = Deno.env.get('TRAKT_API_KEY');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'; // Updated UA
const ACCEPT = 'text/html,application/xhtml+xml,application/json;q=0.9,image/webp,*/*;q=0.8';

interface TorrentSite {
  name: string;
  searchUrl: (query: string) => string;
  parse: (html: string, query: string) => Promise<string | null>;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 403) {
        console.log(`Retrying due to 403 at attempt ${i + 1}`);
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000)); // Backoff
        continue;
      }
      if (response.status < 500 || response.ok) return response;
      lastError = new Error(`Server responded with ${response.status}`);
    } catch (error) {
      lastError = error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw lastError;
}

async function scrapeTorrentSites(query: string, type: string): Promise<string> {
  console.log(`Searching for: "${query}" (${type})`);
  
  const sites: TorrentSite[] = [
    {
      name: 'YTS',
      searchUrl: (q: string) => {
        const slug = q.split(' ').join('-').toLowerCase();
        return `https://yts.mx/movies/${encodeURIComponent(slug)}`;
      },
      parse: async (html: string) => {
        console.log('YTS HTML snippet:', html.slice(0, 1000));
        const magnetMatches = [...html.matchAll(/href="(magnet:[^"]+)"/gi)];
        console.log(`Found ${magnetMatches.length} magnet links`);
        if (magnetMatches.length > 0) {
          const hdMatch = magnetMatches.find(m => m[1].includes('1080p'));
          return hdMatch ? hdMatch[1] : magnetMatches[0][1];
        }
        return null;
      },
    },
  ];

  for (const site of sites) {
    console.log(`Trying ${site.name}`);
    try {
      const url = site.searchUrl(query);
      console.log(`${site.name} URL: ${url}`);
      const response = await fetchWithRetry(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': ACCEPT,
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com', // Mimic browser
        },
      });
      console.log(`${site.name} Status: ${response.status}`);
      if (!response.ok) {
        console.log(`Skipping ${site.name} due to ${response.status}`);
        continue;
      }
      const html = await response.text();
      console.log(`${site.name} HTML length: ${html.length}`);
      const magnet = await site.parse(html, query);
      if (magnet) {
        console.log(`Found magnet link from ${site.name}`);
        return magnet;
      }
    } catch (error) {
      console.error(`Error with ${site.name}:`, error);
    }
  }
  throw new Error('No seeded torrents found');
}

serve(async (req: Request): Promise<Response> => {
  console.log('Function started');
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    const { traktId, type } = body;

    if (!traktId || !type) throw new Error('Missing required parameters: traktId and type');
    if (!['movie', 'show'].includes(type)) throw new Error('Type must be "movie" or "show"');
    if (!TRAKT_API_KEY) throw new Error('TRAKT_API_KEY not set');

    const traktUrl = `https://api.trakt.tv/${type}s/${traktId}?extended=full`;
    console.log('Trakt URL:', traktUrl);
    const traktResponse = await fetchWithRetry(traktUrl, {
      headers: {
        'trakt-api-key': TRAKT_API_KEY,
        'trakt-api-version': '2',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Accept': ACCEPT,
        'Referer': 'https://www.google.com',
      },
    });
    console.log(`Trakt status: ${traktResponse.status}`);
    if (!traktResponse.ok) {
      const errorText = await traktResponse.text();
      console.log('Trakt error response:', errorText);
      throw new Error(`Trakt API failed with status: ${traktResponse.status}`);
    }
    const traktData = await traktResponse.json();
    console.log('Trakt data:', JSON.stringify(traktData).slice(0, 200) + '...');

    const query = traktData.year ? `${traktData.title} ${traktData.year}` : traktData.title;
    console.log('Search query:', query);

    const magnet = await scrapeTorrentSites(query, type);
    return new Response(JSON.stringify({ magnet, title: traktData.title, year: traktData.year }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown');
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to scrape' }), {
      status: 500,
      headers,
    });
  }
});