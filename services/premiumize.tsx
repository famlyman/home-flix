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

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error("Missing Premiumize CLIENT_ID or CLIENT_SECRET in expoConfig.extra");
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "User-Agent": "YourAppName" },
});

// Authentication functions remain unchanged
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

// Updated getMediaUrl with optional sourceUrl parameter
export async function getMediaUrl(
  traktId: number,
  type: "movie" | "show",
  episode?: { season: number; episode: number },
  sourceUrl?: string
): Promise<string> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) {
    throw new Error("Not authenticated - please log in");
  }
  console.log("Access Token:", token);

  try {
    if (sourceUrl) {
      console.log("Sending request to:", SUPABASE_PROXY_URL);
      const response = await axios.post(
        SUPABASE_PROXY_URL,
        { sourceUrl, access_token: token },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      console.log("Supabase response:", response.data);
      const { streamUrl } = response.data;
      if (!streamUrl) {
        throw new Error("No streamable link returned from Premiumize");
      }
      return streamUrl;
    } else {
      // Folder logic...
      const folderId = "eXx0f7aHLcze9gVghZUBRQ";
      const folderResponse = await api.get("/folder/list", {
        params: { access_token: token, id: folderId },
      });
      if (folderResponse.data.status !== "success") {
        throw new Error("Failed to list folder: " + folderResponse.data.message);
      }
      const files = folderResponse.data.content;
      if (!files || !files.length) {
        throw new Error("No files found in folder");
      }
      const episodeStr = episode
        ? `S${episode.season.toString().padStart(2, "0")}E${episode.episode.toString().padStart(2, "0")}`
        : "";
      const videoFile = files.find((file: any) =>
        file.name.includes(episodeStr) && /\.(mp4|mkv|avi)$/i.test(file.name)
      );
      if (!videoFile) {
        throw new Error(`No playable video file found for ${episodeStr}`);
      }
      return videoFile.link;
    }
    throw new Error("Unexpected error: No media URL resolved");
  } catch (error: any) {
    console.log("Error details:", error.response?.data, error.response?.status);
    throw new Error(`Premiumize error: ${error.message}`);
  }
}

export async function logout() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}