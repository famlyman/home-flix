import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import qs from "qs";

const BASE_URL = "https://www.premiumize.me/api";
const TOKEN_URL = "https://www.premiumize.me/token";
const SUPABASE_PROXY_URL = "https://ajkjsezdaulybvrscoyv.supabase.co/functions/v1/premiumize-proxy";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqa2pzZXpkYXVseWJ2cnNjb3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjYzNTYsImV4cCI6MjA1NzQwMjM1Nn0.GphKYRnukSyb3hy6arl0euRyYX3mVWrWXBnTZde3fVU";
const CLIENT_ID = Constants.expoConfig?.extra?.PREMIUMIZE_CLIENT_ID || "";
const CLIENT_SECRET = Constants.expoConfig?.extra?.PREMIUMIZE_CLIENT_SECRET || "";
const ACCESS_TOKEN_KEY = "premiumize_new_access_token";
const TMDB_API_KEY = Constants.expoConfig?.extra?.TMDB_API_KEY || "";

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error("Missing Premiumize CLIENT_ID or CLIENT_SECRET in expoConfig.extra");
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "User-Agent": "HomeFlixApp" },
});

// Authentication functions (unchanged)
export async function authenticate(
  onCodeReceived: (url: string, code: string) => void
): Promise<string> {
  try {
    const deviceResponse = await api.post(
      TOKEN_URL,
      qs.stringify({
        client_id: CLIENT_ID,
        response_type: "device_code",
      }),
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
    const response = await api.get("/account/info", {
      params: { access_token: token },
    });
    const isValid = response.data.status === "success";
    if (!isValid) await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    return isValid;
  } catch (error) {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    return false;
  }
}

export async function getServicesList(): Promise<any> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) throw new Error("Not authenticated - please log in");

  try {
    const response = await api.get("/services/list", {
      params: { access_token: token },
    });
    if (response.data.status !== "success") throw new Error("Failed to fetch services list");
    console.log("Fetched services list:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching services list:", error.message);
    throw error;
  }
}

/**
 * Attempts to get a direct download link from Premiumize with multiple query formats
 */
async function fetchPremiumizeLink(
  token: string,
  primaryQuery: string,
  fallbackQueries: string[]
): Promise<string> {
  const queries = [primaryQuery, ...fallbackQueries];

  for (const query of queries) {
    try {
      console.log("Checking Premiumize cache for:", query);
      const cacheResponse = await api.post(
        "/cache/check",
        qs.stringify({
          access_token: token,
          items: [query],
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      if (cacheResponse.data.status !== "success") {
        console.log("Cache check failed:", cacheResponse.data);
        continue;
      }
      if (!cacheResponse.data.response?.[0]) {
        console.log(`Content not found in cache: ${query}`);
        continue;
      }

      console.log("Fetching direct download for:", query);
      const dlResponse = await api.post(
        "/transfer/directdl",
        qs.stringify({
          access_token: token,
          src: query,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const dlData = dlResponse.data;
      if (dlData.status !== "success" || !dlData.location) {
        console.log("Direct DL failed:", dlData);
        continue;
      }

      console.log("Direct link obtained:", dlData.location);
      return dlData.location;
    } catch (error) {
      console.error(`Error with query "${query}":`, error);
      continue;
    }
  }

  throw new Error("Content not found in Premiumize cache. It may not be available yet.");
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
  console.log("Premiumize access token:", token); // Log token here

  try {
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

      const yearStr = data.release_date?.split("-")[0] || data.first_air_date?.split("-")[0];
      queryYear = parseInt(yearStr, 10);
      if (!queryYear || isNaN(queryYear)) throw new Error("Invalid year from TMDB data");
    } else {
      queryTitle = title;
      queryYear = year;
    }

    const baseQuery = `${queryTitle} ${queryYear}`;
    let primaryQuery = baseQuery;
    const fallbackQueries: string[] = [
      queryTitle,
      `${queryTitle}.${queryYear}`,
      `${queryTitle.replace(/\s+/g, ".")}.${queryYear}`,
    ];

    if (type === "show" && episode) {
      const { season, episode: ep } = episode;
      const seasonEp = `S${season.toString().padStart(2, "0")}E${ep.toString().padStart(2, "0")}`;
      primaryQuery = `${queryTitle} ${seasonEp}`;
      fallbackQueries.unshift(
        `${baseQuery} ${seasonEp}`,
        `${queryTitle}.${seasonEp}`,
        `${queryTitle.replace(/\s+/g, ".")}.${seasonEp}`,
        `${queryTitle} ${seasonEp} 1080p`,
        `${queryTitle} ${seasonEp} WEB-DL`
      );
    } else if (type === "movie") {
      fallbackQueries.push(
        `${baseQuery} 1080p`,
        `${baseQuery} WEB-DL`,
        `${queryTitle.replace(/\s+/g, ".")}.${queryYear}.1080p`
      );
    }

    const directLink = await fetchPremiumizeLink(token, primaryQuery, fallbackQueries);
    console.log("Direct link from Premiumize:", directLink); // Log direct link here

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
  } catch (error: any) {
    console.error("Media URL error:", error.response?.data || error.message);
    throw new Error(error.message || "Failed to fetch media URL from Premiumize");
  }
}

export async function logout() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}