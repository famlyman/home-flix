import React, { useEffect, useState } from 'react';
import { 
  ScrollView, 
  View,
  Text,
  Image, 
  StyleSheet, 
  Dimensions, 
  ActivityIndicator 
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getMovieDetails, image500 } from '@/services/tmdbapi';

const { width, height } = Dimensions.get('window');

// Define the route params type
type MovieDetailsRouteParams = {
  id: number;
};

type MovieDetailsRouteProp = RouteProp<
  { MovieDetails: MovieDetailsRouteParams },
  'MovieDetails'
>;

// Define the movie details interface
interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  vote_average: number;
  runtime: number;
  genres: Array<{ id: number; name: string }>;
}

export const MovieDetails = () => {
  const route = useRoute<MovieDetailsRouteProp>();
  const { id } = route.params;
  
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);
        const data = await getMovieDetails(id);
        setMovie(data);
      } catch (err) {
        console.error('Error fetching movie details:', err);
        setError('Failed to load movie details');
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading movie details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!movie) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No movie details found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Backdrop Image */}
      {movie.backdrop_path && (
        <Image
          source={{ uri: image500(movie.backdrop_path) || '' }}
          style={styles.backdropImage}
          resizeMode="cover"
        />
      )}
      
      <View style={styles.contentContainer}>
        {/* Movie Poster and Basic Info */}
        <View style={styles.headerContainer}>
          {movie.poster_path && (
            <Image
              source={{ uri: image500(movie.poster_path) || '' }}
              style={styles.posterImage}
              resizeMode="cover"
            />
          )}
          
          <View style={styles.infoContainer}>
            <Text style={styles.title}>{movie.title}</Text>
            
            {movie.release_date && (
              <Text style={styles.releaseDate}>
                Released: {new Date(movie.release_date).toLocaleDateString()}
              </Text>
            )}
            
            {movie.vote_average > 0 && (
              <Text style={styles.rating}>
                Rating: {movie.vote_average.toFixed(1)}/10
              </Text>
            )}
            
            {movie.runtime > 0 && (
              <Text style={styles.runtime}>
                Runtime: {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
              </Text>
            )}
            
            {movie.genres && movie.genres.length > 0 && (
              <Text style={styles.genres}>
                Genres: {movie.genres.map(g => g.name).join(', ')}
              </Text>
            )}
          </View>
        </View>
        
        {/* Overview */}
        <View style={styles.overviewContainer}>
          <Text style={styles.overviewTitle}>Overview</Text>
          <Text style={styles.overview}>{movie.overview}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  backdropImage: {
    width: width,
    height: height * 0.3,
  },
  contentContainer: {
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  posterImage: {
    width: width * 0.3,
    height: height * 0.2,
    borderRadius: 10,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  releaseDate: {
    fontSize: 14,
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    marginBottom: 4,
  },
  runtime: {
    fontSize: 14,
    marginBottom: 4,
  },
  genres: {
    fontSize: 14,
    marginBottom: 4,
  },
  overviewContainer: {
    marginTop: 16,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  overview: {
    fontSize: 14,
    lineHeight: 22,
  },
});

export default MovieDetails;