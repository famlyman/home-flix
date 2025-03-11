const { config } = require('dotenv');
config();

module.exports = {
  "expo": {
    "name": "home-flix",
    "slug": "home-flix",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "homeflix",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      "expo-video"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {
        "origin": false
      },
      CLIENT_ID: process.env.CLIENT_ID,
      CLIENT_SECRET: process.env.CLIENT,
      REDIRECT_URI: process.env.REDIRECT_URI,
      
      TMDB_API: process.env.TMDB_API,

      PREMIUMIZE_CLIENT_ID: process.env.PREMIUMIZE_CLIENT_ID,
      PREMIUMIZE_CLIENT_SECRET: process.env.PREMIUMIZE_CLIENT_SECRET,
      PREMIUMIZE_REDIRECT_URI: process.env.PREMIUMIZE_REDIRECT_URI,
      PREMIUMIZE_API: process.env.PREMIUMIZE_API,
      
      "eas": {
        "projectId": "64f99d28-34cf-45ce-ade0-af9ec24a338d"
      }
    },
    "owner": "famlyman"
  
    // other expo config
    
  }
};