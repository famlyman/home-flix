import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const TRAKT_API_KEY = Deno.env.get('TRAKT_API_KEY');

async function scrapeTorrentSites(query: string): Promise<string> {
  const sites = [
    {
      name: '1337x',
      searchUrl: (q: string) => `https://1337x.to/search/${encodeURIComponent(q)}/1/`,
      parse: async (html: string) => {
        console.log('Parsing 1337x');
        const rows = html.split('<tr>').slice(1);
        for (const row of rows) {
          const seedMatch = row.match(/<td class="coll-2 seeds">(\d+)<\/td>/i);
          const linkMatch = row.match(/href="\/torrent\/\d+\/[^"]+"/i);
          const seeds = seedMatch ? Number(seedMatch[1]) : 0;
          const link = linkMatch ? linkMatch[0].replace('href="', '').replace('"', '') : null;
          console.log(`1337x - Seeds: ${seeds}, Link: ${link || 'none'}`);
          if (seeds > 0 && link) {
            const torrentPage = await fetch(`https://1337x.to${link}`).then(r => r.text());
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
    const searchHtml = await fetch(site.searchUrl(query)).then(r => r.text());
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
    const bodyText = await req.text(); // Use text instead of json
    console.log('Raw body:', bodyText);
    const body = JSON.parse(bodyText);
    const { traktId, type } = body;

    const traktResponse = await fetch(`https://api.trakt.tv/${type}s/${traktId}?extended=full`, {
      headers: { 'trakt-api-key': TRAKT_API_KEY },
    }).then(r => r.text());
    const traktData = JSON.parse(traktResponse);
    const query = `${traktData.title} ${traktData.year}`;
    console.log('Query:', query);

    const magnet = await scrapeTorrentSites(query);
    return new Response(JSON.stringify({ magnet }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.log('Error:', error instanceof Error ? error.message : 'Unknown');
    return new Response(JSON.stringify({ error: 'Failed to scrape' }), { status: 500 });
  }
});