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
  if (!token) {
    
    return false;
  }
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

export async function getMediaUrl(
  traktId: number,
  type: "movie" | "show",
  episode?: { season: number; episode: number }
): Promise<string> {
  
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) {
    
    throw new Error("Not authenticated - please log in");
  }

  // Hardcoded folder_id from your Premiumize cloud for Gilligan's Island S01
  const folderId = "eXx0f7aHLcze9gVghZUBRQ";
  
  try {
    // List files in the folder
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

    // Match the episode (e.g., "S01E01" for Two on a Raft)
    const episodeStr = episode ? `S${episode.season.toString().padStart(2, "0")}E${episode.episode.toString().padStart(2, "0")}` : "";
    

    const videoFile = files.find((file: any) =>
      file.name.includes(episodeStr) && /\.(mp4|mkv|avi)$/i.test(file.name)
    );
    if (!videoFile) {
      
      throw new Error(`No playable video file found for ${episodeStr}`);
    }

    
    return videoFile.link;
  } catch (error: any) {
    
    throw error;
  }
}

export async function logout() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  
}