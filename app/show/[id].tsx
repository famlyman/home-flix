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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getShowDetails, image500 } from '@/services/tmdbapi';
import Constants from 'expo-constants';
import MyLists from '@/components/listModal';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Define the TV series details interface
interface TvDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  first_air_date: string;
  vote_average: number;
  episode_run_time: number[];
  genres: Array<{ id: number; name: string }>;
  number_of_seasons: number;
  number_of_episodes: number;
}

export default function TvDetailsScreen() {
  // All hooks at the top
  const { id } = useLocalSearchParams();
  const seriesId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;
  const router = useRouter();
  const [series, setSeries] = useState<TvDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false); // Moved up here
  const statusBarHeight = Constants.statusBarHeight;

  useEffect(() => {
    if (!seriesId) {
      setError('Invalid series ID');
      setLoading(false);
      return;
    }

    const fetchTvDetails = async () => {
      try {
        setLoading(true);
        const data = await getShowDetails(seriesId);
        setSeries(data);
      } catch (err) {
        console.error('Error fetching TV series details:', err);
        setError('Failed to load TV series details');
      } finally {
        setLoading(false);
      }
    };

    fetchTvDetails();
  }, [seriesId]);

  const openModal = () => setIsModalVisible(true);
  const closeModal = () => setIsModalVisible(false);
  const handleAddToList = () => openModal();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading series details...</Text>
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

  if (!series) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No series details found</Text>
      </View>
    );
  }

  // Get average episode runtime
  const avgRuntime =
    series.episode_run_time && series.episode_run_time.length > 0
      ? Math.floor(series.episode_run_time.reduce((a, b) => a + b, 0) / series.episode_run_time.length)
      : 0;

  return (
    <ScrollView style={[styles.container, { paddingTop: statusBarHeight }]}>
      {/* Backdrop Image */}
      {series.backdrop_path && (
        <Image
          source={{ uri: image500(series.backdrop_path) || '' }}
          style={styles.backdropImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.backIconContainer}>
        <Pressable style={styles.backIcon} onPress={() => router.back()}>
          <Icon name="arrow-left"size={30} strokeWidth={2} color="white" />
        </Pressable>
        <Pressable onPress={handleAddToList}>
          <Icon name="cards-heart" size={30} strokeWidth={2} color="white" />
        </Pressable>
      </View>

      <View style={styles.contentContainer}>
        {/* Series Poster and Basic Info */}
        <View style={styles.headerContainer}>
          {series.poster_path && (
            <Image
              source={{ uri: image500(series.poster_path) || '' }}
              style={styles.posterImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.infoContainer}>
            <Text style={styles.title}>{series.name}</Text>
            {series.first_air_date && (
              <Text style={styles.releaseDate}>
                First Aired: {new Date(series.first_air_date).toLocaleDateString()}
              </Text>
            )}
            {series.vote_average > 0 && (
              <Text style={styles.rating}>
                Rating: {series.vote_average.toFixed(1)}/10
              </Text>
            )}
            {avgRuntime > 0 && (
              <Text style={styles.runtime}>
                Avg. Episode: {avgRuntime} min
              </Text>
            )}
            <Text style={styles.seasons}>
              Seasons: {series.number_of_seasons} | Episodes: {series.number_of_episodes}
            </Text>
            {series.genres && series.genres.length > 0 && (
              <Text style={styles.genres}>
                Genres: {series.genres.map(g => g.name).join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* Overview */}
        <View style={styles.overviewContainer}>
          <Text style={styles.overviewTitle}>Overview</Text>
          <Text style={styles.overview}>{series.overview}</Text>
        </View>
      </View>
      <MyLists visible={isModalVisible} onClose={closeModal} itemId={seriesId} type="show" />
    </ScrollView>
  );
}

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
  backIconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backIcon: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 50,
    padding: 5,
    margin: 5,
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
  seasons: {
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