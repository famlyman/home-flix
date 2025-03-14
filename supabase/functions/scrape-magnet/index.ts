import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const TRAKT_API_KEY = Deno.env.get('TRAKT_API_KEY');

async function scrapeTorrentSites(query: string): Promise<string> {
  const sites = [
    {
      name: 'YTS',
      searchUrl: (q: string) => {
        const url = `https://yts.mx/movies/${encodeURIComponent(q.split(' ').join('-').toLowerCase())}`;
        console.log('YTS URL:', url);
        return url;
      },
      parse: async (html: string) => {
        console.log('Parsing YTS, HTML snippet:', html.slice(0, 1000));
        const magnetMatches = [...html.matchAll(/href="(magnet:[^"]+)"/gi)];
        console.log('Magnet matches found:', magnetMatches.length);
        if (magnetMatches.length > 0) {
          const magnet = magnetMatches[0][1];
          console.log('Magnet found:', magnet);
          return magnet;
        }
        console.log('No magnet in YTS page');
        return null;
      },
    },
  ];

  for (const site of sites) {
    console.log(`Trying ${site.name}`);
    const response = await fetch(site.searchUrl(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    if (!response.ok) {
      console.log(`Skipping ${site.name} due to ${response.status}`);
      continue;
    }
    const searchHtml = await response.text();
    console.log(`${site.name} HTML length: ${searchHtml.length}`);
    const magnet = await site.parse(searchHtml);
    if (magnet) return magnet;
  }
  throw new Error('No seeded torrents found');
}

serve(async (req: Request): Promise<Response> => {
  console.log('Function started');
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const bodyText = await req.text();
    console.log('Raw body:', bodyText);
    const body = JSON.parse(bodyText);
    const { traktId, type } = body;

    if (!TRAKT_API_KEY) throw new Error('TRAKT_API_KEY not set');
    const traktResponse = await fetch(`https://api.trakt.tv/${type}s/${traktId}?extended=full`, {
      headers: { 'trakt-api-key': TRAKT_API_KEY },
    });
    console.log(`Trakt status: ${traktResponse.status}`);
    if (!traktResponse.ok) {
      throw new Error(`Trakt API failed with status: ${traktResponse.status}`);
    }
    const traktText = await traktResponse.text();
    console.log('Trakt response snippet:', traktText.slice(0, 200));
    const traktData = JSON.parse(traktText);
    const query = traktData.year ? `${traktData.title} ${traktData.year}` : traktData.title;
    console.log('Query:', query);

    const magnet = await scrapeTorrentSites(query);
    return new Response(JSON.stringify({ magnet }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : 'Unknown');
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to scrape' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});