import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { load } from 'https://deno.land/x/cheerio@1.0.7/mod.ts'; // Deno-compatible cheerio
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'; // DOM parsing for Deno

const TRAKT_API_KEY = Deno.env.get('TCLIENT_ID'); // Fetch from Supabase env vars

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

    // Scrape 1337x
    const searchUrl = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
    const searchResponse = await fetch(searchUrl);
    const searchHtml = await searchResponse.text();
    const $ = load(searchHtml); // Cheerio in Deno

    const torrentRow = $('table.table-list tr')
      .filter((i: any, el: any) => Number($(el).find('.seeds').text()) > 0)
      .first();
    const torrentLink = torrentRow.find('a[href*="/torrent/"]').attr('href');
    if (!torrentLink) {
      throw new Error('No seeded torrents found');
    }

    const torrentPageResponse = await fetch(`https://1337x.to${torrentLink}`);
    const torrentHtml = await torrentPageResponse.text();
    const $torrent = load(torrentHtml);
    const magnet = $torrent('a[href^="magnet:"]').attr('href');
    if (!magnet) {
      throw new Error('No magnet link found');
    }

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