import { traktApi } from '@/services/traktapi';
import { tmdbApi, image500 } from '@/services/tmdbapi';

// Define types
interface TraktItem {
  type: 'movie' | 'show';
  movie?: {
    title: string;
    ids: {
      tmdb?: number;
    };
  };
  show?: {
    title: string;
    ids: {
      tmdb?: number;
    };
  };
}


// Image utility for backdrops
const imageBackdrop = (backdropPath: string | null) =>
  backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : null;

// Get list items with TMDB data
export async function getListItemsWithImages(username: string, listId: string | number) {
  try {
    // Get items from Trakt list
    const response = await traktApi.get(`/users/${username}/lists/${listId}/items`);

    if (!response?.data || !Array.isArray(response.data)) {
      return [];
    }

    // Enhance each item with TMDB data
    const enhancedItems = await Promise.all(
      response.data.map(async (item: TraktItem) => {
        try {
          const itemType = item.type;
          const tmdbId = itemType === 'movie'
            ? item.movie?.ids.tmdb
            : item.show?.ids.tmdb;
          const title = itemType === 'movie'
            ? item.movie?.title
            : item.show?.title;

          if (!tmdbId) {
            return {
              id: 0,
              title: title || 'Unknown Title',
              posterUrl: null,
              backdropUrl: null,
              overview: '',
              year: '',
              type: itemType,
            };
          }

          // Get details from TMDB using the axios instance (relies on Authorization header)
          const tmdbResponse = await tmdbApi.get(`/${itemType === 'movie' ? 'movie' : 'tv'}/${tmdbId}`);

          if (!tmdbResponse?.data) {
            throw new Error('No data returned from TMDB');
          }

          const data = tmdbResponse.data;

          return {
            id: tmdbId,
            title: itemType === 'movie' ? data.title : data.name,
            posterUrl: image500(data.poster_path),
            backdropUrl: imageBackdrop(data.backdrop_path),
            overview: data.overview || '',
            year: itemType === 'movie'
              ? (data.release_date ? data.release_date.substring(0, 4) : '')
              : (data.first_air_date ? data.first_air_date.substring(0, 4) : ''),
            type: itemType,
          };
        } catch (error) {
          console.error(`Error getting TMDB data for item:`, error);
          return {
            id: 0,
            title: item.type === 'movie' ? item.movie?.title || 'Unknown' : item.show?.title || 'Unknown',
            posterUrl: null,
            backdropUrl: null,
            overview: '',
            year: '',
            type: item.type,
          };
        }
      })
    );

    return enhancedItems.filter(item => item !== null);
  } catch (error) {
    console.error('Error fetching list items:', error);
    throw error;
  }
}

export async function fetchItemDetails(id: number, type: 'movie' | 'show') {
  try {
    const endpointType = type === 'movie' ? 'movie' : 'tv'; // Map 'show' to 'tv'
    const response = await tmdbApi.get(`/${endpointType}/${id}`);
    const data = response.data;

    return {
      id: data.id,
      title: data.title || data.name,
      posterUrl: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
      overview: data.overview,
      year: (data.release_date || data.first_air_date)?.split('-')[0] || '',
      genres: data.genres?.map((genre: any) => genre.name) || [],
      rating: data.vote_average,
      seasons: type === 'show' ? data.number_of_seasons : undefined
    };
  } catch (error) {
    console.error('Error fetching item details:', error);
    throw error;
  }
}

// Get a representative image for a list
export async function getListCoverImage(username: string, listId: string | number) {
  try {
    const items = await getListItemsWithImages(username, listId);
    return items.length > 0 ? items[0].posterUrl : null;
  } catch (error) {
    console.error('Error getting list cover image:', error);
    return null;
  }
}