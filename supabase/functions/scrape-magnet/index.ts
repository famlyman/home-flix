import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const TRAKT_API_KEY = Deno.env.get('TRAKT_API_KEY');

async function scrapeTorrentSites(query: string): Promise<string> {
  const sites = [
    {
      name: '1337x',
      searchUrl: (q: string) => `https://1337x.to/search/${encodeURIComponent(q)}/1/`,
      parse: (html: string) => {
        const rows = html.split('<tr>').slice(1);
        for (const row of rows) {
          const seedMatch = row.match(/<td class="coll-2 seeds">(\d+)<\/td>/i);
          const linkMatch = row.match(/href="\/torrent\/\d+\/[^"]+"/i);
          const seeds = seedMatch ? Number(seedMatch[1]) : 0;
          const link = linkMatch ? linkMatch[0].replace('href="', '').replace('"', '') : null;
          console.log(`1337x - Seeds: ${seeds}, Link: ${link}`);
          if (seeds > 0 && link) {
            const torrentPage = await fetch(`https://1337x.to${link}`).then(r => r.text());
            const magnetMatch = torrentPage.match(/href="magnet:[^"]+"/i);
            return magnetMatch ? magnetMatch[0].replace('href="', '').replace('"', '') : null;
          }
        }
        return null;
      },
    },
    {
      name: 'LimeTorrents',
      searchUrl: (q: string) => `https://www.limetorrents.lol/search/all/${encodeURIComponent(q)}/seeds/1/`,
      parse: (html: string) => {
        const rows = html.split('<tr>').slice(1);
        for (const row of rows) {
          const seedMatch = row.match(/<td class="tdseed">(\d+)<\/td>/i);
          const linkMatch = row.match(/href="\/[^"]+-torrent-\d+\.html"/i);
          const seeds = seedMatch ? Number(seedMatch[1]) : 0;
          const link = linkMatch ? linkMatch[0].replace('href="', '').replace('"', '') : null;
          console.log(`LimeTorrents - Seeds: ${seeds}, Link: ${link}`);
          if (seeds > 0 && link) {
            const torrentPage = await fetch(`https://www.limetorrents.lol${link}`).then(r => r.text());
            const magnetMatch = torrentPage.match(/href="magnet:[^"]+"/i);
            return magnetMatch ? magnetMatch[0].replace('href="', '').replace('"', '') : null;
          }
        }
        return null;
      },
    },
    {
      name: 'YTS',
      searchUrl: (q: string) => `https://yts.mx/browse-movies/${encodeURIComponent(q)}/all/all/0/seeds`,
      parse: (html: string) => {
        const rows = html.split('<div class="browse-movie-wrap">').slice(1);
        for (const row of rows) {
          const seedMatch = row.match(/<span class="badge seeds">(\d+)<\/span>/i);
          const linkMatch = row.match(/href="https:\/\/yts\.mx\/movies\/[^"]+"/i);
          const seeds = seedMatch ? Number(seedMatch[1]) : 0;
          const link = linkMatch ? linkMatch[0].replace('href="', '').replace('"', '') : null;
          console.log(`YTS - Seeds: ${seeds}, Link: ${link}`);
          if (seeds > 0 && link) {
            const torrentPage = await fetch(link).then(r => r.text());
            const magnetMatch = torrentPage.match(/href="magnet:[^"]+"/i);
            return magnetMatch ? magnetMatch[0].replace('href="', '').replace('"', '') : null;
          }
        }
        return null;
      },
    },
  ];

  for (const site of sites) {
    console.log(`Trying ${site.name}`);
    const searchUrl = site.searchUrl(query);
    const searchHtml = await fetch(searchUrl).then(r => r.text());
    console.log(`${site.name} HTML length: ${searchHtml.length}`);
    const magnet = await site.parse(searchHtml);
    if (magnet) {
      console.log(`${site.name} Magnet found: ${magnet}`);
      return magnet;
    }
    console.log(`${site.name} - No seeded torrents found`);
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

    const traktResponse = await fetch(`https://api.trakt.tv/${type}s/${traktId}?extended=full`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_API_KEY,
      },
    });
    const traktData = await traktResponse.json();
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