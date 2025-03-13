import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Portal, Modal, Button, Title, Paragraph } from "react-native-paper";
import { authenticate, isAuthenticated } from "../services/premiumize";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking"; // Add Linking for URL opening

interface PremiumizeAuthProps {
  onAuthComplete: (token: string) => void;
}

const PremiumizeAuthNew = ({ onAuthComplete }: PremiumizeAuthProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  
  useEffect(() => {
    
    checkAndAuthenticate();
  }, []);

  const checkAndAuthenticate = async () => {
    
    try {
      if (await isAuthenticated()) {
        
        const token = await SecureStore.getItemAsync("premiumize_new_access_token") || "";
        setLoading(false);
        onAuthComplete(token);
      } else {
        
        startAuth();
      }
    } catch (err) {
      
      setError("Failed to check auth status");
      setLoading(false);
    }
  };

  const startAuth = async () => {
    
    try {
      const token = await authenticate((url: React.SetStateAction<string | null>, code: React.SetStateAction<string | null>) => {
        
        setVerificationUri(url);
        setUserCode(code);
        setModalVisible(true);
      });
      
      setModalVisible(false);
      setLoading(false);
      onAuthComplete(token);
    } catch (err: any) {
      
      setError(err.message || "Authentication failed");
      setLoading(false);
    }
  };

  const dismissModal = () => {
    
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color="#0066ff" />
          <Text style={styles.text}>Authenticating with Premiumize...</Text>
        </>
      ) : error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button mode="contained" onPress={startAuth} style={styles.button}>
            Retry
          </Button>
        </>
      ) : (
        <Text style={styles.text}>Authentication complete</Text>
      )}
      <Portal>
        <Modal visible={modalVisible} onDismiss={dismissModal} contentContainerStyle={styles.modal}>
          <Title style={styles.title}>Connect to Premiumize</Title>
          <Paragraph style={styles.paragraph}>Please visit: {verificationUri}</Paragraph>
          <Button mode="contained" onPress={() => Linking.openURL(verificationUri || "")} style={styles.button}>
            Open Browser
          </Button>
          <Paragraph style={styles.paragraph}>Enter this code:</Paragraph>
          <Text style={styles.code}>{userCode}</Text>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { justifyContent: "center", alignItems: "center", padding: 20 },
  text: { fontSize: 16, marginTop: 10, textAlign: "center", color: "#E0E0E0" },
  error: { fontSize: 16, color: "red", textAlign: "center", marginBottom: 10 },
  modal: { backgroundColor: "white", padding: 20, margin: 20, borderRadius: 8 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  paragraph: { fontSize: 16, marginVertical: 10, textAlign: "center" },
  button: { marginVertical: 10 },
  code: { fontSize: 30, fontWeight: "bold", textAlign: "center", marginVertical: 10 },
});

export default PremiumizeAuthNew;
