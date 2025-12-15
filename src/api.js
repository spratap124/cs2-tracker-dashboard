import axios from 'axios'

// Get base URL from environment variable
// Vite exposes env variables via import.meta.env
// Variables must be prefixed with VITE_ to be accessible
const getBaseURL = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
}

export const API = axios.create({
  baseURL: getBaseURL()
})