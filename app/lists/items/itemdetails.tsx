import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { fetchItemDetails } from "../../../services/tmdb-trakt";
import Constants from "expo-constants";
import { checkItemInLists, addToTraktList, removeFromTraktList, scrobble } from "../../../services/traktapi";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import MyLists from "../../../components/listModal";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import { FlashList } from "@shopify/flash-list";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo"; // Added useEvent import
import { getPremiumizeMediaUrl } from "../../../services/premiumize";

const TMDB_API_KEY = Constants.expoConfig?.extra?.TMDB_API;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

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

interface Episode {
  episode_number: number;
  name: string;
  air_date?: string;
  overview?: string;
}

export default function ItemDetailsScreen() {
  const { id, type, title, listId } = useLocalSearchParams<{
    id: string;
    type: "movie" | "show";
    title: string;
    listId: string;
  }>();

  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isInList, setIsInList] = useState(false);
  const [seasons, setSeasons] = useState<{ season_number: number }[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const statusBarHeight = Constants.statusBarHeight;
  const numericId = parseInt(id, 10);

  // Create the player instance
const player = useVideoPlayer(mediaUrl || "");

// Track playing state
const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

// Track status changes
const playerStatus = useEvent(player, "statusChange", { status: player.status });

// Update progress based on current time and duration from player directly
useEffect(() => {
  if (player.duration > 0) {
    const progressPercent = (player.currentTime / player.duration) * 100;
    setProgress(progressPercent);
  }
}, [player.currentTime, player.duration]);

// Handle playback end using player status
React.useEffect(() => {
  // Check if video has finished (currentTime close to duration)
  if (player.duration > 0 && player.currentTime > 0 && 
      player.currentTime >= player.duration - 0.5) { // Within 0.5 seconds of the end
    scrobble("stop", type, numericId, progress, selectedEpisode ? 
      { season: selectedSeason!, episode: selectedEpisode.episode_number } : undefined);
  }
}, [player.currentTime, player.duration, type, numericId, progress, selectedSeason, selectedEpisode]);

// Scrobble on play/pause state changes
useEffect(() => {
  if (isPlaying) {
    console.log("Video started playing");
    scrobble("start", type, numericId, progress, selectedEpisode ? 
      { season: selectedSeason!, episode: selectedEpisode.episode_number } : undefined);
  } else if (player.duration > 0) { // Only scrobble pause if video has loaded
    console.log("Video paused");
    scrobble("pause", type, numericId, progress, selectedEpisode ? 
      { season: selectedSeason!, episode: selectedEpisode.episode_number } : undefined);
  }
}, [isPlaying, type, numericId, progress, selectedSeason, selectedEpisode, player.duration]);


  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const details = await fetchItemDetails(numericId, type);
        setItemDetails(details);

        if (listId) {
          const { listIds } = await checkItemInLists(numericId, type);
          setIsInList(listIds.includes(parseInt(listId)));
        }

        if (type === "show") {
          const response = await axios.get(
            `${TMDB_BASE_URL}/tv/${numericId}?api_key=${TMDB_API_KEY}`
          );
          setSeasons(response.data.seasons.filter((s: any) => s.season_number > 0));
          setSelectedSeason(response.data.seasons[0]?.season_number || 1);
        }
      } catch (err: any) {
        console.error("Fetch Error:", err.message);
        setError(err.message || "Failed to fetch item details");
      } finally {
        setLoading(false);
      }
    };

    if (id && type) fetchDetails();
  }, [id, type, listId]);

  useEffect(() => {
    if (type !== "show" || !selectedSeason) return;
    const fetchEpisodes = async () => {
      try {
        const response = await axios.get(
          `${TMDB_BASE_URL}/tv/${numericId}/season/${selectedSeason}?api_key=${TMDB_API_KEY}`
        );
        setEpisodes(response.data.episodes);
        setSelectedEpisode(null);
      } catch (err: any) {
        console.error("Error fetching episodes:", err);
        setError("Failed to fetch episodes");
      }
    };
    fetchEpisodes();
  }, [selectedSeason, type, numericId]);

  const openModal = () => setIsModalVisible(true);
  const closeModal = () => {
    setIsModalVisible(false);
    if (listId) {
      checkItemInLists(numericId, type)
        .then(({ listIds }) => setIsInList(listIds.includes(parseInt(listId))))
        .catch((err) => console.error("Error refreshing list status:", err));
    }
  };

  const handleHeartPress = () => {
    if (!listId) {
      setError("No list ID provided");
      return;
    }
    if (isInList) {
      Alert.alert(
        "Remove Item",
        `Are you sure you want to remove "${title}" from this list?`,
        [
          { text: "Cancel", style: "cancel" as const },
          {
            text: "Remove",
            style: "destructive" as const,
            onPress: async () => {
              try {
                await removeFromTraktList(listId, numericId, type);
                setIsInList(false);
              } catch (err: any) {
                console.error("Error removing item:", err);
                setError("Failed to remove item");
              }
            },
          },
        ],
        { cancelable: true }
      );
    } else {
      openModal();
    }
  };

  const handleEpisodePress = (episode: Episode) => {
    setSelectedEpisode(episode);
    console.log(`Selected ${episode.name}`);
  };

  const handlePlayPress = async () => {
    try {
      let url: string;
      if (type === "movie" && itemDetails) {
        url = await getPremiumizeMediaUrl(numericId, "movie");
        setMediaUrl(url);
        player.replace(url); // Replace source instead of setting initially
        player.play();
        console.log(`Playing ${itemDetails.title}`);
      } else if (type === "show" && selectedEpisode) {
        url = await getPremiumizeMediaUrl(numericId, "show", {
          season: selectedSeason!,
          episode: selectedEpisode.episode_number,
        });
        setMediaUrl(url);
        player.replace(url); // Replace source instead of setting initially
        player.play();
        console.log(`Playing ${selectedEpisode.name}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch media URL");
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.headerContainer}>
        {itemDetails?.posterUrl && (
          <Image source={{ uri: itemDetails.posterUrl }} style={styles.posterImage} />
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {itemDetails?.year && (
            <Text style={styles.subtitle}>({itemDetails.year})</Text>
          )}
          <View style={styles.buttonContainer}>
            {listId && (
              <Pressable onPress={handleHeartPress} style={styles.iconButton}>
                <Icon
                  name="cards-heart"
                  size={30}
                  color={isInList ? "red" : "#A0A0A0"}
                />
              </Pressable>
            )}
            {(type === "movie" || (type === "show" && selectedEpisode)) && (
              <Pressable style={styles.playButton} onPress={handlePlayPress}>
                <Icon name="play" size={24} color="#FFFFFF" />
                <Text style={styles.playButtonText}>Play</Text>
              </Pressable>
            )}
          </View>
          {(type === "movie" || (type === "show" && selectedEpisode)) && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress.toFixed(0)}% Watched</Text>
            </View>
          )}
        </View>
      </View>

      {mediaUrl && (
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
      )}

      {itemDetails?.overview && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.overview}>{itemDetails.overview}</Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        {itemDetails?.genres && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Genres:</Text>
            <Text style={styles.infoText}>{itemDetails.genres.join(", ")}</Text>
          </View>
        )}
        {itemDetails?.rating && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rating:</Text>
            <Text style={styles.infoText}>{itemDetails.rating.toFixed(1)}/10</Text>
          </View>
        )}
        {type === "show" && itemDetails?.seasons && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Seasons:</Text>
            <Text style={styles.infoText}>{itemDetails.seasons}</Text>
          </View>
        )}
      </View>

      {type === "show" && seasons.length > 0 && (
        <View style={styles.seasonContainer}>
          <Text style={styles.sectionTitle}>Episodes</Text>
          <Picker
            selectedValue={selectedSeason}
            onValueChange={(value) => setSelectedSeason(value)}
            style={styles.picker}
          >
            {seasons.map((season) => (
              <Picker.Item
                key={season.season_number}
                label={`Season ${season.season_number}`}
                value={season.season_number}
              />
            ))}
          </Picker>
          <FlashList
            data={episodes}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleEpisodePress(item)}>
                <Text
                  style={[
                    styles.episode,
                    selectedEpisode?.episode_number === item.episode_number && styles.selectedEpisode,
                  ]}
                >
                  S{selectedSeason}E{item.episode_number} - {item.name}
                </Text>
              </Pressable>
            )}
            keyExtractor={(item) => `${item.episode_number}`}
            estimatedItemSize={50}
            scrollEnabled={false}
          />
          {selectedEpisode && (
            <View style={styles.episodeDetails}>
              <Text style={styles.episodeTitle}>
                S{selectedSeason}E{selectedEpisode.episode_number} - {selectedEpisode.name}
              </Text>
              {selectedEpisode.air_date && (
                <Text style={styles.episodeSubtitle}>({selectedEpisode.air_date})</Text>
              )}
              {selectedEpisode.overview && (
                <Text style={styles.episodeOverview}>{selectedEpisode.overview}</Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );

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
      <FlashList
        ListHeaderComponent={renderHeader}
        data={[]}
        renderItem={() => null}
        keyExtractor={() => "header"}
        estimatedItemSize={200}
      />
      {listId && (
        <MyLists visible={isModalVisible} onClose={closeModal} itemId={numericId} type={type} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  listContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#1E1E1E",
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
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 16,
    color: "#A9A9A9",
    marginBottom: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    padding: 5,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E88E5",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  playButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginLeft: 5,
  },
  video: {
    width: "100%",
    height: 200,
    backgroundColor: "#000",
  },
  sectionContainer: {
    marginHorizontal: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#FFFFFF",
  },
  overview: {
    fontSize: 14,
    lineHeight: 22,
    color: "#E0E0E0",
  },
  infoContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  infoLabel: {
    fontWeight: "bold",
    marginRight: 10,
    width: 100,
    color: "#FFFFFF",
  },
  infoText: {
    flex: 1,
    color: "#E0E0E0",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginTop: 20,
  },
  seasonContainer: {
    marginHorizontal: 15,
    marginBottom: 15,
  },
  picker: {
    color: "#FFFFFF",
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    marginBottom: 10,
  },
  episodeList: {
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    padding: 10,
  },
  episode: {
    color: "#E0E0E0",
    fontSize: 14,
    paddingVertical: 5,
  },
  selectedEpisode: {
    backgroundColor: "#2A2A2A",
    borderRadius: 5,
  },
  episodeDetails: {
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  episodeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  episodeSubtitle: {
    fontSize: 14,
    color: "#A9A9A9",
    marginBottom: 5,
  },
  episodeOverview: {
    fontSize: 14,
    color: "#E0E0E0",
    marginBottom: 10,
  },
  progressContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#3A3A3A",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#1E88E5",
  },
  progressText: {
    fontSize: 12,
    color: "#A9A9A9",
    marginTop: 5,
  },
});