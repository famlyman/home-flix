import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

const TRAKT_API_URL = "https://api.trakt.tv";
const CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET;

if (!CLIENT_ID) {
  throw new Error("Missing TRAKT_CLIENT_ID environment variable");
}

// Create a new axios instance for Trakt API
export const traktApi = axios.create({
  baseURL: TRAKT_API_URL,
  headers: {
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": CLIENT_ID,
  },
});

// Add request interceptor to add auth token
traktApi.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle auth errors
traktApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        const refreshToken = await SecureStore.getItemAsync(
          "trakt_refresh_token"
        );
        if (refreshToken) {
          const tokenResponse = await axios.post(
            `${TRAKT_API_URL}/oauth/token`,
            {
              refresh_token: refreshToken,
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
              grant_type: "refresh_token",
            }
          );
          const { access_token, refresh_token } = tokenResponse.data;
          await Promise.all([
            SecureStore.setItemAsync("trakt_access_token", access_token),
            SecureStore.setItemAsync("trakt_refresh_token", refresh_token),
          ]);
          error.config.headers.Authorization = `Bearer ${access_token}`;
          return traktApi(error.config);
        } else {
          await logout();
          router.replace("/");
          return Promise.reject(new Error("No refresh token available"));
        }
      } catch (refreshError) {
        await logout();
        router.replace("/");
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Authentication functions
export async function getAccessToken() {
  try {
    return await SecureStore.getItemAsync("trakt_access_token");
  } catch (error) {
    return null;
  }
}

export async function loginWithTrakt(
  onShowCode: (url: string, code: string) => void
) {
  try {
    const deviceCodeResponse = await axios.post(
      `${TRAKT_API_URL}/oauth/device/code`,
      {
        client_id: CLIENT_ID,
      }
    );

    const { device_code, user_code, verification_url, expires_in, interval } =
      deviceCodeResponse.data;
    onShowCode(verification_url, user_code);

    let totalWait = 0;
    while (totalWait < expires_in) {
      try {
        const tokenResponse = await axios.post(
          `${TRAKT_API_URL}/oauth/device/token`,
          {
            code: device_code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
          }
        );

        const { access_token, refresh_token } = tokenResponse.data;

        // Store tokens
        await Promise.all([
          SecureStore.setItemAsync("trakt_access_token", access_token),
          SecureStore.setItemAsync("trakt_refresh_token", refresh_token),
        ]);

        // Fetch username from /users/me
        const userResponse = await traktApi.get("/users/me");
        const username = userResponse.data.username;
        await SecureStore.setItemAsync("trakt_username", username);

        return access_token;
      } catch (error: any) {
        if (error.response?.status === 400) {
          await new Promise((resolve) => setTimeout(resolve, interval * 1000));
          totalWait += interval;
        } else {
          throw error;
        }
      }
    }
    throw new Error("Authentication timed out");
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function logout() {
  try {
    const accessToken = await SecureStore.getItemAsync("trakt_access_token");
    if (accessToken) {
      try {
        await axios.post(`${TRAKT_API_URL}/oauth/revoke`, {
          token: accessToken,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        });
      } catch (error) {
        console.warn("Error revoking token:", error);
      }
    }

    await Promise.all([
      SecureStore.deleteItemAsync("trakt_access_token"),
      SecureStore.deleteItemAsync("trakt_refresh_token"),
      SecureStore.deleteItemAsync("trakt_username"),
    ]);

    return true;
  } catch (error) {
    console.error("Logout error:", error);
    throw new Error("Failed to logout");
  }
}

export async function isLoggedIn() {
  try {
    const token = await SecureStore.getItemAsync("trakt_access_token");
    return !!token;
  } catch (error) {
    return false;
  }
}

export async function fetchTraktLists() {
  try {
    const response = await traktApi.get("/users/me/lists");
    return response.data;
  } catch (error) {
    console.error("Error fetching Trakt lists:", error);
    throw error;
  }
}

export const getListItems = async (
  username: string,
  listId: number,
  limit: number = 5
) => {
  try {
    const response = await axios.get(
      `https://api.trakt.tv/users/${username}/lists/${listId}/items`,
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": "CLIENT_ID",
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        params: {
          limit: limit,
        },
      }
    );

    return response.data.map((item: any) => ({
      id: item[item.type].ids.trakt,
      title: item[item.type].title,
      type: item.type,
      images: {
        poster: item[item.type].images?.poster?.full, // Adjust based on actual Trakt API response
      },
    }));
  } catch (error) {
    console.error("Error fetching list items:", error);
    throw error;
  }
};

export async function addToTraktList(
  listId: string,
  itemId: number,
  type: "movie" | "show"
) {
  try {
    const payload: { movies?: any[]; shows?: any[] } = {};

    if (type === "movie") {
      payload.movies = [
        {
          ids: {
            tmdb: itemId, // TMDB ID for the movie
          },
        },
      ];
    } else if (type === "show") {
      payload.shows = [
        {
          ids: {
            tmdb: itemId, // TMDB ID for the show
          },
        },
      ];
    }

    const response = await traktApi.post(
      `/users/me/lists/${listId}/items`,
      payload
    );

    return response.data;
  } catch (error) {
    throw new Error("Failed to add item to Trakt list");
  }
}

export async function removeFromTraktList(
  listId: string,
  itemId: number,
  type: "movie" | "show"
) {
  try {
    const payload: { movies?: any[]; shows?: any[] } = {};

    if (type === "movie") {
      payload.movies = [
        {
          ids: {
            tmdb: itemId, // TMDB ID for the movie
          },
        },
      ];
    } else if (type === "show") {
      payload.shows = [
        {
          ids: {
            tmdb: itemId, // TMDB ID for the show
          },
        },
      ];
    }

    const response = await traktApi.post(
      `/users/me/lists/${listId}/items/remove`,
      payload
    );

    return response.data;
  } catch (error) {
    throw new Error("Failed to remove item to Trakt list");
  }
}