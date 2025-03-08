// app/index.tsx or any other page
import React from 'react';
import { View, Text as RNText } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export default function Page() {
  const theme = useTheme();
  
  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: theme.colors.background, // Should be dark if dark theme is applied
      padding: 20 
    }}>
      <Text>This should use Paper theme</Text>
      <RNText style={{ color: theme.colors.onBackground }}>
        Background color: {theme.colors.background}
      </RNText>
    </View>
  );
}