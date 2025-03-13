import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = 'https://ajkjsezdaulybvrscoyv.supabase.co/functions/v1/premiumize-proxy'; // Replace with your Supabase function URL


const PREMIUMIZE_API_URL = 'https://www.premiumize.me/api';
const API_KEY = Constants.expoConfig?.extra?.PREMIUMIZE_API_KEY || "";

export const scrapePremiumizeLink = async (sourceUrl: any) => {
  try {
    try {
        const response = await axios.post(BACKEND_URL, { sourceUrl });
        
        if (response.data.streamUrl) {
          return response.data.streamUrl;
        } else if (response.data.status === 'success' && response.data.content && response.data.content.length > 0) {
          // Premiumize returns an array of files; pick the first streamable one
          const streamUrl = response.data.content[0].link;
          return streamUrl;
        } else {
          throw new Error(response.data.message || 'No streamable link found');
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error('Error scraping link:', error.message);
          throw error;
        } else {
          console.error('Error scraping link:', String(error));
          throw new Error('An unknown error occurred while scraping link');
        }
      }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error scraping Premiumize link:', error.message);
      throw error;
    } else {
      console.error('Error scraping Premiumize link:', String(error));
      throw new Error('An unknown error occurred while scraping Premiumize link');
    }
  }
};
