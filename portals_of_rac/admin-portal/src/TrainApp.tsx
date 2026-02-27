// admin-portal/src/App.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "./services/apiWithErrorHandling";
import wsService from "./services/websocket";
import {
  saveAppState,
  loadAppState,
  clearAppState,
} from "./services/StateStore";
import ToastContainer from "./components/ToastContainer";

import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import HomePage from "./pages/HomePage";
import RACQueuePage from "./pages/RACQueuePage";
import CoachesPage from "./pages/CoachesPage";
import PassengersPage from "./pages/PassengersPage";

import VisualizationPage from "./pages/VisualizationPage";
import AddPassengerPage from "./pages/AddPassengerPage";

import PhaseOnePage from "./pages/PhaseOnePage";
import ConfigPage from "./pages/ConfigPage";
import {
  webSocketConnectedToast,
  webSocketDisconnectedToast,
} from "./services/toastNotification";
import "./App.css";
import "./UserMenu.css";
import TrainTabBar from './components/TrainTabBar';

// Types
interface User {
  username?: string;
  role?: string;
}

interface Station {
  name: string;
  code: string;
  sno?: number;
}

interface TrainData {
  trainNo?: string;
  trainName?: string;
  journeyDate?: string;
  stations?: Station[];
  currentStationIdx?: number;
  journeyStarted?: boolean;
  stats?: any;
}

interface StationArrivalData {
  data: {
    station: string;
  };
}

interface RACReallocationData {
  data: {
    totalAllocated: number;
  };
}

interface NoShowData {
  data: {
    passenger: {
      name: string;
    };
  };
}

interface WebSocketUpdateData {
  eventType: string;
  data?: any;
}

type PageType =
  | "config"
  | "home"
  | "rac-queue"
  | "coaches"
  | "passengers"
  | "reallocation"
  | "visualization"
  | "add-passenger"
  | "phase1";

interface AppProps {
  initialPage?: string;
}

function App({ initialPage }: AppProps): React.ReactElement {
  const navigate = useNavigate();
  const { trainNo: urlTrainNo } = useParams<{ trainNo?: string }>();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  const [trainData, setTrainData] = useState<TrainData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<PageType>(
    initialPage === "config" ? "config" : "home",
  );
  const [journeyStarted, setJourneyStarted] = useState<boolean>(false);
  const [autoInitAttempted, setAutoInitAttempted] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [showSignUp, setShowSignUp] = useState<boolean>(false);
  const [stateRestored, setStateRestored] = useState<boolean>(false);
  const isInitialMount = useRef(true);

  // Timer display state — polls backend engine for remaining time (display only)
  const TIMER_DURATION = 120; // 2 minutes in seconds
  const [timerSeconds, setTimerSeconds] = useState<number>(TIMER_DURATION);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const enginePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore persisted state on mount AND verify with backend
  useEffect(() => {
    const restoreState = async () => {
      const saved = await loadAppState(urlTrainNo);
      // If initialPage is 'config', always force config page (manual config route)
      if (initialPage === "config") {
        console.log("[App] Manual config route — forcing config page");
        setCurrentPage("config");
        setStateRestored(true);
        return;
      }

      let restoredPage: PageType = "home";
      let restoredJourneyStarted = false;
      let restoredAutoInit = false;

      if (saved) {
        console.log("[App] Restoring persisted state...");
        restoredPage = (saved.currentPage as PageType) || "home";
        // Never restore to 'config' from IndexedDB  config should only show via explicit navigation
        if (restoredPage === "config") {
          console.log("[App] Overriding saved 'config' page to 'home' (config only via landing page)");
          restoredPage = "home";
        }
        restoredJourneyStarted = saved.journeyStarted || false;
        restoredAutoInit = saved.autoInitAttempted || false;
      }

      // Verify with backend FIRST before applying restored state
      try {
        const response = await api.getTrainState(urlTrainNo);
        if (response && response.success && response.data) {
          const backendJourneyStarted = response.data.journeyStarted || false;
          const backendInitialized = response.data.initialized !== false;

          // Use backend state as source of truth
          if (restoredJourneyStarted !== backendJourneyStarted) {
            console.log(
              "[App] State mismatch! Frontend:",
              restoredJourneyStarted,
              "| Backend:",
              backendJourneyStarted,
            );
            restoredJourneyStarted = backendJourneyStarted;

            // If backend says journey not started, go to home page
            if (
              !backendJourneyStarted &&
              restoredPage !== "home"
            ) {
              console.log(
                "[App] Journey not started on backend, redirecting to home",
              );
              restoredPage = "home";
            }
          }

          if (!backendInitialized) {
            // Train not in backend memory (e.g., server restarted)
            console.log("[App] Train not initialized in backend memory, will auto-initialize...");
            setCurrentPage(restoredPage);
            setJourneyStarted(false);
            setAutoInitAttempted(false);
          } else {
            // Apply verified state
            setTrainData(response.data);
            setCurrentPage(restoredPage);
            setJourneyStarted(backendJourneyStarted);
            setAutoInitAttempted(restoredAutoInit);

            // Resume timer polling if journey is already running on backend
            if (backendJourneyStarted) {
              startTimerPolling();
            }

            // Save corrected state
            saveAppState({
              currentPage: restoredPage,
              journeyStarted: backendJourneyStarted,
              autoInitAttempted: restoredAutoInit,
            }, urlTrainNo);
          }
        } else {
          // Backend returned no valid data — keep saved page so auto-init can fill trainData
          console.log(
            "[App] Backend returned no data yet, keeping saved page:",
            restoredPage,
          );
          setCurrentPage(restoredPage);
          setJourneyStarted(false);
          setAutoInitAttempted(false);
        }
      } catch (err) {
        // Backend unreachable — use saved state as-is
        console.warn('[App] Backend unreachable during state restore:', err);
        setCurrentPage(restoredPage);
        setJourneyStarted(restoredJourneyStarted);
        setAutoInitAttempted(restoredAutoInit);
        if (restoredJourneyStarted) {
          startTimerPolling();
        }
      }

      // Only mark as restored AFTER verification is complete
      setStateRestored(true);
    };
    restoreState();
  }, []);

  // Save state to IndexedDB when key states change
  useEffect(() => {
    // Skip saving on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Only save after state has been restored
    if (stateRestored) {
      saveAppState({ currentPage, journeyStarted, autoInitAttempted }, urlTrainNo);
    }
  }, [currentPage, journeyStarted, autoInitAttempted, stateRestored]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    setupWebSocket();

    return () => {
      // Don't disconnect  just remove THIS component's listeners
      // so the WebSocket stays alive for other trains / landing page.
      cleanupWebSocketListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-initialize from backend config on app load
  // SKIP if train is already loaded (TrainDashboard already configured & initialized it)
  // or if this is a manual config route (initialPage === 'config')
  useEffect(() => {
    if (isAuthenticated && !autoInitAttempted && stateRestored && !trainData && initialPage !== 'config') {
      autoInitializeFromBackend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, stateRestored]);

  // Timer effect: poll backend engine for remaining time (display only)
  const startTimerPolling = useCallback(() => {
    setTimerActive(true);
  }, []);

  const stopTimerPolling = useCallback(() => {
    setTimerActive(false);
    if (enginePollRef.current) {
      clearInterval(enginePollRef.current);
      enginePollRef.current = null;
    }
  }, []);

  // Local 1-second countdown (visual only — backend engine does the real work)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!timerActive || !journeyStarted) {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }

    countdownRef.current = setInterval(() => {
      setTimerSeconds(prev => (prev > 0 ? prev - 1 : TIMER_DURATION));
    }, 1000);

    return () => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
  }, [timerActive, journeyStarted]);

  // Sync with backend engine every 30 seconds for accuracy
  useEffect(() => {
    if (!timerActive || !journeyStarted) {
      if (enginePollRef.current) { clearInterval(enginePollRef.current); enginePollRef.current = null; }
      return;
    }

    const pollEngine = async () => {
      try {
        const tNo = urlTrainNo || trainData?.trainNo;
        const response = await api.getEngineStatus(tNo);
        if (response.success && response.data) {
          const remaining = response.data.timeUntilNextTick;
          if (typeof remaining === 'number') {
            setTimerSeconds(Math.ceil(remaining / 1000));
          }
          if (!response.data.isRunning) {
            stopTimerPolling();
          }
        }
      } catch (e) { /* ignore poll errors */ }
    };

    pollEngine(); // Immediate sync
    enginePollRef.current = setInterval(pollEngine, 30000);

    return () => {
      if (enginePollRef.current) { clearInterval(enginePollRef.current); enginePollRef.current = null; }
    };
  }, [timerActive, journeyStarted, trainData?.trainNo, stopTimerPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enginePollRef.current) clearInterval(enginePollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const autoInitializeFromBackend = async (): Promise<void> => {
    setAutoInitAttempted(true);

    try {
      console.log('🔧 Attempting auto-initialization from backend config...');

      // Check if backend is configured via global.RAC_CONFIG
      const configResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/config/current`);
      const config = await configResponse.json();

      if (config.success && config.data.isConfigured) {
        console.log('✅ Backend is configured, auto-initializing train...');
        console.log('   Train:', config.data.trainNo);
        console.log('   Date:', config.data.journeyDate);

        // Try to initialize train
        const response = await api.initializeTrain(config.data.trainNo, config.data.journeyDate);

        if (response.success) {
          console.log('✅ Train auto-initialized successfully!');
          await loadTrainState();
          setCurrentPage(prev => prev === 'config' ? 'home' : prev);
          // Resume timer if journey was in progress
          if (response.data?.journeyStarted) {
            startTimerPolling();
          }
        } else {
          console.warn('⚠️ Auto-initialization failed:', response.error);
        }
      } else {
        // ═══════════════════════════════════════════════════════════
        // FALLBACK: Backend not configured (e.g., after restart).
        // Use the train's saved config from MongoDB to re-setup + re-init.
        // ═══════════════════════════════════════════════════════════
        const trainNo = urlTrainNo || trainData?.trainNo;
        if (trainNo) {
          console.log(`🔄 Backend not configured — trying saved config for train ${trainNo}...`);
          try {
            const { getTrainConfig, setupConfig, initializeTrain } = await import('./services/apiWithErrorHandling');
            const configResult = await getTrainConfig(trainNo);
            if (configResult.success && configResult.data) {
              const cfg = configResult.data;
              console.log('✅ Found saved config, re-configuring backend...');

              // Step 1: Re-setup the backend (sets global.RAC_CONFIG)
              await setupConfig({
                stationsDb: cfg.stationsDb,
                stationsCollection: cfg.stationsCollection,
                passengersDb: cfg.passengersDb,
                passengersCollection: cfg.passengersCollection,
                trainNo: cfg.trainNo || trainNo,
                trainName: cfg.trainName || '',
                journeyDate: cfg.journeyDate || new Date().toISOString().split('T')[0],
              });

              // Step 2: Initialize train (restores state + auto-resumes engine)
              const initResult = await initializeTrain(
                cfg.trainNo || trainNo,
                cfg.journeyDate || new Date().toISOString().split('T')[0],
              );

              if (initResult.success) {
                console.log('✅ Train re-initialized from saved config!');
                await loadTrainState();
                setCurrentPage(prev => prev === 'config' ? 'home' : prev);
                // Resume timer if journey was in progress
                if (initResult.data?.journeyStarted) {
                  startTimerPolling();
                }
              } else {
                console.warn('⚠️ Re-initialization failed:', initResult.error);
              }
            } else {
              console.log('ℹ️ No saved config found — user will need to use config page');
            }
          } catch (fallbackErr: any) {
            console.warn('⚠️ Fallback auto-init error:', fallbackErr.message);
          }
        } else {
          console.log('ℹ️ Backend not configured and no trainNo — user will need to use config page');
        }
      }
    } catch (error: any) {
      console.warn('⚠️ Auto-initialization error:', error.message);
    }
  };

  // Store listener refs for targeted cleanup on unmount
  const wsListenersRef = useRef<{ event: string; callback: (...args: any[]) => void }[]>([]);

  const cleanupWebSocketListeners = (): void => {
    for (const { event, callback } of wsListenersRef.current) {
      wsService.off(event, callback);
    }
    wsListenersRef.current = [];
  };

  const setupWebSocket = (): void => {
    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';
    wsService.connect(WS_URL);

    // Remove any previously registered listeners from this component
    cleanupWebSocketListeners();

    // Helper to register and track listeners for cleanup on unmount
    const addListener = (event: string, cb: (...args: any[]) => void) => {
      wsService.on(event, cb);
      wsListenersRef.current.push({ event, callback: cb });
    };

    addListener('connected', () => {
      console.log('✅ WebSocket connected');
      setWsConnected(true);
      webSocketConnectedToast();
    });

    addListener('disconnected', () => {
      console.log('❌ WebSocket disconnected');
      setWsConnected(false);
      webSocketDisconnectedToast();
    });

    addListener('train_update', (data: WebSocketUpdateData) => {
      console.log('📡 Train update:', data.eventType);
      handleWebSocketUpdate(data);
    });

    addListener('station_arrival', (data: StationArrivalData) => {
      console.log(' Station arrival:', data.data.station);
      // Reset the countdown timer for the next station interval
      setTimerSeconds(TIMER_DURATION);
      loadTrainState();
    });

    addListener('rac_reallocation', (data: RACReallocationData) => {
      console.log('🎯 RAC reallocation:', data.data.totalAllocated);
      if (data.data.totalAllocated > 0) {
        alert(`✅ RAC Reallocation: ${data.data.totalAllocated} passengers upgraded!`);
      }
      loadTrainState();
    });

    addListener('no_show', (data: NoShowData) => {
      console.log('❌ No-show:', data.data.passenger.name);
      loadTrainState();
    });

    addListener('stats_update', (data: any) => {
      console.log('📊 Stats updated');
      if (trainData) {
        setTrainData(prev => ({
          ...prev,
          stats: data.data
        }));
      }
    });
  };

  const handleWebSocketUpdate = (data: WebSocketUpdateData): void => {
    switch (data.eventType) {
      case 'TRAIN_INITIALIZED':
        console.log('Train initialized via WebSocket');
        break;
      case 'JOURNEY_STARTED':
        setJourneyStarted(true);
        loadTrainState();
        break;
      case 'TRAIN_RESET':
        setJourneyStarted(false);
        loadTrainState();
        break;
      case 'JOURNEY_COMPLETE':
        alert('✅ Journey Complete!\n\n' +
          `Final Station: ${data.data.finalStation}\n` +
          `Total Deboarded: ${data.data.totalDeboarded}\n` +
          `RAC Upgraded: ${data.data.totalRACUpgraded}`);
        break;
      default:
        break;
    }
  };

  const handleInitialize = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.initializeTrain();

      if (response.success) {
        await loadTrainState();
      } else {
        setError(response.error || 'Failed to initialize');
        // Don't redirect to config  user can navigate there via menu if needed
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to initialize train';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadTrainState = async (): Promise<void> => {
    try {
      const tNo = urlTrainNo || trainData?.trainNo;
      const response = await api.getTrainState(tNo);

      if (response && response.success) {
        setTrainData(response.data);
        if (typeof response.data?.journeyStarted !== 'undefined') {
          setJourneyStarted(prev => prev || response.data.journeyStarted);
        }
      } else if (response && response.error) {
        setError(response.error);
      } else if (response && !response.success) {
        setError((response as any).message || 'Failed to load train state');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load train state');
    }
  };

  const handleStartJourney = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.startJourney(urlTrainNo || trainData?.trainNo);

      if (response.success) {
        setJourneyStarted(true);
        await loadTrainState();
        // Start polling the backend engine for countdown display
        startTimerPolling();
      } else {
        setError(response.error || 'Failed to start journey');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start journey');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStation = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.moveToNextStation(urlTrainNo || trainData?.trainNo);

      if (response.success) {
        await loadTrainState();

        alert(`✅ Processed Station: ${response.data.station}\n\n` +
          `Deboarded: ${response.data.deboarded}\n` +
          `No-Shows: ${response.data.noShows}\n` +
          `RAC Upgraded: ${response.data.racAllocated}\n` +
          `Boarded: ${response.data.boarded}\n\n` +
          `Current Onboard: ${response.data.stats.currentOnboard}\n` +
          `Vacant Berths: ${response.data.stats.vacantBerths}`);
      } else {
        setError(response.error || 'Failed to move');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to move to next station');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    if (!window.confirm('Are you sure you want to reset the train? All progress will be lost.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.resetTrain(urlTrainNo || trainData?.trainNo);

      if (response.success) {
        setJourneyStarted(false);
        setAutoInitAttempted(false);
        // Stop polling and reset countdown display
        stopTimerPolling();
        setTimerSeconds(TIMER_DURATION);
        await clearAppState(); // Clear persisted state on reset
        await loadTrainState();
        alert('✅ Train reset successfully!');
      } else {
        setError(response.error || 'Failed to reset');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset train');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkNoShow = async (pnr: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.markPassengerNoShow(pnr);

      if (response.success) {
        await loadTrainState();
        alert(`✅ ${response.data.name} marked as NO-SHOW\n\nBerth: ${response.data.berth}\nFrom: ${response.data.Boarding_Station} → ${response.data.Deboarding_Station}`);
      } else {
        alert(`❌ Error: ${response.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message || 'Failed to mark no-show'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (page: PageType): void => {
    setCurrentPage(page);
  };

  const handleLogout = async (): Promise<void> => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Clear the TrainDashboard configured flag so the config form shows
    // correctly when the user logs back in and opens the train again
    const logoutTrainNo = urlTrainNo || trainData?.trainNo;
    if (logoutTrainNo) {
      localStorage.removeItem(`rac_configured_${logoutTrainNo}`);
    }
    await clearAppState(); // Clear persisted state on logout
    setIsAuthenticated(false);
    setUser(null);
    setMenuOpen(false);
    setTrainData(null);
    setJourneyStarted(false);
    setAutoInitAttempted(false);
    setCurrentPage('config');
  };

  // Auto-start timer when page is refreshed and journey was already in progress
  useEffect(() => {
    if (stateRestored && journeyStarted && !timerActive) {
      // Check if not at last station before starting timer
      const stations = trainData?.stations || [];
      const currentStationIdx = trainData?.currentStationIdx || 0;
      const isLastStation =
        stations.length > 0 && currentStationIdx >= stations.length - 1;

      if (!isLastStation) {
        console.log(
          "[Timer] Auto-starting timer after page refresh (journey was in progress)",
        );
        setTimerActive(true);
        // Don't reset timer - keep it at 120 seconds for a fresh start after refresh
      }
    }
  }, [
    stateRestored,
    journeyStarted,
    timerActive,
    trainData?.stations,
    trainData?.currentStationIdx,
  ]);

  const handleClosePage = (): void => {
    // If on the standalone manual config route (/config), go back to landing page
    if (initialPage === 'config') {
      navigate('/');
      return;
    }
    setCurrentPage('home');
    loadTrainState();
  };

  // Show loading while state is being restored from IndexedDB and verified with backend
  // Show loading while state is being restored from IndexedDB and verified with backend
  if (!stateRestored) {
    return (
      <div className="App">
        <div className="app-header">
          <div className="header-content">
            <h1> RAC Reallocation System</h1>
            <h2>Restoring Session...</h2>
          </div>
        </div>
        <TrainTabBar />
        <div className="app-content">
          <div className="initialization-screen">
            <div className="init-card">
              <h3>Verifying State</h3>
              <div className="spinner-large"></div>
              <p>Syncing with backend...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showSignUp) {
      return <SignUpPage onSwitchToLogin={() => setShowSignUp(false)} />;
    }
    return <LoginPage onSwitchToSignUp={() => setShowSignUp(true)} />;
  }

  if (!trainData && loading) {
    return (
      <div className="App">
        <div className="app-header">
          <div className="header-content">
            <h1> RAC Reallocation System</h1>
            <h2>Loading Train Configuration...</h2>
          </div>
          <div className="user-menu">
            <button
              className="menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="menu-dropdown">
                <div className="menu-user-info">
                  <p>
                    <strong>{user?.username || "Admin"}</strong>
                  </p>
                  <p className="user-role">{user?.role || "ADMIN"}</p>
                </div>
                <hr />
                <button onClick={handleLogout} className="menu-item logout">
                  Logout
                </button>
                <hr />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/");
                  }}
                  className="menu-item"
                >
                  Exit to Landing
                </button>
              </div>
            )}
          </div>
        </div>
        <TrainTabBar />
        <div className="app-content">
          <div className="initialization-screen">
            <div className="init-card">
              <h3>Initializing Train...</h3>
              <div className="spinner-large"></div>
              <p>Loading train data from MongoDB</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === "config") {
    return (
      <div className="App app-classic">
        <div className="app-header">
          <div className="header-content">
            <h1> RAC Reallocation System</h1>
            <h2>Configuration</h2>
          </div>
        </div>
        <TrainTabBar />
        <div className="app-content">
          <ConfigPage
            onClose={handleClosePage}
            onApplySuccess={initialPage === 'config' ? (trainNo: string) => { window.location.href = `/train/${trainNo}`; } : undefined}
            loadTrainState={loadTrainState}
          />
        </div>
      </div>
    );
  }

  if (error && !trainData) {
    return (
      <div className="App">
        <div className="app-header">
          <div className="header-content">
            <h1> RAC Reallocation System</h1>
            <h2>Configuration Error</h2>
          </div>
        </div>
        <div className="app-content">
          <div className="initialization-screen">
            <div className="init-card error">
              <h3>? Initialization Failed</h3>
              <p>{error}</p>
              <button
                onClick={() => setCurrentPage("config")}
                className="btn-primary"
              >
                Open Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <ToastContainer />

      <div className="app-header">
        <div className="header-content">
          <h1> RAC Reallocation System</h1>
          {trainData && trainData.trainNo ? (
            <>
              <h2>
                {trainData.trainName || "Unknown"} (#{trainData.trainNo}) |{" "}
                {trainData.journeyDate || "N/A"}
              </h2>
              <p className="route">
                {trainData?.stations && trainData.stations.length > 0
                  ? `${trainData.stations[0]?.name || "Start"} ? ${trainData.stations[trainData.stations.length - 1]?.name || "End"}`
                  : "Loading stations..."}
              </p>
            </>
          ) : (
            <h2>Loading train configuration...</h2>
          )}
        </div>
        <div className="header-actions"></div>
        <div className="user-menu">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ?
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              <div className="menu-user-info">
                <p>
                  <strong>{user?.username || "Admin"}</strong>
                </p>
                <p className="user-role">{user?.role || "ADMIN"}</p>
              </div>
              <hr />
              <button
                onClick={() => {
                  setCurrentPage("config");
                  setMenuOpen(false);
                }}
                className="menu-item"
              >
                Configuration
              </button>
              <button onClick={handleLogout} className="menu-item logout">
                Logout
              </button>
              <hr />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/");
                }}
                className="menu-item"
              >
                Exit to Landing
              </button>
            </div>
          )}
        </div>
      </div>
      <TrainTabBar />

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}></button>
        </div>
      )}
      <div className="app-content">
        {currentPage === "home" && (
          <HomePage
            trainData={trainData}
            journeyStarted={journeyStarted}
            isJourneyComplete={
              !!(
                trainData &&
                trainData.currentStationIdx >= trainData.stations.length - 1 &&
                journeyStarted
              )
            }
            loading={loading}
            onStartJourney={handleStartJourney}
            onNextStation={handleNextStation}
            onReset={handleReset}
            onMarkNoShow={handleMarkNoShow}
            onNavigate={handleNavigate}
            timerSeconds={timerSeconds}
            timerActive={timerActive}
          />
        )}

        {currentPage === "rac-queue" && journeyStarted && (
          <RACQueuePage trainData={trainData} onClose={handleClosePage} />
        )}

        {currentPage === "coaches" && (
          <CoachesPage trainData={trainData} onClose={handleClosePage} />
        )}

        {currentPage === "passengers" && journeyStarted && (
          <PassengersPage
            trainData={trainData}
            onClose={handleClosePage}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === "visualization" && journeyStarted && (
          <VisualizationPage trainData={trainData} onClose={handleClosePage} />
        )}

        {currentPage === "add-passenger" && (
          <AddPassengerPage trainData={trainData} onClose={handleClosePage} />
        )}

        {currentPage === "phase1" && journeyStarted && (
          <PhaseOnePage onClose={handleClosePage} />
        )}

        {currentPage === "phase1" && !journeyStarted && (
          <div className="journey-not-started-container">
            <div className="journey-not-started-card">
              <div className="notice-icon"></div>
              <h2>Journey Not Started</h2>
              <p>
                The train journey hasn't begun yet. Please start the journey
                from the home page to access allocation features.
              </p>
              <button onClick={handleClosePage} className="home-btn">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Go to Home
              </button>
            </div>
          </div>
        )}

        {["rac-queue", "passengers", "reallocation", "visualization"].includes(
          currentPage,
        ) &&
          !journeyStarted && (
            <div className="journey-not-started-container">
              <div className="journey-not-started-card">
                <div className="notice-icon"></div>
                <h2>Journey Not Started</h2>
                <p>
                  The train journey hasn't begun yet. Please start the journey
                  from the home page to access allocation features.
                </p>
                <button onClick={handleClosePage} className="home-btn">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Go to Home
                </button>
              </div>
            </div>
          )}
      </div>

      <div className="app-footer">
        <p>
          &copy; 2025 RAC Reallocation System | Train{" "}
          {trainData?.trainNo || "N/A"} - {trainData?.trainName || "Unknown"} |
          Journey: {trainData?.journeyDate || "N/A"}
        </p>
      </div>
    </div>
  );
}

export default App;
