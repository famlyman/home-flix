import React, { useState, useEffect } from "react";
import { Route } from 'expo-router';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { fetchItemDetails } from "../../../services/tmdb-trakt"; // You'll need to implement this
import Constants from "expo-constants";


export default function ItemDetailsScreen() {
  const { id, type, title } = useLocalSearchParams<{ 
    id: string; 
    type: 'movie' | 'show'; 
    title: string; 
  }>() as { id: string; type: 'movie' | 'show'; title: string; };

  interface ItemDetails {
    id: number;
    title: string;
    posterUrl: string | null;
    overview: string;
    year: string;
    genres: string[];
    rating: number;
    seasons?: number;
  }
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusBarHeight = Constants.statusBarHeight;

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        // Convert id to number
        const numericId = parseInt(id, 10);

        // Fetch detailed information about the item
        const details = await fetchItemDetails(numericId, type);
        setItemDetails(details);
      } catch (err: any) {
        console.error("Error fetching item details:", err);
        setError(err.message || "Failed to fetch item details");
      } finally {
        setLoading(false);
      }
    };

    if (id && type) {
      fetchDetails();
    }
  }, [id, type]);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (error) {
    return <Text style={styles.errorText}>Error: {error}</Text>;
  }

  if (!itemDetails) {
    return <Text style={styles.errorText}>No details available for {title}</Text>;
  }

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.headerContainer}>
        {itemDetails.posterUrl && (
          <Image
            source={{ uri: itemDetails.posterUrl }}
            style={styles.posterImage}
          />
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {itemDetails.year && (
            <Text style={styles.subtitle}>({itemDetails.year})</Text>
          )}
        </View>
      </View>
  
      <View style={styles.detailsContainer}>
        {itemDetails.overview && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.overview}>{itemDetails.overview}</Text>
          </View>
        )}
  
        <View style={styles.infoContainer}>
          {itemDetails.genres && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Genres:</Text>
              <Text style={styles.infoText}>
                {itemDetails.genres.join(", ")}
              </Text>
            </View>
          )}
  
          {itemDetails.rating && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Rating:</Text>
              <Text style={styles.infoText}>
                {itemDetails.rating.toFixed(1)}/10
              </Text>
            </View>
          )}
  
          {type === "show" && itemDetails.seasons && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Seasons:</Text>
              <Text style={styles.infoText}>{itemDetails.seasons}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background
  },
  headerContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#1E1E1E", // Slightly lighter dark color
    alignItems: "center",
  },
  posterImage: {
    width: 120,
    height: 180,
    borderRadius: 10,
    marginRight: 15,
  },
  titleContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#FFFFFF", // Light text
  },
  subtitle: {
    fontSize: 16,
    color: "#A9A9A9", // Grayish text
  },
  detailsContainer: {
    padding: 15,
  },
  sectionContainer: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#FFFFFF", // Light text
  },
  overview: {
    fontSize: 14,
    lineHeight: 22,
    color: "#E0E0E0", // Light text
  },
  infoContainer: {
    backgroundColor: "#1E1E1E", // Slightly lighter dark color
    borderRadius: 10,
    padding: 15,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  infoLabel: {
    fontWeight: "bold",
    marginRight: 10,
    width: 100,
    color: "#FFFFFF", // Light text
  },
  infoText: {
    flex: 1,
    color: "#E0E0E0", // Light text
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginTop: 20,
  },
});