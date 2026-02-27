// passenger-portal/src/api.ts
import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { ApiResponse } from "./types";

const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Required for cookies (CSRF)
  headers: {
    "Content-Type": "application/json",
  },
});

// CSRF Token management - read from cookies
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
};

// Fetch CSRF token from server
const fetchCsrfToken = async (): Promise<boolean> => {
  try {
    console.log("[Passenger API] Fetching CSRF token...");
    await axios.get(`${API_BASE_URL}/csrf-token`, { withCredentials: true });
    console.log(
      "[Passenger API] CSRF token fetched successfully:",
      !!getCookie("csrfToken"),
    );
    return !!getCookie("csrfToken");
  } catch (error) {
    console.error("[Passenger API] Failed to fetch CSRF token:", error);
    return false;
  }
};

// Ensure CSRF token exists, fetch if missing
const ensureCsrfToken = async (): Promise<boolean> => {
  const existingToken = getCookie("csrfToken");
  if (existingToken) {
    console.log("[Passenger API] CSRF token already present");
    return true;
  }
  return await fetchCsrfToken();
};

// Initialize CSRF token on load
ensureCsrfToken();

// Add request interceptor to attach token, CSRF, and trainNo to all requests
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Auto-inject trainNo from localStorage into every request
    // This ensures all API calls are scoped to the passenger's train
    const trainNo = localStorage.getItem("trainNo");
    if (trainNo) {
      if (config.method && ["get", "head", "options"].includes(config.method.toLowerCase())) {
        // For GET requests: add as query parameter
        config.params = { ...config.params, trainNo };
      } else {
        // For POST/PUT/PATCH requests: add to request body
        if (config.data && typeof config.data === "object" && !(config.data instanceof FormData)) {
          config.data = { ...config.data, trainNo };
        } else if (!config.data) {
          config.data = { trainNo };
        }
      }
    }

    // Add CSRF token for state-changing requests
    if (
      config.method &&
      !["get", "head", "options"].includes(config.method.toLowerCase())
    ) {
      let csrfToken = getCookie("csrfToken");

      // If CSRF token is missing, try to fetch it
      if (!csrfToken) {
        console.warn("[Passenger API] CSRF token missing, fetching now...");
        await ensureCsrfToken();
        csrfToken = getCookie("csrfToken");
      }

      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      } else {
        console.error(
          "[Passenger API] CSRF token still missing after fetch attempt",
        );
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Add response interceptor to handle token expiration with auto-refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      // Skip session-expiry handling for auth endpoints so that login
      // failures propagate as plain errors and the form can display them.
      const requestUrl: string = error.config?.url || "";
      const isAuthEndpoint =
        requestUrl.includes("/auth/passenger/login") ||
        requestUrl.includes("/auth/passenger/register") ||
        requestUrl.includes("/auth/staff/login") ||
        requestUrl.includes("/auth/staff/register") ||
        requestUrl.includes("/auth/refresh");

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      const isExpiredToken =
        data?.message?.toLowerCase().includes("expired") ||
        data?.message?.toLowerCase().includes("jwt");

      if (isExpiredToken) {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          try {
            console.log("[Passenger API] Token expired, attempting refresh...");
            const refreshResponse = await axios.post(
              `${API_BASE_URL}/auth/refresh`,
              { refreshToken },
            );
            const newToken = refreshResponse.data.token;

            // Save new token
            localStorage.setItem("token", newToken);
            console.log("[Passenger API] Token refreshed successfully");

            // Retry original request with new token
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          } catch (refreshError) {
            console.error(
              "[Passenger API] Token refresh failed:",
              refreshError,
            );
          }
        }
      }

      // If refresh fails or no refresh token, logout
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("passengerPNR");
      console.warn("⚠️ Session expired. Please login again.");
    }

    // Handle 403 Forbidden (CSRF errors)
    if (status === 403) {
      console.error("[Passenger API] 403 Forbidden:", data);

      // If CSRF token error, try to refetch and retry
      const isCsrfError = data.message?.toLowerCase().includes("csrf");
      if (isCsrfError && !error.config._retry) {
        console.log(
          "[Passenger API] CSRF error detected, attempting to refetch token and retry...",
        );
        error.config._retry = true;

        try {
          await fetchCsrfToken();
          const newCsrfToken = getCookie("csrfToken");
          if (newCsrfToken) {
            error.config.headers["X-CSRF-Token"] = newCsrfToken;
            return api.request(error.config);
          }
        } catch (retryError) {
          console.error(
            "[Passenger API] CSRF token refetch failed:",
            retryError,
          );
        }
      }
    }

    return Promise.reject(error);
  },
);

// Passenger Portal API
export const passengerAPI = {
  // Public PNR lookup
  getPNRDetails: async (pnr: string): Promise<ApiResponse> => {
    const response = await api.get(`/passenger/pnr/${pnr}`);
    return response.data;
  },

  // Passenger login
  login: async (loginId: string, password: string, loginType: 'irctcId' | 'email' = 'irctcId'): Promise<ApiResponse> => {
    const body = loginType === 'email'
      ? { email: loginId, password }
      : { irctcId: loginId, password };
    const response = await api.post("/auth/passenger/login", body);
    return response.data;
  },

  // Passenger registration
  register: async (data: {
    email: string;
    irctcId: string;
    name: string;
    phone?: string;
    password: string;
    confirmPassword: string;
  }): Promise<ApiResponse> => {
    const response = await api.post("/auth/passenger/register", data);
    return response.data;
  },

  // Self-cancellation
  cancelBooking: async (pnr: string): Promise<ApiResponse> => {
    const response = await api.post("/passenger/cancel", { pnr });
    return response.data;
  },

  // Upgrade notifications
  getUpgradeNotifications: async (pnr: string): Promise<ApiResponse> => {
    const response = await api.get(`/passenger/upgrade-notifications/${pnr}`);
    return response.data;
  },

  acceptUpgrade: async (
    pnr: string,
    notificationId: string,
  ): Promise<ApiResponse> => {
    const response = await api.post("/passenger/accept-upgrade", {
      pnr,
      notificationId,
    });
    return response.data;
  },

  denyUpgrade: async (
    pnr: string,
    notificationId: string,
    reason: string,
  ): Promise<ApiResponse> => {
    const response = await api.post("/passenger/deny-upgrade", {
      pnr,
      notificationId,
      reason,
    });
    return response.data;
  },

  // Approve upgrade (dual-approval flow)
  approveUpgrade: async (
    irctcId: string,
    reallocationId: string,
  ): Promise<ApiResponse> => {
    const response = await api.post("/passenger/approve-upgrade", {
      irctcId,
      reallocationId,
    });
    return response.data;
  },

  // Get pending upgrades for passenger
  getPendingUpgrades: async (irctcId: string): Promise<ApiResponse> => {
    const response = await api.get(`/passenger/pending-upgrades/${irctcId}`);
    return response.data;
  },

  // Get train state
  getTrainState: async (): Promise<ApiResponse> => {
    const response = await api.get("/train/state");
    return response.data;
  },
};

export default api;
