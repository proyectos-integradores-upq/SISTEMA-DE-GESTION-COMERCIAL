import { Platform } from "react-native";

const DEFAULT_PORT = "8000";

// Ordered by priority: LAN for real device, emulator host mapping, then localhost.
const API_CANDIDATES = [
  `http://172.20.10.4:${DEFAULT_PORT}`,
  Platform.OS === "android" ? `http://10.0.2.2:${DEFAULT_PORT}` : null,
  `http://127.0.0.1:${DEFAULT_PORT}`,
  `http://localhost:${DEFAULT_PORT}`
].filter(Boolean);

export const getApiCandidates = () => API_CANDIDATES;

export const apiRequest = async (path, options = {}) => {
  let lastNetworkError = null;

  for (const baseUrl of API_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}${path}`, options);
      return response;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  throw lastNetworkError || new Error("No se pudo conectar con la API");
};
