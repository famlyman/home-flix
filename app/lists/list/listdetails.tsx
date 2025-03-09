import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getListItemsWithImages } from "../../../services/tmdb-trakt";
import * as SecureStore from "expo-secure-store";

interface ListItem {
  id: number;
  title: string;
  posterUrl: string | null;
  type: "movie" | "show";
  overview?: string;
}

const ListItemComponent = React.memo(({ item, onPress }: { item: ListItem, onPress: () => void }) => (
  <Pressable onPress={onPress}>
    <View style={styles.itemContainer}>
      {item.posterUrl && (
        <Image source={{ uri: item.posterUrl }} style={styles.posterImage} />
      )}
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemType}>{item.type}</Text>
        {item.overview && (
          <Text style={styles.itemOverview} numberOfLines={3}>
            {item.overview}
          </Text>
        )}
      </View>
    </View>
  </Pressable>
));

export default function ListDetailsScreen() {
  const { listId, listName } = useLocalSearchParams<{
    listId: string;
    listName: string;
  }>();
  const router = useRouter();

  const [allItems, setAllItems] = useState<ListItem[]>([]);
  const [displayedItems, setDisplayedItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0); // Start at page 0 for proper calculation
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchListItems = async () => {
      try {
        setLoading(true);
        const username = await SecureStore.getItemAsync('trakt_username');
        if (!username) {
          throw new Error('No username found');
        }
  
        // Convert listId to number
        const numericListId = parseInt(listId || '0', 10);
  
        // Fetch all items from the list
        const listItems = await getListItemsWithImages(username, numericListId);
        setAllItems(listItems);
        
        // Set initial displayed items
        const initialItems = listItems.slice(0, ITEMS_PER_PAGE);
        setDisplayedItems(initialItems);
        setPage(1); // Set to page 1 after initial load
        
        
      } catch (err: any) {
        console.error('Error fetching list items:', err);
        setError(err.message || 'Failed to fetch list items');
      } finally {
        setLoading(false);
      }
    };
  
    if (listId) {
      fetchListItems();
    }
  }, [listId]);

  const loadMoreItems = () => {
    if (loadingMore || displayedItems.length >= allItems.length) return;
    
    
    setLoadingMore(true);
    
    // Calculate the next batch of items
    const startIndex = displayedItems.length;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allItems.length);
    
    if (startIndex < allItems.length) {
      const newItems = allItems.slice(startIndex, endIndex);
      
      setDisplayedItems(prevItems => [...prevItems, ...newItems]);
      setPage(prevPage => prevPage + 1);
      
      setTimeout(() => {
        setLoadingMore(false);
      }, 100);
    } else {
      setLoadingMore(false);
    }
  };

  // Move this inside your component body, not inside any function
const hasMoreItems = allItems.length > displayedItems.length;

  const renderItem = ({ item }: { item: ListItem }) => (
    <ListItemComponent
      item={item}
      onPress={() =>
        router.push(
          `/lists/items/itemdetails?id=${item.id}&type=${
            item.type
          }&title=${encodeURIComponent(item.title)}`
        )
      }
    />
  );

  const renderFooter = () => {
    if (!hasMoreItems) return null;

    return (
      <Pressable
        style={styles.loadMoreButton}
        onPress={loadMoreItems}
        disabled={loadingMore}
      >
        {loadingMore ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.loadMoreText}>Load More</Text>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>Error: {error}</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>{listName}</Text>
      <Text style={styles.itemCount}>
        Showing {displayedItems.length} of {allItems.length} items
      </Text>
      <FlatList
        data={displayedItems}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}-${item.type}`}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={renderFooter}
        onEndReachedThreshold={0.5}  // Increased threshold
        onEndReached={() => {
          
          if (hasMoreItems) {
            loadMoreItems();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "bold",
    padding: 15,
    textAlign: "center",
    color: "#FFFFFF", // Light text color
  },
  itemCount: {
    fontSize: 14,
    color: "#A0A0A0",
    textAlign: "center",
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: "row",
    marginBottom: 15,
    backgroundColor: "#1E1E1E", // Darker item background
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  posterImage: {
    width: 80,
    height: 120,
    borderRadius: 8,
    marginRight: 15,
  },
  itemDetails: {
    flex: 1,
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#FFFFFF", // Light text color
  },
  itemType: {
    fontSize: 14,
    color: "#A0A0A0", // Medium light text color
    marginBottom: 5,
  },
  itemOverview: {
    fontSize: 12,
    color: "#D3D3D3", // Light text color
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginTop: 20,
  },
  loadMoreButton: {
    backgroundColor: "#1E88E5",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginHorizontal: 20,
  },
  loadMoreText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
