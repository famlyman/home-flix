import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  Linking, 
  Alert 
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

const PremiumizeAuth: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authData, setAuthData] = useState<DeviceCodeResponse | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // Your app's config values
  const config = {
    CLIENT_ID: "78b94e99bb086cfaf14cb6b628e4c1e51d9b9620c9c726d177fe709bc726155c",
    PREMIUMIZE_CLIENT_ID: "441256958",
    PREMIUMIZE_CLIENT_SECRET: "mu79pjdfarzrptwcyn",
    REDIRECT_URI: "ourflix://auth",
    TMDB_API: "a05a975b444cb7b0f3c3cddbc6104cb1"
  };

  useEffect(() => {
    requestDeviceCode();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  const requestDeviceCode = async () => {
    try {
      setLoading(true);
      console.log(`Requesting device code with client_id: ${config.PREMIUMIZE_CLIENT_ID}`);
      
      // In a real implementation, replace this with your actual API call
      // const response = await fetch('https://www.premiumize.me/token', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/x-www-form-urlencoded',
      //   },
      //   body: `client_id=${config.PREMIUMIZE_CLIENT_ID}&response_type=device_code`,
      // });
      // const data = await response.json();
      
      // For demonstration, using mock data from your logs
      const mockResponse: DeviceCodeResponse = {
        device_code: "2ba7024b946da05d229c98183d31c0e9",
        expires_in: 600,
        interval: 5,
        user_code: "thfk-wfz2",
        verification_uri: "https://www.premiumize.me/device"
      };
      
      console.log(`Full Device Code Response:`, mockResponse);
      console.log(`Please visit ${mockResponse.verification_uri} and enter code: ${mockResponse.user_code}`);
      
      setAuthData(mockResponse);
      setCountdown(mockResponse.expires_in);
      setLoading(false);
      
      // In a real app, you would start polling for token here
      // startPollingForToken(mockResponse);
      
    } catch (err) {
      console.error('Error requesting device code:', err);
      setError('Failed to get authorization code. Please try again.');
      setLoading(false);
    }
  };

  const startPollingForToken = (data: DeviceCodeResponse) => {
    // Implementation for polling the token endpoint
    // This would check if the user has completed authorization
    // Not implemented in this example
  };

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text)
      Alert.alert('Copied', `Code ${text} copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const openVerificationUrl = async () => {
    if (authData?.verification_uri) {
      const canOpen = await Linking.canOpenURL(authData.verification_uri);
      if (canOpen) {
        await Linking.openURL(authData.verification_uri);
      } else {
        Alert.alert('Cannot open URL', 'Please manually visit: ' + authData.verification_uri);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' + secs : secs}`;
  };

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Requesting authorization code...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={requestDeviceCode}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Premiumize Authorization</Text>
        
        <View style={styles.instructionCard}>
          <Text style={styles.instruction}>Please visit:</Text>
          <TouchableOpacity onPress={openVerificationUrl}>
            <Text style={styles.link}>{authData?.verification_uri}</Text>
          </TouchableOpacity>
          
          <View style={styles.codeContainer}>
            <Text style={styles.instruction}>Enter this code:</Text>
            <TouchableOpacity 
              style={styles.codeBox} 
              onPress={() => authData?.user_code && copyToClipboard(authData.user_code)}
            >
              <Text style={styles.codeText}>{authData?.user_code}</Text>
              <Icon name="clipboard" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.hint}>Tap to copy</Text>
          </View>
        </View>
        
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>Time remaining:</Text>
          <Text style={styles.countdownTimer}>{formatTime(countdown)}</Text>
        </View>
        
        <Text style={styles.infoText}>
          After authorization, you'll be automatically redirected.
        </Text>
      </View>
      
      <View style={styles.deviceCodeContainer}>
        <Text style={styles.deviceCode}>
          Device code: {authData?.device_code}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  instructionCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  instruction: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 16,
  },
  link: {
    color: '#0066cc',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textDecorationLine: 'underline',
  },
  codeContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eee',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginVertical: 8,
  },
  codeText: {
    fontSize: 22,
    fontFamily: 'monospace',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#666',
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  countdownLabel: {
    fontSize: 16,
    marginBottom: 5,
  },
  countdownTimer: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  deviceCodeContainer: {
    marginTop: 20,
    backgroundColor: '#eee',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    maxWidth: 400,
  },
  deviceCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#666',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PremiumizeAuth;
