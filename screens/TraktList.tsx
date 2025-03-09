import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Card, Title, Provider as PaperProvider, MD3DarkTheme } from "react-native-paper";
import { fetchTraktLists, getAccessToken } from "../services/traktapi";
import { getListItemsWithImages } from "../services/tmdb-trakt";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { Colors } from "react-native/Libraries/NewAppScreen";

interface TraktList {
  name: string;
  ids: {
    slug: string;
    trakt: number;
  };
}

interface ItemDetails {
  id: number;
  title: string;
  posterUrl: string | null;
  type: "movie" | "show";
}

interface TraktListsProps {
  isAuthenticated: boolean;
}

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...Colors.dark,
  },
};

const TraktLists = ({ isAuthenticated }: TraktListsProps) => {
  const [lists, setLists] = useState<(TraktList & { items?: ItemDetails[] })[]>(
    []
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isAuthenticated) {
        setError("Please log in to see your Trakt lists");
        setLoading(false);
        return;
      }

      const storedUsername = await SecureStore.getItemAsync("trakt_username");
      if (!storedUsername) {
        setError("No username found. Please log in again.");
        setLoading(false);
        return;
      }
      setUsername(storedUsername);

      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const data = await fetchTraktLists();
      const enhancedLists = await Promise.all(
        data.map(async (list: TraktList) => {
          const items = await getListItemsWithImages(
            storedUsername,
            list.ids.trakt,
          ); // Limit to 5 items
          return { ...list, items };
        })
      );
      setLists(enhancedLists);
    } catch (err: any) {
      console.error("Error fetching lists:", err);
      setError(err.message || "Failed to fetch lists");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleListPress = (list: TraktList) => {
    // Example: Show list details or navigate to list details screen
    router.push({
      pathname: "/lists/list/listdetails",
      params: {
        listId: list.ids.trakt.toString(),
        listName: list.name,
      },
    });
  };

  const handleItemPress = (item: ItemDetails) => {
    router.push({
      pathname: "/lists/items/itemdetails",
      params: {
        id: item.id.toString(),
        type: item.type,
        title: item.title,
      },
    });
  };

  const renderItem = ({
    item,
  }: {
    item: TraktList & { items?: ItemDetails[] };
  }) => (
    <TouchableOpacity onPress={() => handleListPress(item)}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>{item.name}</Title>
          {item.items && (
            <FlatList
              data={item.items}
              horizontal
              keyExtractor={(subItem, index) => `${subItem.id}-${subItem.type}-${index}`}
              renderItem={({ item: subItem }) => (
                <View style={styles.itemContainer}>
                  {subItem.posterUrl && (
                    <Image
                      source={{ uri: subItem.posterUrl }}
                      style={styles.itemImage}
                    />
                  )}
                  <Text style={styles.itemTitle}>{subItem.title}</Text>
                </View>
              )}
            />
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (error) {
    return <Text style={styles.errorText}>Error: {error}</Text>;
  }

  if (lists.length === 0) {
    return <Text>No lists found.</Text>;
  }

  return (
    <PaperProvider theme={theme}>
      <FlatList
        data={lists}
        renderItem={renderItem}
        keyExtractor={(item) => item.ids.slug}
        contentContainerStyle={styles.listContent}
      />
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 10,
    backgroundColor: Colors.dark.background,
  },
  card: {
    marginVertical: 5,
    width: "95%",
    alignSelf: "center",
    borderRadius: 10,
    elevation: 3,
  },
  itemContainer: {
    alignItems: "center",
    marginRight: 10,
  },
  itemImage: {
    width: 60,
    height: 90,
    borderRadius: 4,
  },
  itemTitle: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    color: "white",
  },
  errorText: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
  },
});

export default TraktLists;