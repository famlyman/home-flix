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

    // Scrape 1337x search page
    const searchUrl = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
    const searchResponse = await fetch(searchUrl);
    const searchHtml = await searchResponse.text();

    // Find torrents with seeds
    const torrentRows = searchHtml.split('<tr>');
    let torrentLink: string | undefined;
    for (const row of torrentRows) {
      const seedMatch = row.match(/<td class="coll-2 seeds">(\d+)<\/td>/);
      const linkMatch = row.match(/href="\/torrent\/\d+\/[^"]+"/);
      if (seedMatch && Number(seedMatch[1]) > 0 && linkMatch) {
        torrentLink = linkMatch[0].replace('href="', '').replace('"', '');
        break; // Take the first seeded torrent
      }
    }
    if (!torrentLink) throw new Error('No seeded torrents found');

    // Fetch torrent page
    const torrentPageResponse = await fetch(`https://1337x.to${torrentLink}`);
    const torrentHtml = await torrentPageResponse.text();
    const magnetMatch = torrentHtml.match(/href="magnet:[^"]+"/);
    if (!magnetMatch) throw new Error('No magnet link found');
    const magnet = magnetMatch[0].replace('href="', '').replace('"', '');

    return new Response(JSON.stringify({ magnet }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});