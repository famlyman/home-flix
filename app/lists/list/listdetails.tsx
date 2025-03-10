import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert, // Add this
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getListItemsWithImages } from "../../../services/tmdb-trakt";
import { addToTraktList, removeFromTraktList } from "../../../services/traktapi";
import * as SecureStore from "expo-secure-store";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";


interface ListItem {
  id: number;
  title: string;
  posterUrl: string | null;
  type: "movie" | "show";
  overview?: string;
}

const ListItemComponent = React.memo(({ item, onPress, onHeartPress, isInList }: { 
  item: ListItem, 
  onPress: () => void, 
  onHeartPress: () => void, 
  isInList: boolean 
}) => (
  <View style={styles.itemContainer}>
    <Pressable onPress={onPress} style={styles.itemContent}>
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
    </Pressable>
    <Pressable onPress={onHeartPress}>
      <Icon name="cards-heart" size={24} strokeWidth={2} color={isInList ? 'red' : '#A0A0A0'} />
    </Pressable>
  </View>
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
  const [page, setPage] = useState(0);
  const [itemStatus, setItemStatus] = useState<{ [key: number]: boolean }>({});

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchListItems = async () => {
      try {
        setLoading(true);
        const username = await SecureStore.getItemAsync('trakt_username');
        if (!username) throw new Error('No username found');

        const numericListId = parseInt(listId || '0', 10);
        const listItems = await getListItemsWithImages(username, numericListId);
        setAllItems(listItems);

        const initialStatus = listItems.reduce((acc, item) => {
          acc[item.id] = true;
          return acc;
        }, {} as { [key: number]: boolean });
        setItemStatus(initialStatus);

        const initialItems = listItems.slice(0, ITEMS_PER_PAGE);
        setDisplayedItems(initialItems);
        setPage(1);
      } catch (err: any) {
        console.error('Error fetching list items:', err);
        setError(err.message || 'Failed to fetch list items');
      } finally {
        setLoading(false);
      }
    };

    if (listId) fetchListItems();
  }, [listId]);

  const loadMoreItems = () => {
    if (loadingMore || displayedItems.length >= allItems.length) return;

    setLoadingMore(true);
    const startIndex = displayedItems.length;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allItems.length);

    if (startIndex < allItems.length) {
      const newItems = allItems.slice(startIndex, endIndex);
      setDisplayedItems(prevItems => [...prevItems, ...newItems]);
      setPage(prevPage => prevPage + 1);
      setTimeout(() => setLoadingMore(false), 100);
    } else {
      setLoadingMore(false);
    }
  };

  const handleHeartPress = (item: ListItem) => {
    const isInList = itemStatus[item.id];
    if (isInList) {
      Alert.alert(
        "Remove Item",
        `Are you sure you want to remove "${item.title}" from "${listName}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeFromTraktList(listId, item.id, item.type);
                setItemStatus(prev => ({ ...prev, [item.id]: false }));
                setDisplayedItems(prev => prev.filter(i => i.id !== item.id));
                setAllItems(prev => prev.filter(i => i.id !== item.id));
              } catch (err) {
                console.error("Error removing item:", err);
                setError("Failed to remove item");
              }
            },
          },
        ]
      );
    } else {
      // No confirmation needed for adding
      addToTraktList(listId, item.id, item.type)
        .then(() => {
            setItemStatus(prev => ({ ...prev, [item.id]: true }));
            setDisplayedItems(prev => [...prev, item]);
            setAllItems(prev => [...prev, item]);
          })
        .catch(err => {
          console.error("Error adding item:", err);
          setError("Failed to add item");
        });
    }
  };

  const hasMoreItems = allItems.length > displayedItems.length;

  const renderItem = ({ item }: { item: ListItem }) => (
    <ListItemComponent
      item={item}
      onPress={() =>
        router.push(
          `/lists/items/itemdetails?id=${item.id}&type=${item.type}&title=${encodeURIComponent(item.title)}&listId=${listId}`
        )
      }
      onHeartPress={() => handleHeartPress(item)}
      isInList={itemStatus[item.id] ?? false}
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
      <FlashList
        estimatedItemSize={200}
        data={displayedItems}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}-${item.type}`}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={renderFooter}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasMoreItems) loadMoreItems();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
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
    color: "#FFFFFF",
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemContent: {
    flexDirection: "row",
    flex: 1,
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
    color: "#FFFFFF",
  },
  itemType: {
    fontSize: 14,
    color: "#A0A0A0",
    marginBottom: 5,
  },
  itemOverview: {
    fontSize: 12,
    color: "#D3D3D3",
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
