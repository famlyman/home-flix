import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer, VideoPlayer } from "expo-video";
import { useEvent } from "expo";
import { scrobble } from "../../services/traktapi";
import { debounce, DebouncedFunc } from "lodash"; // Ensure lodash is imported with types

export default function PlayerScreen() {
  const { mediaUrl, title, id, type, season, episode } = useLocalSearchParams<{
    mediaUrl: string;
    title: string;
    id: string;
    type: "movie" | "show";
    season?: string;
    episode?: string;
  }>();

  const numericId = parseInt(id, 10);
  const seasonNum = season ? parseInt(season, 10) : undefined;
  const episodeNum = episode ? parseInt(episode, 10) : undefined;

  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastScrobbleState = useRef<"start" | "pause" | null>(null);

  const player = useVideoPlayer(mediaUrl || "", (player: VideoPlayer) => {
    console.log("⭐⭐ Player initialized with URL:", mediaUrl);
    player.play();
  });

  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const playerStatus = useEvent(player, "statusChange", {
    status: player.status,
    callback: (status: any, details?: { error?: string }) => {
      console.log("⭐⭐ Player status:", status, "Details:", details || "");
      if (status === "error" && details?.error) {
        console.error("⭐⭐ Player error:", details.error);
        setError(`Playback error: ${details.error}`);
      }
    },
  });

  // Progress tracking
  useEffect(() => {
    if (player.duration > 0) {
      const progressPercent = (player.currentTime / player.duration) * 100;
      setProgress(progressPercent);
    }
  }, [player.currentTime, player.duration]);

  // Scrobble on completion
  useEffect(() => {
    if (player.duration > 0 && player.currentTime >= player.duration - 0.5) {
      scrobble("stop", type, numericId, progress, seasonNum && episodeNum ? { season: seasonNum, episode: episodeNum } : undefined)
        .catch((err: { message: any; }) => console.error("⭐⭐ Scrobble stop error:", err.message));
    }
  }, [player.currentTime, player.duration, type, numericId, progress, seasonNum, episodeNum]);

  // Debounced scrobble function with explicit typing
  const scrobbleDebounced = useRef<DebouncedFunc<(
    action: "start" | "pause",
    type: "movie" | "show",
    id: number,
    progress: number,
    episode?: { season: number; episode: number }
  ) => void>>(
    debounce(
      (
        action: "start" | "pause",
        type: "movie" | "show",
        id: number,
        progress: number,
        episode?: { season: number; episode: number }
      ) => {
        scrobble(action, type, id, progress, episode)
          .then(() => {
            lastScrobbleState.current = action;
          })
          .catch((err: { message: any; }) => console.error(`⭐⭐ Scrobble ${action} error:`, err.message));
      },
      1000 // 1-second debounce
    )
  ).current;

  // Scrobble on play/pause with deduplication
  useEffect(() => {
    if (!player.duration) return;

    const action = isPlaying ? "start" : "pause";
    if (lastScrobbleState.current === action) return;

    console.log(`⭐⭐ Video ${action}ed`);
    scrobbleDebounced(action, type, numericId, progress, seasonNum && episodeNum ? { season: seasonNum, episode: episodeNum } : undefined);
  }, [isPlaying, type, numericId, seasonNum, episodeNum, player.duration, scrobbleDebounced]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <VideoView
        style={styles.video}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
        nativeControls
      />
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress.toFixed(0)}% Watched</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF", textAlign: "center", marginVertical: 10 },
  video: { width: "100%", height: 300, backgroundColor: "#000" },
  progressContainer: { marginTop: 10, paddingHorizontal: 15 },
  progressBar: { height: 8, backgroundColor: "#3A3A3A", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#1E88E5" },
  progressText: { fontSize: 12, color: "#A9A9A9", marginTop: 5, textAlign: "center" },
  errorText: { color: "red", textAlign: "center", marginTop: 20 },
});