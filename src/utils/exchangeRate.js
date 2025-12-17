// Exchange rate utility - fetches USD to INR rate once per day and caches it

const EXCHANGE_RATE_CACHE_KEY = "cs2_exchange_rate_cache";
const EXCHANGE_RATE_API_URL = "https://api.exchangerate-api.com/v4/latest/USD";
const FALLBACK_RATE = 83; // Approximate fallback rate if API fails

// Get today's date as a string (YYYY-MM-DD) for cache key
const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

// Check if cached rate is still valid (same day)
const isCacheValid = (cachedData) => {
  if (!cachedData || !cachedData.date) return false;
  return cachedData.date === getTodayDateString();
};

// Fetch exchange rate from API
const fetchExchangeRate = async () => {
  try {
    const response = await fetch(EXCHANGE_RATE_API_URL);
    if (!response.ok) {
      throw new Error("Failed to fetch exchange rate");
    }
    const data = await response.json();
    const inrRate = data.rates?.INR;
    if (!inrRate) {
      throw new Error("INR rate not found");
    }
    return inrRate;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return null;
  }
};

// Get USD to INR exchange rate (cached for the day)
export const getExchangeRate = async () => {
  // Check cache first
  const cachedDataStr = localStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
  if (cachedDataStr) {
    try {
      const cachedData = JSON.parse(cachedDataStr);
      if (isCacheValid(cachedData)) {
        return cachedData.rate;
      }
    } catch (e) {
      console.error("Error parsing cached exchange rate:", e);
    }
  }

  // Cache is invalid or doesn't exist, fetch new rate
  const rate = await fetchExchangeRate();
  
  if (rate !== null) {
    // Cache the new rate with today's date
    const cacheData = {
      date: getTodayDateString(),
      rate: rate,
    };
    localStorage.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify(cacheData));
    return rate;
  }

  // If fetch failed, try to use cached rate even if it's from a previous day
  if (cachedDataStr) {
    try {
      const cachedData = JSON.parse(cachedDataStr);
      console.warn("Using cached exchange rate from previous day due to API failure");
      return cachedData.rate;
    } catch (e) {
      // Fall through to fallback
    }
  }

  // Last resort: use fallback rate
  console.warn("Using fallback exchange rate");
  return FALLBACK_RATE;
};

// Convert USD price to INR
export const convertUSDToINR = async (usdPrice) => {
  if (!usdPrice || usdPrice <= 0) return null;
  const rate = await getExchangeRate();
  return Math.round(usdPrice * rate);
};

