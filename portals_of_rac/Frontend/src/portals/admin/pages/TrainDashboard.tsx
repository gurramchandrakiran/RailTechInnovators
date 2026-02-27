// admin-portal/src/pages/TrainDashboard.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getTrainConfig,
  setupConfig,
  initializeTrain,
  updateTrainConfig,
} from "../services/apiWithErrorHandling";
import { errorToast, successToast } from "../services/toastNotification";
import TrainApp from "../TrainApp";
import { addTrainTab } from "../components/TrainTabBar";
import TrainTabBar from "../components/TrainTabBar";
import "../styles/pages/ConfigPage.css";
import "../styles/pages/TrainDashboard.css";

interface TrainConfig {
  mongoUri?: string;
  stationsDb?: string;
  stationsCollection?: string;
  passengersDb?: string;
  passengersCollection?: string;
  trainDetailsDb?: string;
  trainDetailsCollection?: string;
  trainNo?: string;
  trainName?: string;
  journeyDate?: string;
}

const TrainDashboard: React.FC<{ initialPage?: string }> = ({
  initialPage,
}) => {
  const { trainNo } = useParams<{ trainNo?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromLanding = (location.state as any)?.fromLanding === true;
  const fromTab = (location.state as any)?.fromTab === true;

  // CRITICAL: Clear location.state immediately so fromLanding doesn't survive browser refresh.
  // React Router v6 stores location.state in history.state, which persists across page reloads.
  useEffect(() => {
    if (fromLanding) {
      window.history.replaceState({}, "", location.pathname);
    }
  }, []);

  // Core state
  const [trainConfig, setTrainConfig] = useState<TrainConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [applying, setApplying] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Editable field state (mirrors trainConfig + journeyDate)
  const [editTrainNo, setEditTrainNo] = useState("");
  const [editTrainName, setEditTrainName] = useState("");
  const [editJourneyDate, setEditJourneyDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [editStationsDb, setEditStationsDb] = useState("");
  const [editStationsCollection, setEditStationsCollection] = useState("");
  const [editPassengersDb, setEditPassengersDb] = useState("");
  const [editPassengersCollection, setEditPassengersCollection] = useState("");

  // Edit mode toggle
  const [isEditing, setIsEditing] = useState(false);

  // Snapshot for cancel
  const [snapshot, setSnapshot] = useState<Record<string, string>>({});

  // ── Populate editable fields whenever trainConfig loads ──────────────────
  useEffect(() => {
    if (!trainConfig) return;
    const date =
      trainConfig.journeyDate || new Date().toISOString().split("T")[0];
    setEditTrainNo(trainConfig.trainNo || trainNo || "");
    setEditTrainName(trainConfig.trainName || "");
    setEditJourneyDate(date);
    setEditStationsDb(trainConfig.stationsDb || "");
    setEditStationsCollection(trainConfig.stationsCollection || "");
    setEditPassengersDb(trainConfig.passengersDb || "");
    setEditPassengersCollection(trainConfig.passengersCollection || "");
  }, [trainConfig]);

  // ── Boot: check existing state or fetch config ───────────────────────────
  useEffect(() => {
    if (initialPage === "config") {
      setConfigured(true);
      setLoadingConfig(false);
      return;
    }

    const checkExistingState = async () => {
      // Tab-switch: skip config, go straight to home
      if (fromTab && trainNo) {
        console.log("[TrainDashboard] Tab switch for train", trainNo, "— skipping config");
        window.history.replaceState({}, "", location.pathname);
        // Auto-initialize from saved MongoDB config
        try {
          const configResult = await getTrainConfig(trainNo);
          if (configResult.success && configResult.data) {
            const cfg = configResult.data;
            await setupConfig({
              stationsDb: cfg.stationsDb,
              stationsCollection: cfg.stationsCollection,
              passengersDb: cfg.passengersDb,
              passengersCollection: cfg.passengersCollection,
              trainNo: cfg.trainNo || trainNo,
              trainName: cfg.trainName || "",
              journeyDate: cfg.journeyDate || new Date().toISOString().split("T")[0],
            });
            await initializeTrain(
              cfg.trainNo || trainNo,
              cfg.journeyDate || new Date().toISOString().split("T")[0],
            );
          }
        } catch (err) {
          console.warn("[TrainDashboard] Tab-switch auto-init failed:", err);
        }
        setConfigured(true);
        setLoadingConfig(false);
        return;
      }

      // Determine if we should show config page:
      // 1. Coming from landing page (fromLanding state)
      // 2. OR localStorage says we were on config page before refresh
      const pageStateKey = `trainPage_${trainNo}`;
      const savedPage = localStorage.getItem(pageStateKey);
      const shouldShowConfig = fromLanding || savedPage === 'config';

      if (shouldShowConfig && trainNo) {
        // Save that we're on config page (survives refresh)
        localStorage.setItem(pageStateKey, 'config');
        console.log("[TrainDashboard] Showing config page for train", trainNo);
        fetchTrainConfig(trainNo);
        return;
      }

      // Browser refresh on home page — auto-initialize and go straight to home
      if (trainNo) {
        console.log("[TrainDashboard] Browser refresh for train", trainNo, "— auto-initializing");

        // Step 1: Check if train is already initialized on backend
        try {
          const { getTrainState } = await import("../services/apiWithErrorHandling");
          const stateRes = await getTrainState(trainNo);
          if (stateRes?.success && stateRes.data?.trainNo && stateRes.data?.initialized !== false) {
            console.log("[TrainDashboard] Train already initialized in memory — skipping config");
            setConfigured(true);
            setLoadingConfig(false);
            return;
          }
        } catch {
          // Backend might be down — continue to auto-reinit
        }

        // Step 2: Try auto-reinitialize from saved MongoDB config
        try {
          const configResult = await getTrainConfig(trainNo);
          if (configResult.success && configResult.data) {
            const cfg = configResult.data;
            console.log("[TrainDashboard] Found saved config, auto-initializing...");
            setTrainConfig(cfg);
            await setupConfig({
              stationsDb: cfg.stationsDb,
              stationsCollection: cfg.stationsCollection,
              passengersDb: cfg.passengersDb,
              passengersCollection: cfg.passengersCollection,
              trainNo: cfg.trainNo || trainNo,
              trainName: cfg.trainName || "",
              journeyDate: cfg.journeyDate || new Date().toISOString().split("T")[0],
            });
            await initializeTrain(
              cfg.trainNo || trainNo,
              cfg.journeyDate || new Date().toISOString().split("T")[0],
            );
            console.log("[TrainDashboard] Auto-initialized from saved config");
          }
        } catch (err) {
          console.warn("[TrainDashboard] Auto-reinitialize failed (non-blocking):", err);
        }

        // ALWAYS proceed to TrainApp on refresh
        setConfigured(true);
        setLoadingConfig(false);
        return;
      }
    };

    checkExistingState();
  }, [trainNo, initialPage]);

  const fetchTrainConfig = async (trainNumber: string) => {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const result = await getTrainConfig(trainNumber);
      if (result.success && result.data) {
        setTrainConfig(result.data);
      } else {
        setConfigError(
          "Failed to load train configuration. Train may not be registered.",
        );
      }
    } catch (error: any) {
      setConfigError(error.message || "Failed to fetch train configuration");
    } finally {
      setLoadingConfig(false);
    }
  };

  // ── Edit helpers ─────────────────────────────────────────────────────────
  const enterEditMode = () => {
    setSnapshot({
      editTrainNo,
      editTrainName,
      editJourneyDate,
      editStationsDb,
      editStationsCollection,
      editPassengersDb,
      editPassengersCollection,
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditTrainNo(snapshot.editTrainNo);
    setEditTrainName(snapshot.editTrainName);
    setEditJourneyDate(snapshot.editJourneyDate);
    setEditStationsDb(snapshot.editStationsDb);
    setEditStationsCollection(snapshot.editStationsCollection);
    setEditPassengersDb(snapshot.editPassengersDb);
    setEditPassengersCollection(snapshot.editPassengersCollection);
    setIsEditing(false);
  };

  const saveEdit = () => {
    // Persist edits back into trainConfig so Apply uses them
    setTrainConfig((prev) => ({
      ...prev,
      trainNo: editTrainNo,
      trainName: editTrainName,
      journeyDate: editJourneyDate,
      stationsDb: editStationsDb,
      stationsCollection: editStationsCollection,
      passengersDb: editPassengersDb,
      passengersCollection: editPassengersCollection,
    }));
    setIsEditing(false);
  };

  // ── Apply configuration ──────────────────────────────────────────────────
  const handleApplyConfig = async () => {
    setApplying(true);
    setConfigError(null);
    try {
      const targetTrainNo = editTrainNo || trainNo || "";

      // Step 1 — Persist edits ONLY to this train's MongoDB document.
      // This guarantees other trains are never touched in a multi-train setup.
      const persistResult = await updateTrainConfig(targetTrainNo, {
        trainName: editTrainName,
        stationsCollection: editStationsCollection,
        passengersCollection: editPassengersCollection,
        stationsDb: editStationsDb,
        passengersDb: editPassengersDb,
        journeyDate: editJourneyDate,
      });
      if (!persistResult.success) {
        throw new Error(
          persistResult.error ||
          `Failed to save configuration for train ${targetTrainNo}`,
        );
      }

      // Step 2 — Set the in-memory session config on the backend (global.RAC_CONFIG).
      // This is per-request / per-session and only affects the currently active train.
      const setupPayload = {
        stationsDb: editStationsDb,
        stationsCollection: editStationsCollection,
        passengersDb: editPassengersDb,
        passengersCollection: editPassengersCollection,
        trainNo: targetTrainNo,
        trainName: editTrainName,
        journeyDate: editJourneyDate,
      };

      const setupResult = await setupConfig(setupPayload);
      if (!setupResult.success) {
        throw new Error("Failed to apply session configuration");
      }

      // Step 3 — Initialize train state from the now-correct collections.
      const initResult = await initializeTrain(targetTrainNo, editJourneyDate);
      if (!initResult.success) {
        throw new Error("Failed to initialize train");
      }

      successToast(
        "Train Ready",
        `Train ${targetTrainNo} configured successfully!`,
      );
      await new Promise((resolve) => setTimeout(resolve, 400));
      // Clear config page state — user is now on home, refresh should stay on home
      localStorage.removeItem(`trainPage_${trainNo}`);
      // Add to train tab bar
      addTrainTab(targetTrainNo, editTrainName);
      window.dispatchEvent(new Event('trainTabsChanged'));
      // Switch to TrainApp view (don't navigate — URL is already correct)
      setConfigured(true);
    } catch (error: any) {
      setConfigError(error.message || "Configuration failed");
      errorToast("Error", error.message || "Failed to configure train");
    } finally {
      setApplying(false);
    }
  };

  // ── Render: configured ───────────────────────────────────────────────────
  if (configured) {
    return <TrainApp initialPage={initialPage} />;
  }

  // ── Render: loading ──────────────────────────────────────────────────────
  if (loadingConfig) {
    return (
      <div className="App">
        <div className="app-header">
          <div className="header-content">
            <h1>🚂 RAC Reallocation System</h1>
            <h2>Loading Train {trainNo}…</h2>
          </div>
        </div>
        <TrainTabBar />
        <div className="app-content">
          <div className="initialization-screen">
            <div className="init-card">
              <h3>Fetching Train Details</h3>
              <div className="spinner-large"></div>
              <p>Loading configuration for train {trainNo}…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: setup screen ─────────────────────────────────────────────────
  return (
    <div className="App">
      <div className="app-header">
        <div className="header-content">
          <h1>🚂 RAC Reallocation System</h1>

        </div>
      </div>
      <TrainTabBar />

      <div className="app-content">
        <div className="config-page">
          {/* ── Page header ── */}
          <div className="page-header">
            <button
              className="back-btn"
              onClick={() => navigate("/admin")}
              disabled={applying}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="20"
                height="20"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h2>⚙️ Train Configuration</h2>
          </div>

          {configError && <div className="error-banner">{configError}</div>}

          <div className="config-form">
            {/* ════════════════════════════════════════════════
                            COMBINED SECTION — Train Details + Date + Apply
                        ════════════════════════════════════════════════ */}
            <div className="form-section combined-section">
              {/* Section title + Edit / Save / Cancel */}
              <div className="combined-section-header">
                <h3>🚂 Train Details &amp; Configuration</h3>
                {!isEditing ? (
                  <button
                    type="button"
                    className="btn-edit"
                    onClick={enterEditMode}
                    disabled={applying}
                    title="Edit all configuration fields"
                  >
                    ✏️ Edit
                  </button>
                ) : (
                  <div className="edit-action-btns">
                    <button
                      type="button"
                      className="btn-save-edit"
                      onClick={saveEdit}
                    >
                      ✅ Save
                    </button>
                    <button
                      type="button"
                      className="btn-cancel-edit"
                      onClick={cancelEdit}
                    >
                       Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* ── Train identity row ── */}
              <div className="train-info-grid">
                {/* Train Number */}
                <div className="info-row">
                  <span className="info-label">Train Number</span>
                  {isEditing ? (
                    <input
                      className="info-input"
                      type="text"
                      value={editTrainNo}
                      onChange={(e) => setEditTrainNo(e.target.value)}
                      placeholder="e.g. 17225"
                      maxLength={10}
                    />
                  ) : (
                    <span className="info-value">{editTrainNo || "—"}</span>
                  )}
                </div>

                {/* Train Name */}
                <div className="info-row">
                  <span className="info-label">Train Name</span>
                  {isEditing ? (
                    <input
                      className="info-input"
                      type="text"
                      value={editTrainName}
                      onChange={(e) => setEditTrainName(e.target.value)}
                      placeholder="e.g. Amaravathi Express"
                    />
                  ) : (
                    <span className="info-value">{editTrainName || "—"}</span>
                  )}
                </div>
              </div>

              {/* ── Divider ── */}
              <div className="config-divider">
                <span>Database Configuration</span>
              </div>

              {/* ── DB config grid ── */}
              <div className="train-info-grid">
                {/* Stations DB */}
                <div className="info-row">
                  <span className="info-label">Stations DB</span>
                  {isEditing ? (
                    <input
                      className="info-input"
                      type="text"
                      value={editStationsDb}
                      onChange={(e) => setEditStationsDb(e.target.value)}
                      placeholder="e.g. rac"
                    />
                  ) : (
                    <span className="info-value">{editStationsDb || "—"}</span>
                  )}
                </div>

                {/* Stations Collection */}
                <div className="info-row">
                  <span className="info-label">Stations Collection</span>
                  {isEditing ? (
                    <input
                      className="info-input"
                      type="text"
                      value={editStationsCollection}
                      onChange={(e) =>
                        setEditStationsCollection(e.target.value)
                      }
                      placeholder="e.g. 17225_stations"
                    />
                  ) : (
                    <span className="info-value">
                      {editStationsCollection || "—"}
                    </span>
                  )}
                </div>

                {/* Passengers DB */}
                <div className="info-row">
                  <span className="info-label">Passengers DB</span>
                  {isEditing ? (
                    <input
                      className="info-input"
                      type="text"
                      value={editPassengersDb}
                      onChange={(e) => setEditPassengersDb(e.target.value)}
                      placeholder="e.g. PassengersDB"
                    />
                  ) : (
                    <span className="info-value">
                      {editPassengersDb || "—"}
                    </span>
                  )}
                </div>

                {/* Passengers Collection */}
                <div className="info-row">
                  <span className="info-label">Passengers Collection</span>
                  {isEditing ? (
                    <input
                      className="info-input"
                      type="text"
                      value={editPassengersCollection}
                      onChange={(e) =>
                        setEditPassengersCollection(e.target.value)
                      }
                      placeholder="e.g. 17225_passengers"
                    />
                  ) : (
                    <span className="info-value">
                      {editPassengersCollection || "—"}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Journey Date — always editable, shown last ── */}
              <div className="train-info-grid" style={{ marginTop: "10px" }}>
                <div className="info-row info-row-date">
                  <span className="info-label"> Journey Date</span>
                  <input
                    className="info-input"
                    type="date"
                    value={editJourneyDate}
                    onChange={(e) => setEditJourneyDate(e.target.value)}
                    disabled={applying}
                  />
                </div>
              </div>

              {/* ── Apply button (always visible inside the section) ── */}
              <div className="form-actions combined-apply">
                <button
                  type="button"
                  className="btn-apply"
                  onClick={handleApplyConfig}
                  disabled={applying || !editTrainNo || isEditing}
                  title={
                    isEditing ? "Save your edits first before applying" : ""
                  }
                >
                  {applying ? "⏳ Applying…" : "🚀 Apply Configuration"}
                </button>
                {isEditing && (
                  <span className="apply-hint">
                    Save your edits first to apply
                  </span>
                )}
              </div>
            </div>
            {/* end combined-section */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainDashboard;
