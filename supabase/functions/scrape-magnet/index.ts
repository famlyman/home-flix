import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const TRAKT_API_KEY = Deno.env.get('TRAKT_API_KEY');

async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    console.log(`Fetched ${url} - First 200 chars: ${text.slice(0, 200)}`);
    return text;
  } catch (error) {
    throw new Error(`Fetch failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapeTorrentSites(query: string): Promise<string> {
  const torrentSites = [
    {
      siteName: '1337x',
      getSearchUrl: (q: string) => `https://1337x.to/search/${encodeURIComponent(q)}/1/`,
      parseHtml: async (html: string) => {
        console.log('Parsing 1337x HTML');
        const rows = html.split('<tr>').slice(1);
        for (const row of rows) {
          const seedMatch = row.match(/<td class="coll-2 seeds">(\d+)<\/td>/i);
          const linkMatch = row.match(/href="\/torrent\/\d+\/[^"]+"/i);
          const seeds = seedMatch ? Number(seedMatch[1]) : 0;
          const link = linkMatch ? linkMatch[0].replace('href="', '').replace('"', '') : null;
          console.log(`1337x - Seeds: ${seeds}, Link: ${link || 'none'}`);
          if (seeds > 0 && link) {
            const torrentPage = await fetchWithTimeout(`https://1337x.to${link}`);
            const magnetMatch = torrentPage.match(/href="magnet:[^"]+"/i);
            return magnetMatch ? magnetMatch[0].replace('href="', '').replace('"', '') : null;
          }
        }
        return null;
      },
    },
    // Comment out others for now to isolate
    // { siteName: 'LimeTorrents', ... },
    // { siteName: 'YTS', ... },
  ];

  for (const site of torrentSites) {
    console.log(`Trying ${site.siteName}`);
    const searchUrl = site.getSearchUrl(query);
    try {
      const searchHtml = await fetchWithTimeout(searchUrl);
      console.log(`${site.siteName} HTML length: ${searchHtml.length}`);
      const magnet = await site.parseHtml(searchHtml);
      if (magnet) {
        console.log(`${site.siteName} Magnet found: ${magnet}`);
        return magnet;
      }
      console.log(`${site.siteName} - No seeded torrents found`);
    } catch (error) {
      console.log(`Error scraping ${site.siteName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  throw new Error('No seeded torrents found across all sites');
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!TRAKT_API_KEY) {
    return new Response(JSON.stringify({ error: 'TRAKT_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { traktId, type, season, episode } = body as {
      traktId?: number;
      type?: 'movie' | 'show';
      season?: number;
      episode?: number;
    };

    if (!traktId || !type) {
      return new Response(JSON.stringify({ error: 'Trakt ID and type required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching Trakt metadata');
    const traktResponse = await fetchWithTimeout(`https://api.trakt.tv/${type}s/${traktId}?extended=full`, 5000);
    const traktData = JSON.parse(traktResponse);
    const { title, year } = traktData;
    const query = episode
      ? `${title} S${season!.toString().padStart(2, '0')}E${episode!.toString().padStart(2, '0')}`
      : `${title} ${year}`;
    console.log(`Search query: ${query}`);

    const magnet = await scrapeTorrentSites(query);
    return new Response(JSON.stringify({ magnet }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.log(`Error: ${errorMessage}`);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});