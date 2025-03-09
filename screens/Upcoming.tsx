import React, { useEffect, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { Pressable, Dimensions, Image, ActivityIndicator, View, Text } from 'react-native';
import { image500, getUpcomingMovies } from '@/services/tmdbapi';
import { router } from 'expo-router';  // Import router from expo-router

const { width, height } = Dimensions.get("window");

interface Movie {
  id: number;
  poster_path: string;
  title: string;
}

export const Upcoming = () => {
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
    // Use expo-router's router.push instead of navigation.navigate
    router.push(`/${id}`);
  };

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{marginTop: 10}}>Loading movies...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
        <Text style={{fontSize: 16, textAlign: 'center'}}>{error}</Text>
      </View>
    );
  }

  return (
    <View>
      <FlashList
        data={upcomingMovies}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleMoviePress(item.id)}
            style={{padding: 8}}
          >
            <Image
              source={{ uri: image500(item.poster_path) || "" }}
              style={{ width: width / 2 - 16, height: height / 3, borderRadius: 10 }}
              resizeMode="cover"
            />
            <Text style={{marginTop: 6, textAlign: 'center'}}>{item.title}</Text>
          </Pressable>
        )}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        estimatedItemSize={height / 3 + 40}
      />
    </View>
  );
};

export default Upcoming;