import React, { useEffect, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { Pressable, Dimensions, Image, View } from 'react-native';
import { image500, getUpcomingMovies } from '@/services/tmdbapi';
import { router } from 'expo-router';
import { useTheme, Text, ActivityIndicator, Surface } from 'react-native-paper';

const { width, height } = Dimensions.get("window");

interface Movie {
  id: number;
  poster_path: string;
  title: string;
}

export const Upcoming = () => {
  const theme = useTheme(); // Access the theme
  const [upcomingMovies, setUpcomingMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getUpcomingMovies();
        setUpcomingMovies(data.results);
      } catch (error) {
        console.error('Error fetching upcoming movies:', error);
        setError('Failed to load movies');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const handleMoviePress = (id: number) => {
    router.push(`/${id}`);
  };

  if (loading) {
    return (
      <View style={{
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: theme.colors.background
      }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{
          marginTop: 10,
          color: theme.colors.onBackground
        }}>Loading movies...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 20,
        backgroundColor: theme.colors.background
      }}>
        <Text style={{
          fontSize: 16, 
          textAlign: 'center',
          color: theme.colors.error
        }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <FlashList
        data={upcomingMovies}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleMoviePress(item.id)}
            style={{ padding: 8 }}
          >
            <Surface
              style={{
                elevation: 1,
                borderRadius: 10,
                overflow: 'hidden'
              }}
            >
              <Image
                source={{ uri: image500(item.poster_path) || "" }}
                style={{ width: width / 2 - 16, height: height / 3, borderRadius: 10 }}
                resizeMode="cover"
              />
              <View style={{ padding: 8, backgroundColor: theme.colors.surfaceVariant }}>
                <Text
                  numberOfLines={2}
                  style={{
                    textAlign: 'center',
                    color: theme.colors.onSurfaceVariant,
                    fontWeight: '500'
                  }}
                >
                  {item.title}
                </Text>
              </View>
            </Surface>
          </Pressable>
        )}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        estimatedItemSize={height / 3 + 56}
      />
    </View>
  );
};

export default Upcoming;