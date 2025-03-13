import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = 'https://ajkjsezdaulybvrscoyv.supabase.co/functions/v1/premiumize-proxy'; // Replace with your Supabase function URL


const PREMIUMIZE_API_URL = 'https://www.premiumize.me/api';
const API_KEY = Constants.expoConfig?.extra?.PREMIUMIZE_API_KEY || "";

export const scrapePremiumizeLink = async (sourceUrl: any) => {
  try {
    const response = await axios.post(BACKEND_URL, { sourceUrl });
    const { streamUrl } = response.data;
    if (!streamUrl) {
      throw new Error('No streamable link returned');
    }
    return streamUrl;
  } catch (e: any) {
    console.error('Error scraping link:', e.message);
    throw new Error(e.message || 'Failed to scrape link');
  }
};