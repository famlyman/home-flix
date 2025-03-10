import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const PREMIUMIZE_API_BASE = "https://www.premiumize.me/api";
const PREMIUMIZE_CLIENT_ID = Constants.expoConfig?.extra?.PREM_CLIENT_ID || '';
const PREMIUMIZE_CLIENT_SECRET = Constants.expoConfig?.extra?.PREM_CLIENT_SECRET || '';
const REDIRECT_URI = Constants.expoConfig?.extra?.PREM_REDIRECT_URI || 'yourapp://auth/callback';

// Keys for storing tokens
const ACCESS_TOKEN_KEY = 'premiumize_access_token';
const REFRESH_TOKEN_KEY = 'premiumize_refresh_token';

// Get stored tokens
export async function getStoredAccessToken() {
  return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getStoredRefreshToken() {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

// Authenticate with Premiumize
export async function authenticatePremiumize() {
  try {
    // Check if we already have a token
    const existingToken = await getStoredAccessToken();
    if (existingToken) {
      // Verify the token is still valid
      const isValid = await verifyToken(existingToken);
      if (isValid) return existingToken;
    }
    
    // If we have a refresh token, try to refresh
    const refreshToken = await getStoredRefreshToken();
    if (refreshToken) {
      try {
        const newToken = await refreshAccessToken(refreshToken);
        if (newToken) return newToken;
      } catch (e) {
        console.log("Failed to refresh token, proceeding to new authorization");
      }
    }
    
    // Open browser for authorization
    const authUrl = `https://www.premiumize.me/authorize?client_id=${PREMIUMIZE_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl, 
      REDIRECT_URI
    );
    
    if (result.type === 'success') {
      const { url } = result;
      // Extract authorization code from URL
      const code = new URL(url).searchParams.get('code');
      
      if (code) {
        // Exchange code for access token
        const tokenResponse = await axios.post('https://www.premiumize.me/token', null, {
          params: {
            client_id: PREMIUMIZE_CLIENT_ID,
            client_secret: PREMIUMIZE_CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
          }
        });
        
        const { access_token, refresh_token } = tokenResponse.data;
        
        // Store tokens securely
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token);
        if (refresh_token) {
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh_token);
        }
        
        return access_token;
      }
    }
    
    throw new Error("Authentication failed");
  } catch (error) {
    console.error("Premiumize authentication error:", error);
    throw error;
  }
}

// Verify if token is still valid
async function verifyToken(token: string) {
  try {
    const response = await axios.get(`${PREMIUMIZE_API_BASE}/account/info`, {
      params: { access_token: token }
    });
    return response.data.status === "success";
  } catch (e) {
    return false;
  }
}

// Refresh access token
async function refreshAccessToken(refreshToken: string) {
  const response = await axios.post('https://www.premiumize.me/token', null, {
    params: {
      client_id: PREMIUMIZE_CLIENT_ID,
      client_secret: PREMIUMIZE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }
  });
  
  const { access_token, refresh_token } = response.data;
  
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token);
  if (refresh_token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh_token);
  }
  
  return access_token;
}

// Update your media URL function to use the authentication
export async function getPremiumizeMediaUrl(traktId: number, type: "movie" | "show", episode?: { season: number; episode: number }): Promise<string> {
  try {
    // Get or refresh token
    const accessToken = await authenticatePremiumize();
    
    // Construct query
    const queryString = type === "movie" 
      ? `trakt:movie:${traktId}` 
      : `trakt:show:${traktId}:S${episode?.season.toString().padStart(2, '0')}E${episode?.episode.toString().padStart(2, '0')}`;
    
    console.log("Premiumize query:", queryString);
    
    const searchResponse = await axios.get(`${PREMIUMIZE_API_BASE}/transfer/directdl`, {
      params: {
        access_token: accessToken,
        src: queryString,
      },
    });
    
    console.log("Premiumize response status:", searchResponse.status);
    
    const files = searchResponse.data.content;
    if (!files || files.length === 0) throw new Error("No media files found");

    // Find the best video file
    const videoFile = files.find((file: any) => 
      file.path.endsWith(".mp4") || 
      file.path.endsWith(".mkv") || 
      file.path.endsWith(".avi")
    );
    
    if (!videoFile) throw new Error("No playable video file found");

    return videoFile.link; // Direct streaming URL
  } catch (err: any) {
    console.error("Premiumize Error:", err.response?.data || err.message);
    throw err;
  }
}