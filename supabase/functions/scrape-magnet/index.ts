import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
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
      if (response.status === 403 || response.status === 429) {
        console.log(`Retrying due to ${response.status} at attempt ${i + 1}`);
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
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
        console.log(`Found ${magnetMatches.length} magnet links on YTS`);
        if (magnetMatches.length > 0) {
          const hdMatch = magnetMatches.find(m => m[1].includes('1080p'));
          return hdMatch ? hdMatch[1] : magnetMatches[0][1];
        }
        return null;
      },
    },
    {
      name: '1337x',
      searchUrl: (q: string) => `https://1337x.to/search/${encodeURIComponent(q)}/1/`,
      parse: async (html: string) => {
        console.log('1337x HTML snippet:', html.slice(0, 1000));
        const torrentMatches = [...html.matchAll(/<a href="\/torrent\/[^"]+">([^<]+)<\/a>/gi)];
        console.log(`Found ${torrentMatches.length} torrents on 1337x`);
        if (torrentMatches.length === 0) return null;

        const seedsMatches = [...html.matchAll(/<td class="coll-2 seeds">(\d+)<\/td>/gi)];
        let bestTorrentUrl = '';
        let maxSeeds = 0;

        for (let i = 0; i < torrentMatches.length; i++) {
          const torrentUrl = `https://1337x.to${torrentMatches[i][0].match(/href="([^"]+)"/)[1]}`;
          const seeds = parseInt(seedsMatches[i]?.[1] || '0');
          if (seeds > maxSeeds) {
            maxSeeds = seeds;
            bestTorrentUrl = torrentUrl;
          }
        }

        if (!bestTorrentUrl) return null;

        console.log(`Following 1337x torrent: ${bestTorrentUrl}`);
        const torrentResponse = await fetchWithRetry(bestTorrentUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': ACCEPT,
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://1337x.to',
          },
        });
        if (!torrentResponse.ok) return null;

        const torrentHtml = await torrentResponse.text();
        const magnetMatch = torrentHtml.match(/href="(magnet:[^"]+)"/i);
        console.log(`Magnet found on 1337x: ${magnetMatch ? 'Yes' : 'No'}`);
        return magnetMatch ? magnetMatch[1] : null;
      },
    },
    {
      name: 'PirateBay',
      searchUrl: (q: string) => `https://pirateproxy.live/search/${encodeURIComponent(q)}/1/99/0`,
      parse: async (html: string) => {
        console.log('PirateBay HTML snippet:', html.slice(0, 1000));
        const torrentMatches = [...html.matchAll(/<a href="\/torrent\/[^"]+" title="[^"]+">([^<]+)<\/a>/gi)];
        console.log(`Found ${torrentMatches.length} torrents on PirateBay`);
        if (torrentMatches.length === 0) return null;

        const seedsMatches = [...html.matchAll(/<td align="right">(\d+)<\/td>/gi)];
        let bestTorrentUrl = '';
        let maxSeeds = 0;

        for (let i = 0; i < torrentMatches.length; i++) {
          const torrentUrlMatch = html.matchAll(/<a href="(\/torrent\/[^"]+)" title="[^"]+">/gi);
          const urls = Array.from(torrentMatches);
          const torrentUrl = `https://pirateproxy.live${urls[i][0].match(/href="([^"]+)"/)[1]}`;
          const seeds = parseInt(seedsMatches[i]?.[1] || '0');
          if (seeds > maxSeeds) {
            maxSeeds = seeds;
            bestTorrentUrl = torrentUrl;
          }
        }

        if (!bestTorrentUrl) return null;

        console.log(`Following PirateBay torrent: ${bestTorrentUrl}`);
        const torrentResponse = await fetchWithRetry(bestTorrentUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': ACCEPT,
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://pirateproxy.live',
          },
        });
        if (!torrentResponse.ok) return null;

        const torrentHtml = await torrentResponse.text();
        const magnetMatch = torrentHtml.match(/href="(magnet:[^"]+)"/i);
        console.log(`Magnet found on PirateBay: ${magnetMatch ? 'Yes' : 'No'}`);
        return magnetMatch ? magnetMatch[1] : null;
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
          'Referer': 'https://www.google.com',
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
    const { title, year, type } = body;

    if (!title || !type) throw new Error('Missing required parameters: title and type');
    if (!['movie', 'show'].includes(type)) throw new Error('Type must be "movie" or "show"');

    const query = year ? `${title} ${year}` : title;
    console.log('Search query:', query);

    const magnet = await scrapeTorrentSites(query, type);
    return new Response(JSON.stringify({ magnet, title, year }), {
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