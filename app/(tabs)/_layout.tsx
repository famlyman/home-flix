// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs screenOptions={{
        tabBarStyle: { backgroundColor: '#000000' },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trakt Lists',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Icon name="playlist-star" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Icon name="video-vintage" size={size} color={color} />
          ),
        }}
      />
      {/* Add more tab screens as needed */}
    </Tabs>
  );
}
