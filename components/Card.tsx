// Card.tsx
import React from "react";
import { Dimensions, Pressable, Image } from "react-native";
import { image500 } from "@/services/tmdbapi";

interface CardProps {
    item: {
        id: number;
        poster_path: string;
    };
    handleClick: (id: number) => void;
}

export default function Card({ item, handleClick }: CardProps) {
    const { width, height } = Dimensions.get("window");
    
    return (
        <Pressable onPress={() => handleClick(item.id)}>
            <Image
                source={{ uri: image500(item.poster_path) || "" }}
                style={{ 
                    width: width * 0.45, // Slightly smaller than half for padding
                    height: height * 0.3,
                    borderRadius: 16
                }}
                resizeMode="cover"
            />
        </Pressable>
    );
}