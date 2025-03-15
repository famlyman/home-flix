import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import qs from "qs";

const BASE_URL = "https://www.premiumize.me/api";
const TOKEN_URL = "https://www.premiumize.me/token";
const JACKETT_URL = "http://localhost:9117/api/v2.0/indexers/all/results"; // Local Jackett URL
const JACKETT_API_KEY = Constants.expoConfig?.extra?.JACKETT_API_KEY || ""; // Replace with your API key
const SUPABASE_PROXY_URL = "https://ajkjsezdaulybvrscoyv.supabase.co/functions/v1/premiumize-proxy";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqa2pzZXpkYXVseWJ2cnNjb3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjYzNTYsImV4cCI6MjA1NzQwMjM1Nn0.GphKYRnukSyb3hy6arl0euRyYX3mVWrWXBnTZde3fVU";
const CLIENT_ID = Constants.expoConfig?.extra?.PREMIUMIZE_CLIENT_ID || "";
const CLIENT_SECRET = Constants.expoConfig?.extra?.PREMIUMIZE_CLIENT_SECRET || "";
const ACCESS_TOKEN_KEY = "premiumize_new_access_token";
const TMDB_API_KEY = Constants.expoConfig?.extra?.TMDB_API_KEY || "";

const api = axios.create({ baseURL: BASE_URL, timeout: 15000, headers: { "User-Agent": "HomeFlixApp" } });

// Authentication functions (unchanged)
export async function authenticate(onCodeReceived: (url: string, code: string) => void): Promise<string> {
  try {
    const deviceResponse = await api.post(
      TOKEN_URL,
      qs.stringify({ client_id: CLIENT_ID, response_type: "device_code" }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { device_code, user_code, verification_uri, expires_in, interval } = deviceResponse.data;
    onCodeReceived(verification_uri, user_code);
    let totalWait = 0;
    while (totalWait < expires_in) {
      try {
        const tokenResponse = await api.post(
          TOKEN_URL,
          qs.stringify({
            code: device_code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "device_code",
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        const { access_token } = tokenResponse.data;
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token);
        return access_token;
      } catch (error: any) {
        if (error.response?.data?.error === "authorization_pending") {
          await new Promise((resolve) => setTimeout(resolve, interval * 1000));
          totalWait += interval;
        } else {
          throw error;
        }
      }
    }
    throw new Error("Authentication timed out");
  } catch (error) {
    throw new Error("Failed to authenticate with Premiumize");
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) return false;
  try {
    const response = await api.get("/account/info", { params: { access_token: token } });
    const isValid = response.data.status === "success";
    if (!isValid) await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    return isValid;
  } catch (error) {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    return false;
  }
}

async function fetchPremiumizeLink(token: string, query: string): Promise<string | null> {
  try {
    console.log("Checking Premiumize cache for:", query);
    const cacheResponse = await api.post(
      "/cache/check",
      qs.stringify({ access_token: token, items: [query] }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    if (cacheResponse.data.status === "success" && cacheResponse.data.response?.[0]) {
      const dlResponse = await api.post(
        "/transfer/directdl",
        qs.stringify({ access_token: token, src: query }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      if (dlResponse.data.status === "success" && dlResponse.data.location) {
        console.log("Direct link from cache:", dlResponse.data.location);
        return dlResponse.data.location;
      }
    }
    console.log("Content not found in cache:", query);
    return null;
  } catch (error) {
    console.error("Premiumize cache error:", error);
    return null;
  }
}

async function fetchJackettTorrent(token: string, query: string, type: "movie" | "show"): Promise<string> {
  try {
    console.log("Searching Jackett for:", query);
    const jackettResponse = await axios.get(JACKETT_URL, {
      params: {
        apikey: JACKETT_API_KEY,
        Query: query,
        Category: type === "movie" ? "2000" : "5000", // Movies or TV
      },
    });

    const torrents = jackettResponse.data?.Results || [];
    if (!torrents.length) throw new Error("No torrents found on Jackett");

    const bestTorrent = torrents.sort((a: any, b: any) => b.Seeders - a.Seeders)[0];
    const magnet = bestTorrent.MagnetUri;
    console.log("Best torrent magnet:", magnet);

    const transferResponse = await api.post(
      "/transfer/create",
      qs.stringify({ access_token: token, src: magnet }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    if (transferResponse.data.status !== "success") throw new Error("Failed to create transfer");

    console.log("Waiting for Premiumize to process torrent...");
    let directLink: string | undefined;
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const listResponse = await api.get("/transfer/list", { params: { access_token: token } });
      const transfer = listResponse.data.transfers.find((t: any) => t.src === magnet);
      if (transfer?.file_id) {
        const dlResponse = await api.post(
          "/transfer/directdl",
          qs.stringify({ access_token: token, src: transfer.file_id }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        if (dlResponse.data.status === "success" && dlResponse.data.location) {
          directLink = dlResponse.data.location;
          console.log("Direct link from torrent:", directLink);
          break;
        }
      }
    }
    if (!directLink) throw new Error("Failed to get direct link from torrent");

    return directLink;
  } catch (error) {
    console.error("Jackett fetch error:", error);
    throw error;
  }
}

export async function getMediaUrl(
  traktId: number,
  type: "movie" | "show",
  episode?: { season: number; episode: number },
  title?: string,
  year?: number
): Promise<string> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) throw new Error("Not authenticated - please log in");
  console.log("Access token:", token);

  let queryTitle: string;
  let queryYear: number;

  if (!title || !year) {
    const response = await fetch(
      `https://api.themoviedb.org/3/${type === "movie" ? "movie" : "tv"}/${traktId}?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();
    if (!data) throw new Error("Failed to fetch media details from TMDB");
    queryTitle = data.title || data.name || "";
    if (!queryTitle) throw new Error("No title found in TMDB data");
    queryYear = parseInt(data.release_date?.split("-")[0] || data.first_air_date?.split("-")[0], 10);
    if (!queryYear || isNaN(queryYear)) throw new Error("Invalid year from TMDB data");
  } else {
    queryTitle = title;
    queryYear = year;
  }

  const baseQuery = `${queryTitle} ${queryYear}`;
  let primaryQuery = baseQuery;
  if (type === "show" && episode) {
    const seasonEp = `S${episode.season.toString().padStart(2, "0")}E${episode.episode.toString().padStart(2, "0")}`;
    primaryQuery = `${queryTitle} ${seasonEp}`;
  }

  let directLink = await fetchPremiumizeLink(token, primaryQuery);
  if (!directLink) {
    directLink = await fetchJackettTorrent(token, primaryQuery, type);
  }

  console.log("Sending to proxy:", directLink);
  const proxyResponse = await axios.post(
    SUPABASE_PROXY_URL,
    { sourceUrl: directLink, access_token: token },
    { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
  );

  const { streamUrl, error } = proxyResponse.data;
  if (error) throw new Error(`Proxy error: ${error}`);
  if (!streamUrl) throw new Error("No streamable link returned from proxy");

  console.log("Final stream URL:", streamUrl);
  return streamUrl;
}

export async function logout() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}