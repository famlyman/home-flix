import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import qs from "qs";

const BASE_URL = "https://www.premiumize.me/api";
const TOKEN_URL = "https://www.premiumize.me/token";
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

console.log("⭐⭐ premiumizeNew.tsx loaded");

export async function authenticate(
  onCodeReceived: (url: string, code: string) => void
): Promise<string> {
  console.log("⭐⭐ Starting Premiumize auth");
  try {
    const deviceResponse = await api.post(
      TOKEN_URL,
      qs.stringify({
        client_id: CLIENT_ID,
        response_type: "device_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log("⭐⭐ Device code response:", deviceResponse.data);
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
        console.log("⭐⭐ Token received:", access_token.substring(0, 10) + "...");
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token);
        return access_token;
      } catch (error: any) {
        if (error.response?.data?.error === "authorization_pending") {
          console.log("⭐⭐ Waiting for user to enter code...");
          await new Promise((resolve) => setTimeout(resolve, interval * 1000));
          totalWait += interval;
        } else {
          console.error("⭐⭐ Token fetch error:", error.response?.data || error.message);
          throw error;
        }
      }
    }
    throw new Error("Authentication timed out");
  } catch (error) {
    console.error("⭐⭐ Auth error:", error);
    throw new Error("Failed to authenticate with Premiumize");
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) {
    console.log("⭐⭐ No token found");
    return false;
  }
  try {
    const response = await api.get("/account/info", {
      params: { access_token: token },
    });
    const isValid = response.data.status === "success";
    console.log("⭐⭐ Token valid:", isValid);
    if (!isValid) await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    return isValid;
  } catch (error) {
    console.error("⭐⭐ Token check failed:", error);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    return false;
  }
}

export async function getMediaUrl(
  traktId: number,
  type: "movie" | "show",
  episode?: { season: number; episode: number }
): Promise<string> {
  console.log("⭐⭐ getMediaUrl called:", { traktId, type, episode });
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) {
    console.log("⭐⭐ No token for media fetch");
    throw new Error("Not authenticated - please log in");
  }

  // Hardcoded folder_id from your Premiumize cloud for Gilligan's Island S01
  const folderId = "eXx0f7aHLcze9gVghZUBRQ";
  console.log("⭐⭐ Fetching files from folder:", folderId);

  try {
    // List files in the folder
    const folderResponse = await api.get("/folder/list", {
      params: { access_token: token, id: folderId },
    });
    console.log("⭐⭐ Folder list response:", JSON.stringify(folderResponse.data, null, 2));

    if (folderResponse.data.status !== "success") {
      throw new Error("Failed to list folder: " + folderResponse.data.message);
    }

    const files = folderResponse.data.content;
    if (!files || !files.length) {
      throw new Error("No files found in folder");
    }

    // Match the episode (e.g., "S01E01" for Two on a Raft)
    const episodeStr = episode ? `S${episode.season.toString().padStart(2, "0")}E${episode.episode.toString().padStart(2, "0")}` : "";
    console.log("⭐⭐ Looking for episode:", episodeStr);

    const videoFile = files.find((file: any) =>
      file.name.includes(episodeStr) && /\.(mp4|mkv|avi)$/i.test(file.name)
    );
    if (!videoFile) {
      console.log("⭐⭐ Available files:", files.map((f: any) => f.name));
      throw new Error(`No playable video file found for ${episodeStr}`);
    }

    console.log("⭐⭐ Found video file:", videoFile.name);
    console.log("⭐⭐ Media URL:", videoFile.link);
    return videoFile.link;
  } catch (error: any) {
    console.error("⭐⭐ getMediaUrl error:", error.message, "Axios error:", error.response?.data || error);
    throw error;
  }
}

export async function logout() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  console.log("⭐⭐ Logged out");
}