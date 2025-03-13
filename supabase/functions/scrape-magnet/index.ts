import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const TRAKT_API_KEY = Deno.env.get('TRAKT_API_KEY');

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

    // Fetch Trakt metadata
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

    // Scrape 1337x
    const searchUrl = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
    console.log(`Search URL: ${searchUrl}`);
    const searchResponse = await fetch(searchUrl);
    const searchHtml = await searchResponse.text();
    console.log(`Search HTML length: ${searchHtml.length}`);

    // Find torrents with seeds
    const torrentRows = searchHtml.split('<tr>').slice(1); // Skip first <tr> (header)
    let torrentLink: string | undefined;
    for (const row of torrentRows) {
      const seedMatch = row.match(/<td class="coll-2 seeds">(\d+)<\/td>/i);
      const linkMatch = row.match(/href="\/torrent\/\d+\/[^"]+"/i);
      const seeds = seedMatch ? Number(seedMatch[1]) : 0;
      const link = linkMatch ? linkMatch[0].replace('href="', '').replace('"', '') : 'none';
      console.log(`Row - Seeds: ${seeds}, Link: ${link}`);
      if (seeds > 0 && link !== 'none') {
        torrentLink = link;
        console.log(`Selected torrent: ${torrentLink}`);
        break;
      }
    }
    if (!torrentLink) {
      console.log('No seeded torrents matched in search results');
      throw new Error('No seeded torrents found');
    }

    // Fetch torrent page
    const torrentPageResponse = await fetch(`https://1337x.to${torrentLink}`);
    const torrentHtml = await torrentPageResponse.text();
    const magnetMatch = torrentHtml.match(/href="magnet:[^"]+"/i);
    if (!magnetMatch) throw new Error('No magnet link found');
    const magnet = magnetMatch[0].replace('href="', '').replace('"', '');
    console.log(`Magnet found: ${magnet}`);

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