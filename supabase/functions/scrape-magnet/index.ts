import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import qs from 'https://deno.land/x/qs@6.9.0/mod.ts';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ACCEPT = 'text/html,application/xhtml+xml,application/json;q=0.9,image/webp,*/*;q=0.8';
const PREMIUMIZE_BASE_URL = 'https://www.premiumize.me/api';

const CONFIG = {
  MAX_RETRIES: 3,
  DEFAULT_TIMEOUT: 30000,
  SUPPORTED_TYPES: ['movie', 'show'] as const,
};

/**
 * Perform HTTP requests with automatic retries
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = CONFIG.MAX_RETRIES): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.DEFAULT_TIMEOUT);
  options.signal = controller.signal;

  let lastError: Error | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      
      if (response.status === 429 || response.status === 403) {
        const backoffTime = Math.pow(2, i) * 1000;
        console.log(`Retrying due to ${response.status} at attempt ${i + 1}, waiting ${backoffTime}ms`);
        await new Promise(r => setTimeout(r, backoffTime));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error as Error;
      const backoffTime = Math.pow(2, i) * 1000;
      console.log(`Retry attempt ${i + 1}/${retries} after ${backoffTime}ms:`, error);
      await new Promise(r => setTimeout(r, backoffTime));
    }
  }
  throw lastError || new Error('Unknown error during fetch');
}

/**
 * Get direct download link from Premiumize
 */
async function getPremiumizeLink(query: string, type: string, token: string): Promise<string> {
  console.log(`Fetching Premiumize link for: "${query}" (${type})`);
  
  try {
    // First, search Premiumize cache
    const searchResponse = await fetchWithRetry(`${PREMIUMIZE_BASE_URL}/cache/check`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': ACCEPT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: qs.stringify({
        access_token: token,
        items: [query],
      }),
    });

    const searchData = await searchResponse.json();
    console.log('Cache check response:', searchData);
    
    if (searchData.status !== 'success' || !searchData.response?.[0]) {
      throw new Error('Not found in Premiumize cache');
    }

    // Then get the direct download link
    const dlResponse = await fetchWithRetry(`${PREMIUMIZE_BASE_URL}/transfer/directdl`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': ACCEPT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: qs.stringify({
        access_token: token,
        src: query,
      }),
    });

    const dlData = await dlResponse.json();
    console.log('Direct DL response:', dlData);

    if (dlData.status !== 'success' || !dlData.location) {
      throw new Error('Failed to get direct download link');
    }

    return dlData.location;
  } catch (error) {
    console.error('Premiumize error:', error);
    throw error;
  }
}

/**
 * Server handler
 */
serve(async (req: Request): Promise<Response> => {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      status: 'error',
      message: 'Method not allowed' 
    }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { title, year, type, token } = body;

    // Validation
    if (!title || !type || !token) {
      return new Response(JSON.stringify({ 
        status: 'error',
        message: 'Missing required parameters: title, type, and token' 
      }), { status: 400, headers });
    }

    if (!CONFIG.SUPPORTED_TYPES.includes(type)) {
      return new Response(JSON.stringify({ 
        status: 'error',
        message: 'Type must be "movie" or "show"' 
      }), { status: 400, headers });
    }

    // Construct query with TMDB/Trakt-style formatting
    const query = year ? `${title} ${year}` : title;
    console.log('Processing Premiumize query:', query);

    const directLink = await getPremiumizeLink(query, type, token);

    return new Response(JSON.stringify({ 
      status: 'success',
      link: directLink,
      title,
      year,
      type
    }), { status: 200, headers });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch content',
      code: 'PREMIUMIZE_ERROR'
    }), { status: 500, headers });
  }
});