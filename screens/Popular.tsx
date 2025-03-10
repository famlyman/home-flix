import React from "react";
import {
  View,
  Dimensions,
  Image,
  TouchableWithoutFeedback,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { image500 } from "../services/tmdbapi";
import { FlashList } from "@shopify/flash-list";

const { width, height } = Dimensions.get("window");

interface Movie {
  poster_path: string;
  title: string;
}

interface PopularMovieProps {
  title: string;
  data: Movie[];
}

export default function PopularMovie({ title, data }: PopularMovieProps) {
  const router = useRouter();
  const theme = useTheme();

  const renderItem = ({ item, index }: { item: Movie; index: number }) => {
    return (
      <TouchableWithoutFeedback
        key={index}
        onPress={() => router.push(`/Movie/${item.title}`)}
      >
        <View style={{ marginRight: 16, marginBottom: 4 }}>
          <Image
            source={{
              uri:
                image500(item.poster_path) ||
                "https://th.bing.com/th/id/R.983b8085251688a15240a6ab11b97c39?rik=MlZlZUcTUEgjyw&riu=http%3a%2f%2fwallpapercave.com%2fwp%2fwp1946050.jpg&ehk=s%2fbeqrs6stRqTs%2bO5MOpsePOb%2bQbXA2KyK8HwRy4jCw%3d&risl=&pid=ImgRaw&r=0",
            }}
            style={{
              width: width * 0.3,
              height: height * 0.2,
              borderRadius: 24,
            }}
          />

          <Text
            variant="titleMedium"
            style={{ 
              marginLeft: 4, 
              marginTop: 4,
              color: theme.colors.onSurface,
              fontWeight: "bold" 
            }}
          >
            {item.title.length > 12
              ? item.title.slice(0, 12) + "..."
              : item.title}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ 
        marginHorizontal: 16, 
        flexDirection: "row", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: 16
      }}>
        <Text 
          variant="titleLarge"
          style={{ 
            color: theme.colors.onSurface,
            fontWeight: "bold"
          }}
        >
          {title}
        </Text>
      </View>

      <FlashList
        estimatedItemSize={200}
        horizontal
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 15,
        }}
      />
    </View>
  );
}