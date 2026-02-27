// tte-portal/src/api.ts
import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface PassengerFilters {
  status?: string;
  coach?: string;
  from?: string;
  to?: string;
  [key: string]: string | undefined;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  // Login response fields
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: {
    employeeId?: string;
    name?: string;
    email?: string;
    role?: string;
    trainAssigned?: number;
    permissions?: string[];
  };
}

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
    console.log("[TTE API] Fetching CSRF token...");
    await axios.get(`${API_BASE_URL}/csrf-token`, { withCredentials: true });
    console.log(
      "[TTE API] CSRF token fetched successfully:",
      !!getCookie("csrfToken"),
    );
    return !!getCookie("csrfToken");
  } catch (error) {
    console.error("[TTE API] Failed to fetch CSRF token:", error);
    return false;
  }
};

// Ensure CSRF token exists, fetch if missing
const ensureCsrfToken = async (): Promise<boolean> => {
  const existingToken = getCookie("csrfToken");
  if (existingToken) {
    console.log("[TTE API] CSRF token already present");
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
    // This ensures all API calls are scoped to the TTE's assigned train
    // SKIP for auth endpoints — the login form provides its own trainNo
    const requestUrl = config.url || '';
    const isAuthRequest = requestUrl.includes('/auth/');
    const trainNo = localStorage.getItem("trainAssigned");
    if (trainNo && !isAuthRequest) {
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
        console.warn("[TTE API] CSRF token missing, fetching now...");
        await ensureCsrfToken();
        csrfToken = getCookie("csrfToken");
      }

      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      } else {
        console.error("[TTE API] CSRF token still missing after fetch attempt");
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

    // Handle 401 Unauthorized - try to refresh token
    if (status === 401) {
      // Skip session-expiry handling for auth endpoints (login/register failures
      // should propagate as plain errors so the login form can display them)
      const requestUrl: string = error.config?.url || "";
      const isAuthEndpoint =
        requestUrl.includes("/auth/staff/login") ||
        requestUrl.includes("/auth/passenger/login") ||
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
            console.log("[TTE API] Token expired, attempting refresh...");
            const refreshResponse = await axios.post(
              `${API_BASE_URL}/auth/refresh`,
              { refreshToken },
            );
            const newToken = refreshResponse.data.token;

            // Save new token
            localStorage.setItem("token", newToken);
            console.log("[TTE API] Token refreshed successfully");

            // Retry original request with new token
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          } catch (refreshError) {
            console.error("[TTE API] Token refresh failed:", refreshError);
          }
        }
      }

      // If refresh fails or no refresh token, logout
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      alert("⚠️ Session expired. Please login again.");
      window.location.href = "/login";
    }

    // Handle 403 Forbidden
    if (status === 403) {
      console.error("[TTE API] 403 Forbidden:", data);

      // If CSRF token error, try to refetch and retry
      const isCsrfError = data.message?.toLowerCase().includes("csrf");
      if (isCsrfError && !error.config._retry) {
        console.log(
          "[TTE API] CSRF error detected, attempting to refetch token and retry...",
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
          console.error("[TTE API] CSRF token refetch failed:", retryError);
        }
      }

      // For non-CSRF 403 errors
      if (!isCsrfError) {
        // Skip interceptor for login/auth requests — let the login form handle its own errors
        const requestUrl = error.config?.url || '';
        const isAuthRequest = requestUrl.includes('/auth/');
        if (isAuthRequest) {
          return Promise.reject(error);
        }

        // For train mismatch, permission denied, or any other 403:
        // Do NOT clear tokens or redirect — the TTE is authenticated,
        // just not authorized for this specific action.
        // Let the error propagate to the component so it can show a meaningful message.
        console.warn("[TTE API] 403 — not authorized for this action:", data?.message);
      }
    }

    return Promise.reject(error);
  },
);

// TTE Portal API
export const tteAPI = {
  // TTE Login — employeeId + password only (trainAssigned comes from DB)
  login: async (
    employeeId: string,
    password: string,
  ): Promise<ApiResponse> => {
    const response = await api.post("/auth/staff/login", {
      employeeId,
      password,
    });
    return response.data;
  },

  // Get filtered passengers
  getPassengers: async (
    filters: PassengerFilters = {},
  ): Promise<ApiResponse> => {
    const params = new URLSearchParams(
      filters as Record<string, string>,
    ).toString();
    const response = await api.get(`/tte/passengers?${params}`);
    return response.data;
  },

  // Get currently boarded passengers
  getBoardedPassengers: async (): Promise<ApiResponse> => {
    const response = await api.get("/tte/boarded-passengers");
    return response.data;
  },

  // Get currently boarded RAC passengers (for offline upgrades)
  getBoardedRACPassengers: async (): Promise<ApiResponse> => {
    const response = await api.get("/tte/boarded-rac-passengers");
    return response.data;
  },

  // Manual mark boarded
  markBoarded: async (pnr: string): Promise<ApiResponse> => {
    const response = await api.post("/tte/mark-boarded", { pnr });
    return response.data;
  },

  // Manual mark deboarded
  markDeboarded: async (pnr: string): Promise<ApiResponse> => {
    const response = await api.post("/tte/mark-deboarded", { pnr });
    return response.data;
  },

  // Mark passenger as no-show
  markNoShow: async (pnr: string): Promise<ApiResponse> => {
    const response = await api.post("/tte/mark-no-show", { pnr });
    return response.data;
  },

  // Revert no-show status
  revertNoShow: async (pnr: string): Promise<ApiResponse> => {
    const response = await api.post("/tte/revert-no-show", { pnr });
    return response.data;
  },

  // Confirm upgrade for offline passenger
  confirmUpgrade: async (
    pnr: string,
    notificationId: string,
  ): Promise<ApiResponse> => {
    const response = await api.post("/tte/confirm-upgrade", {
      pnr,
      notificationId,
    });
    return response.data;
  },

  // Get journey statistics
  getStatistics: async (): Promise<ApiResponse> => {
    const response = await api.get("/tte/statistics");
    return response.data;
  },

  // Get upgraded passengers (RAC → CNF) from MongoDB
  getUpgradedPassengers: async (): Promise<ApiResponse> => {
    const response = await api.get("/tte/upgraded-passengers");
    return response.data;
  },

  // Train operations
  moveNextStation: async (): Promise<ApiResponse> => {
    const response = await api.post("/train/next-station");
    return response.data;
  },

  getTrainState: async (): Promise<ApiResponse> => {
    const response = await api.get("/train/state");
    return response.data;
  },

  // Offline upgrades management
  getOfflineUpgrades: async (): Promise<ApiResponse> => {
    const response = await api.get("/tte/offline-upgrades");
    return response.data;
  },

  confirmOfflineUpgrade: async (upgradeId: string): Promise<ApiResponse> => {
    const response = await api.post("/tte/offline-upgrades/confirm", {
      upgradeId,
    });
    return response.data;
  },

  rejectOfflineUpgrade: async (upgradeId: string): Promise<ApiResponse> => {
    const response = await api.post("/tte/offline-upgrades/reject", {
      upgradeId,
    });
    return response.data;
  },

  // Staff registration (TTE)
  register: async (
    employeeId: string,
    password: string,
    confirmPassword: string,
    name?: string,
  ): Promise<ApiResponse> => {
    const response = await api.post("/auth/staff/register", {
      employeeId,
      password,
      confirmPassword,
      role: "TTE",
      name,
    });
    return response.data;
  },

  // ========== Boarding Verification ==========
  // Get boarding verification queue
  getBoardingQueue: async (): Promise<ApiResponse> => {
    const response = await api.get("/tte/boarding-queue");
    return response.data;
  },

  // Confirm all passengers boarded (bulk)
  confirmAllBoarded: async (): Promise<ApiResponse> => {
    const response = await api.post("/tte/confirm-all-boarded");
    return response.data;
  },

  // ========== Visualization ==========
  // Get station schedule
  getStationSchedule: async (): Promise<ApiResponse> => {
    const response = await api.get("/visualization/station-schedule");
    return response.data;
  },

  // ========== Reallocation Management ==========
  // Get pending reallocations for TTE approval
  getPendingReallocations: async (): Promise<ApiResponse> => {
    const response = await api.get("/reallocation/pending");
    return response.data;
  },

  // Approve batch of reallocations
  approveBatchReallocations: async (
    reallocationIds: string[],
    tteId: string,
  ): Promise<ApiResponse> => {
    const response = await api.post("/reallocation/approve-batch", {
      reallocationIds,
      tteId,
    });
    return response.data;
  },

  // Reject a specific reallocation
  rejectReallocation: async (
    id: string,
    reason: string,
    tteId: string,
  ): Promise<ApiResponse> => {
    const response = await api.post(`/reallocation/reject/${id}`, {
      reason,
      tteId,
    });
    return response.data;
  },

  // ========== Vacant Berths ==========
  // Get vacant berths at current station
  getVacantBerths: async (): Promise<ApiResponse> => {
    const response = await api.get("/train/vacant-berths");
    return response.data;
  },
};

export default api;
