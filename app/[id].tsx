import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getMovieDetails, image500 } from '@/services/tmdbapi';
import Constants from 'expo-constants';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons'; 
import MyLists from '@/components/listModal';
import { checkItemInLists, removeFromTraktList } from '@/services/traktapi';

const { width, height } = Dimensions.get('window');

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

export default function MovieDetailsScreen() {
  const { id } = useLocalSearchParams();
  const movieId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;
  const router = useRouter();
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isInList, setIsInList] = useState(false); // New state
  const [listIds, setListIds] = useState<string[]>([]); // Track lists with the movie
  const statusBarHeight = Constants.statusBarHeight;

  useEffect(() => {
    const fetchMovieAndListStatus = async () => {
      try {
        setLoading(true);
        const movieData = await getMovieDetails(movieId);
        setMovie(movieData);

        const { isInAnyList, listIds } = await checkItemInLists(movieId, 'movie');
        setIsInList(isInAnyList);
        setListIds(listIds);
      } catch (err) {
        console.error('Error fetching movie or list status:', err);
        setError('Failed to load movie or list status');
      } finally {
        setLoading(false);
      }
    };
    if (movieId) fetchMovieAndListStatus();
  }, [movieId]);

  const openModal = () => setIsModalVisible(true);
  const closeModal = () => {
    setIsModalVisible(false);
    // Refresh list status after adding
    checkItemInLists(movieId, 'movie')
      .then(({ isInAnyList, listIds }) => {
        setIsInList(isInAnyList);
        setListIds(listIds);
      })
      .catch(err => console.error("Error refreshing list status:", err));
  };

  const handleHeartPress = async () => {
    if (isInList) {
      Alert.alert(
        "Remove Movie",
        `Are you sure you want to remove "${movie?.title}" from all lists?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await Promise.all(listIds.map(listId => removeFromTraktList(listId, movieId, 'movie')));
                setIsInList(false);
                setListIds([]);
              } catch (err) {
                console.error("Error removing movie:", err);
                setError('Failed to remove movie');
              }
            },
          },
        ]
      );
    } else {
      openModal();
    }
  };

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
    <ScrollView style={[styles.container, { paddingTop: statusBarHeight }]}>
      {movie.backdrop_path && (
        <Image
          source={{ uri: image500(movie.backdrop_path) || '' }}
          style={styles.backdropImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.backIconContainer}>
        <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
          <Icon name="arrow-left" size={30} strokeWidth={2} color="white" />
        </TouchableOpacity>
        <Pressable onPress={handleHeartPress}>
          <Icon name="cards-heart" size={30} strokeWidth={2} color={isInList ? 'red' : 'white'} />
        </Pressable>
      </View>

      <View style={styles.contentContainer}>
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
                Runtime: {movie.runtime} min
              </Text>
            )}
            {movie.genres && movie.genres.length > 0 && (
              <Text style={styles.genres}>
                Genres: {movie.genres.map(g => g.name).join(', ')}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.overviewContainer}>
          <Text style={styles.overviewTitle}>Overview</Text>
          <Text style={styles.overview}>{movie.overview}</Text>
        </View>
      </View>
      <MyLists visible={isModalVisible} onClose={closeModal} itemId={movieId} type="movie" />
    </ScrollView>
  );
}

// Styles remain unchanged
const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, textAlign: 'center' },
  backdropImage: { width, height: height * 0.3 },
  backIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backIcon: { backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 50, padding: 5, margin: 5 },
  contentContainer: { padding: 16 },
  headerContainer: { flexDirection: 'row', marginBottom: 20 },
  posterImage: { width: width * 0.3, height: height * 0.2, borderRadius: 10 },
  infoContainer: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  releaseDate: { fontSize: 14, marginBottom: 4 },
  rating: { fontSize: 14, marginBottom: 4 },
  runtime: { fontSize: 14, marginBottom: 4 },
  genres: { fontSize: 14, marginBottom: 4 },
  overviewContainer: { marginTop: 16 },
  overviewTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  overview: { fontSize: 14, lineHeight: 22 },
});