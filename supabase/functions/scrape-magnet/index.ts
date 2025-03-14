import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.47-alpha/deno-dom-wasm.ts';

const TRAKT_API_KEY = Deno.env.get('TRAKT_API_KEY');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

interface TorrentSite {
  name: string;
  searchUrl: (query: string) => string;
  parse: (html: string, query: string) => Promise<string | null>;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  options.signal = controller.signal;
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      clearTimeout(timeout);
      if (response.status < 500 || response.ok) return response;
      lastError = new Error(`Server responded with ${response.status}`);
    } catch (error) {
      clearTimeout(timeout);
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
      parse: async (html: string, q: string) => {
        try {
          const doc = new DOMParser().parseFromString(html, "text/html");
          if (!doc) return null;
          const title = doc.querySelector('div.movie-info h1');
          if (!title) {
            console.log('Not on a movie page');
            return null;
          }
          console.log(`Found YTS page for: ${title.textContent?.trim()}`);
          const magnetLinks = Array.from(doc.querySelectorAll('a[href^="magnet:"]'));
          console.log(`Found ${magnetLinks.length} magnet links`);
          if (magnetLinks.length > 0) {
            const hdLink = magnetLinks.find(a => a.textContent?.includes('1080p'));
            const link = hdLink || magnetLinks[0];
            return link.getAttribute('href') || null;
          }
          return null;
        } catch (e) {
          console.error('Error parsing YTS:', e);
          return null;
        }
      },
    },
    {
      name: 'YTS-Search',
      searchUrl: (q: string) => `https://yts.mx/browse-movies/${encodeURIComponent(q)}/all/all/0/latest/0/all`,
      parse: async (html: string, q: string) => {
        try {
          const doc = new DOMParser().parseFromString(html, "text/html");
          if (!doc) return null;
          const movieLinks = Array.from(doc.querySelectorAll('.browse-movie-link a'));
          console.log(`Found ${movieLinks.length} movie results`);
          if (movieLinks.length === 0) return null;
          const queryWords = q.toLowerCase().split(' ');
          let bestMatch = movieLinks[0];
          let bestMatchScore = 0;
          for (const link of movieLinks) {
            const title = link.textContent?.toLowerCase() || '';
            let score = 0;
            for (const word of queryWords) {
              if (title.includes(word)) score++;
            }
            const yearMatch = link.parentElement?.querySelector('.browse-movie-year')?.textContent;
            if (yearMatch && q.includes(yearMatch)) score += 2;
            if (score > bestMatchScore) {
              bestMatchScore = score;
              bestMatch = link;
            }
          }
          const movieUrl = bestMatch.getAttribute('href');
          if (!movieUrl) return null;
          console.log(`Following best match: ${bestMatch.textContent}`);
          const movieResponse = await fetchWithRetry(movieUrl, { headers: { 'User-Agent': USER_AGENT } });
          if (!movieResponse.ok) return null;
          const movieHtml = await movieResponse.text();
          const movieDoc = new DOMParser().parseFromString(movieHtml, "text/html");
          if (!movieDoc) return null;
          const magnetLinks = Array.from(movieDoc.querySelectorAll('a[href^="magnet:"]'));
          console.log(`Found ${magnetLinks.length} magnet links on movie page`);
          if (magnetLinks.length > 0) {
            const hdLink = magnetLinks.find(a => a.textContent?.includes('1080p'));
            const link = hdLink || magnetLinks[0];
            return link.getAttribute('href') || null;
          }
          return null;
        } catch (e) {
          console.error('Error parsing YTS search:', e);
          return null;
        }
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
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
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

    const traktResponse = await fetchWithRetry(`https://api.trakt.tv/${type}s/${traktId}?extended=full`, {
      headers: {
        'trakt-api-key': TRAKT_API_KEY,
        'trakt-api-version': '2',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
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