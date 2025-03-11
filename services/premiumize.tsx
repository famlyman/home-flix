import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import qs from "qs";

const PREMIUMIZE_API_BASE = "https://www.premiumize.me/api";
const PREMIUMIZE_TOKEN_URL = "https://www.premiumize.me/token";
const PREMIUMIZE_CLIENT_ID = Constants.expoConfig?.extra?.PREMIUMIZE_CLIENT_ID || "";
const PREMIUMIZE_CLIENT_SECRET = Constants.expoConfig?.extra?.PREMIUMIZE_CLIENT_SECRET || "";

const ACCESS_TOKEN_KEY = "premiumize_access_token";
const REFRESH_TOKEN_KEY = "premiumize_refresh_token";

export async function getStoredAccessToken() {
  return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getStoredRefreshToken() {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function authenticatePremiumize(): Promise<string> {
  try {
    console.log("Expo Config Extra:", Constants.expoConfig?.extra);
    if (!PREMIUMIZE_CLIENT_ID || !PREMIUMIZE_CLIENT_SECRET) {
      throw new Error("Missing PREMIUMIZE_CLIENT_ID or PREMIUMIZE_CLIENT_SECRET in expoConfig.extra");
    }

    const existingToken = await getStoredAccessToken();
    if (existingToken) {
      const isValid = await verifyToken(existingToken);
      if (isValid) return existingToken;
    }

    const refreshToken = await getStoredRefreshToken();
    if (refreshToken) {
      try {
        const newToken = await refreshAccessToken(refreshToken);
        if (newToken) return newToken;
      } catch (e) {
        console.log("Failed to refresh token, proceeding to device code auth:", e);
      }
    }

    // FIRST FIX: Step 1 - Request device code with correct parameters
    console.log("Requesting device code with client_id:", PREMIUMIZE_CLIENT_ID);
    const deviceCodeResponse = await axios.post(
      PREMIUMIZE_TOKEN_URL,
      qs.stringify({
        client_id: PREMIUMIZE_CLIENT_ID,
        response_type: "device_code" // CHANGED: Use response_type instead of grant_type here
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("Full Device Code Response:", deviceCodeResponse.data);

    const {
      device_code,
      user_code,
      verification_uri,
      expires_in,
      interval,
    } = deviceCodeResponse.data;

    if (!device_code || !user_code || !verification_uri) {
      throw new Error("Invalid device code response: missing required fields");
    }

    // Step 2: Instruct user to authenticate
    console.log(`Please visit ${verification_uri} and enter code: ${user_code}`);
    await Linking.openURL(verification_uri);
    alert(`Please visit ${verification_uri} and enter this code: ${user_code}`);

    // SECOND FIX: Step 3 - Poll for access token with correct parameters
    const startTime = Date.now();
    const expiresAt = startTime + (expires_in * 1000);

    while (Date.now() < expiresAt) {
      try {
        const tokenResponse = await axios.post(
          PREMIUMIZE_TOKEN_URL,
          qs.stringify({
            client_id: PREMIUMIZE_CLIENT_ID,
            client_secret: PREMIUMIZE_CLIENT_SECRET,
            device_code: device_code,
            grant_type: "device_code" // CHANGED: Use simple "device_code" not the long URN
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        const { access_token, refresh_token } = tokenResponse.data;
        console.log("Tokens received:", { access_token, refresh_token });

        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token);
        if (refresh_token) {
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh_token);
        }

        return access_token;
      } catch (err: any) {
        const error = err.response?.data?.error;
        if (error === "authorization_pending") {
          console.log("Authorization pending, waiting...");
          await new Promise((resolve) => setTimeout(resolve, (interval || 5) * 1000));
          continue;
        } else if (error === "slow_down") {
          console.log("Polling too fast, increasing wait...");
          await new Promise((resolve) => setTimeout(resolve, ((interval || 5) + 2) * 1000));
          continue;
        } else if (error === "access_denied") {
          throw new Error("User denied access");
        }
        throw err;
      }
    }

    throw new Error("Device authentication timed out");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Premiumize authentication error:", error.message);
    } else if (error && typeof error === 'object' && 'response' in error) {
      const err = error as { response?: { data?: unknown } };
      console.error("Premiumize authentication error:", err.response?.data || 'Unknown error');
    } else {
      console.error("Premiumize authentication error:", 'Unknown error');
    }
    throw error;
  }
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const response = await axios.get(`${PREMIUMIZE_API_BASE}/account/info`, {
      params: { access_token: token },
    });
    return response.data.status === "success";
  } catch (e) {
    return false;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await axios.post(
    PREMIUMIZE_TOKEN_URL,
    qs.stringify({
      client_id: PREMIUMIZE_CLIENT_ID,
      client_secret: PREMIUMIZE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, refresh_token } = response.data;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token);
  if (refresh_token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh_token);
  }
  return access_token;
}

export async function getPremiumizeMediaUrl(
  traktId: number,
  type: "movie" | "show",
  episode?: { season: number; episode: number }
): Promise<string> {
  try {
    const accessToken = await authenticatePremiumize();

    const queryString =
      type === "movie"
        ? `trakt:movie:${traktId}`
        : `trakt:show:${traktId}:S${episode?.season.toString().padStart(2, "0")}E${episode?.episode
            .toString()
            .padStart(2, "0")}`;

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

    const videoFile = files.find((file: any) =>
      file.path.endsWith(".mp4") || file.path.endsWith(".mkv") || file.path.endsWith(".avi")
    );

    if (!videoFile) throw new Error("No playable video file found");

    return videoFile.link;
  } catch (err: any) {
    console.error("Premiumize Error:", err.response?.data || err.message);
    throw err;
  }
}