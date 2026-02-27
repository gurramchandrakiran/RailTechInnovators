// admin-portal/src/pages/LandingPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  listTrains,
  registerTrain,
  registerTTE,
  getTrainOverview,
} from "../services/apiWithErrorHandling";
import "../styles/pages/LandingPage.css";
import "../UserMenu.css";
import { successToast, errorToast } from "../services/toastNotification";
import TrainTabBar from "../components/TrainTabBar";

interface Train {
  trainNo: string;
  trainName: string;
  status: string;
  stationsCollection?: string;
  passengersCollection?: string;
  currentStation?: string;       // Station name (e.g. "Bhimavaram Town")
  currentStationIdx?: number;    // Station index (e.g. 4)
  totalStations?: number;
  createdAt?: Date;
  totalCoaches?: number;
  sleeperCoachesCount?: number;
  threeTierACCoachesCount?: number;
}

const LandingPage: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [overview, setOverview] = useState<Record<string, any>>({});

  // Add Train Modal State
  const [showAddTrainModal, setShowAddTrainModal] = useState(false);
  const [newTrainNo, setNewTrainNo] = useState("");
  const [newTrainName, setNewTrainName] = useState("");

  const [totalCoaches, setTotalCoaches] = useState("");
  const [sleeperCoachesCount, setSleeperCoachesCount] = useState("");
  const [threeTierACCoachesCount, setThreeTierACCoachesCount] = useState("");
  const [addingTrain, setAddingTrain] = useState(false);

  // Sign Up TTE Modal State
  const [showSignUpTTEModal, setShowSignUpTTEModal] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState("");
  const [tteName, setTteName] = useState("");
  const [tteEmployeeId, setTteEmployeeId] = useState("");
  const [ttePassword, setTtePassword] = useState("");
  const [ttePhone, setTtePhone] = useState("");
  const [tteEmail, setTteEmail] = useState("");
  const [createdTTE, setCreatedTTE] = useState<any>(null);
  const [signingUpTTE, setSigningUpTTE] = useState(false);

  // Load trains on mount + auto-refresh every 15 seconds
  useEffect(() => {
    loadTrains();
    const interval = setInterval(loadTrains, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadTrains = async () => {
    setLoading(true);
    const [trainResult, overviewResult] = await Promise.all([
      listTrains(),
      getTrainOverview(),
    ]);
    if (trainResult.success && trainResult.data) {
      setTrains(trainResult.data);
    } else {
      console.error("Failed to load trains:", trainResult.error);
    }
    if (overviewResult.success && overviewResult.data?.trains) {
      const map: Record<string, any> = {};
      for (const t of overviewResult.data.trains) {
        map[t.trainNo] = t;
      }
      setOverview(map);
    }
    setLoading(false);
  };

  const handleAddTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTrain(true);

    const result = await registerTrain(
      newTrainNo.trim(),
      newTrainName.trim(),
      totalCoaches ? Number(totalCoaches) : undefined,
      sleeperCoachesCount ? Number(sleeperCoachesCount) : undefined,
      threeTierACCoachesCount ? Number(threeTierACCoachesCount) : undefined,
    );
    if (result.success) {
      successToast(
        "Train Registered",
        `Train ${newTrainNo} added successfully!`,
      );
      setNewTrainNo("");
      setNewTrainName("");

      setTotalCoaches("");
      setSleeperCoachesCount("");
      setThreeTierACCoachesCount("");
      setShowAddTrainModal(false);
      loadTrains();
    } else {
      errorToast(
        "Registration Failed",
        result.error || "Failed to register train",
      );
    }
    setAddingTrain(false);
  };

  const handleSignUpTTE = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningUpTTE(true);

    const result = await registerTTE(
      selectedTrain,
      tteName.trim(),
      tteEmployeeId.trim(),
      ttePassword,
      ttePhone.trim() || undefined,
      tteEmail.trim() || undefined,
    );
    if (result.success && result.data?.user) {
      setCreatedTTE(result.data.user);
      successToast("TTE Created", `TTE ID: ${result.data.user.employeeId}`);
    } else {
      errorToast("TTE Creation Failed", result.error || "Failed to create TTE");
      setSigningUpTTE(false);
    }
  };

  const handleCloseTTEModal = () => {
    setShowSignUpTTEModal(false);
    setCreatedTTE(null);
    setSelectedTrain("");
    setTteName("");
    setTteEmployeeId("");
    setTtePassword("");
    setTtePhone("");
    setTteEmail("");
    setSigningUpTTE(false);
  };

  const handleOpenTrain = (trainNo: string) => {
    // Navigate to train dashboard with state flag — this flag does NOT survive browser refresh
    navigate(`/admin/train/${trainNo}`, { state: { fromLanding: true } });
  };

  const getStatusInfo = (
    status: string,
  ): { label: string; icon: string; badgeClass: string; cardClass: string } => {
    const statusMap: Record<
      string,
      { label: string; icon: string; badgeClass: string; cardClass: string }
    > = {
      RUNNING: {
        label: "Running",
        icon: "●",
        badgeClass: "status-running",
        cardClass: "status-running-card",
      },
      READY: {
        label: "Ready",
        icon: "●",
        badgeClass: "status-ready",
        cardClass: "status-ready-card",
      },
      REGISTERED: {
        label: "Not Init",
        icon: "◌",
        badgeClass: "status-not-init",
        cardClass: "status-not-init-card",
      },
      COMPLETE: {
        label: "Complete",
        icon: "✅",
        badgeClass: "status-complete",
        cardClass: "status-complete-card",
      },
    };
    return statusMap[status?.toUpperCase()] || statusMap["REGISTERED"];
  };

  const getCoachBreakdown = (train: Train) => {
    const badges = [];
    if (train.sleeperCoachesCount)
      badges.push(
        <span key="sl" className="coach-badge badge-sl">
          SL: {train.sleeperCoachesCount}
        </span>,
      );
    if (train.threeTierACCoachesCount)
      badges.push(
        <span key="3ac" className="coach-badge badge-3ac">
          3AC: {train.threeTierACCoachesCount}
        </span>,
      );
    return badges;
  };

  const [menuOpen, setMenuOpen] = useState(false);

  // Filtered trains — matches train number or name (case-insensitive)
  const filteredTrains = trains.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(t.trainNo).toLowerCase().includes(q) ||
      String(t.trainName || '').toLowerCase().includes(q)
    );
  });

  // Get user info from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-container">
        <div className="landing-header">
          <h1>🚂 RAC Reallocation System — Admin Control Center</h1>
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
                    <strong>{user?.name || user?.username || "Admin"}</strong>
                  </p>
                  <p className="user-role">{user?.role || "ADMIN"}</p>
                </div>
                <hr />
                <button onClick={handleLogout} className="menu-item logout">
                   Logout
                </button>
              </div>
            )}
          </div>
        </div>
        <TrainTabBar />

        {/* Actions Section */}
        <div className="actions-section">
          <h2 className="section-title">ACTIONS</h2>
          <div className="action-buttons">
            <button
              className="action-btn add-train-btn"
              onClick={() => setShowAddTrainModal(true)}
            >
              <span className="btn-icon">🚂</span> Add Train
            </button>
            <button
              className="action-btn signup-tte-btn"
              onClick={() => setShowSignUpTTEModal(true)}
            >
              <span className="btn-icon"></span> Sign Up TTE
            </button>
            <button
              className="action-btn stats-btn"
              onClick={() => navigate("/admin/config")}
            >
              <span className="btn-icon">⚙️</span> Manual Config
            </button>
          </div>
        </div>

        {/* Trains List */}
        <div className="trains-section">
          <div className="trains-section-header">
            <h2 className="section-title">
              TRAINS LIST
              {searchQuery && (
                <span className="search-result-count">
                  {filteredTrains.length} of {trains.length} trains
                </span>
              )}
            </h2>

            {/* Search bar */}
            <div className="train-search-row">
              <input
                type="text"
                className="train-search-field"
                placeholder="🔍  Search by train no. or name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="train-search-clear-btn"
                  onClick={() => setSearchQuery("")}
                >
                   Clear
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner">Loading trains…</div>
          ) : trains.length === 0 ? (
            <div className="empty-state">
              <p>No trains registered yet. Click "Add Train" to get started!</p>
            </div>
          ) : (
            <>
              {/* Table header row */}
              <div className="trains-table-header">
                <span></span>
                <span>Train</span>
                <span>Coaches</span>
                <span>Status</span>
                <span>Station</span>
                <span></span>
              </div>

              {/* Train rows */}
              <div className="trains-grid">
                {filteredTrains.length === 0 ? (
                  <div className="search-no-results">
                    <div className="search-no-results-icon">🔍</div>
                    <p>No trains found matching <strong>"{searchQuery}"</strong></p>
                    <button className="search-no-results-reset" onClick={() => setSearchQuery("")}>
                      Show all trains
                    </button>
                  </div>
                ) : null}
                {filteredTrains.map((train) => {
                  const si = getStatusInfo(train.status);
                  return (
                    <div
                      key={train.trainNo}
                      className={`train-card ${si.cardClass}`}
                      onClick={() => handleOpenTrain(train.trainNo)}
                    >
                      {/* Col 1 — Icon + Number */}
                      <div className="train-col-icon">
                        <span className="train-icon">🚂</span>
                        <span className="train-number">{train.trainNo}</span>
                      </div>

                      {/* Col 2 — Name */}
                      <div className="train-col-name">
                        <span className="train-name">{train.trainName}</span>
                        <span className="train-name-sub">
                          Express · Indian Railways
                        </span>
                      </div>

                      {/* Col 3 — Coaches */}
                      <div className="train-col-coaches">
                        {train.totalCoaches ? (
                          <>
                            <span className="coach-total">
                               {train.totalCoaches} coaches
                            </span>
                            <div className="coach-breakdown">
                              {getCoachBreakdown(train)}
                            </div>
                          </>
                        ) : (
                          <span className="train-info">—</span>
                        )}
                      </div>

                      {/* Col 4 — Status */}
                      <div className="train-col-status">
                        <span className={`status-badge ${si.badgeClass}`}>
                          {si.icon} {si.label}
                        </span>
                      </div>

                      {/* Col 5 — Station progress */}
                      <div className="train-col-station">
                        <span className="station-label">Station</span>
                        <span className="station-value">
                          {train.currentStation
                            ? train.currentStation
                            : "—"}
                          {train.totalStations && train.currentStationIdx != null
                            ? ` (${train.currentStationIdx + 1}/${train.totalStations})`
                            : ""}
                        </span>
                        {train.totalStations &&
                          train.currentStationIdx != null && (
                            <span className="station-progress">
                              {Math.round(
                                ((train.currentStationIdx + 1) / train.totalStations) *
                                100,
                              )}
                              % done
                            </span>
                          )}
                      </div>

                      {/* Col 6 — Action */}
                      <div className="train-col-action">
                        <button
                          className="open-train-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTrain(train.trainNo);
                          }}
                        >
                          Open ↗
                        </button>
                      </div>

                      {/* Overview Stats Row */}
                      {overview[train.trainNo] && (
                        <div className="train-overview-stats" onClick={(e) => e.stopPropagation()}>
                          <span className="overview-stat" title="TTEs assigned">
                             {overview[train.trainNo]?.ttes?.count ?? 0} TTE{(overview[train.trainNo]?.ttes?.count ?? 0) !== 1 ? 's' : ''}
                            {(overview[train.trainNo]?.ttes?.list?.length ?? 0) > 0 && (
                              <span className="overview-detail">
                                ({overview[train.trainNo].ttes.list.map((t: any) => t.name || t.employeeId).join(', ')})
                              </span>
                            )}
                          </span>
                          <span className="overview-stat" title="Total passengers">
                             {overview[train.trainNo]?.passengers?.total ?? 0} passengers
                          </span>
                        </div>
                      )
                      }
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Train Modal */}
      {
        showAddTrainModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowAddTrainModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-back-btn" onClick={() => setShowAddTrainModal(false)} title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2>Add New Train</h2>
              <form onSubmit={handleAddTrain}>
                <div className="form-group">
                  <label>Train Number</label>
                  <input
                    type="text"
                    value={newTrainNo}
                    onChange={(e) => setNewTrainNo(e.target.value)}
                    placeholder="e.g., 17225"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Train Name</label>
                  <input
                    type="text"
                    value={newTrainName}
                    onChange={(e) => setNewTrainName(e.target.value)}
                    placeholder="e.g., Amaravathi Express"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Total Coaches</label>
                  <input
                    type="number"
                    value={totalCoaches}
                    onChange={(e) => setTotalCoaches(e.target.value)}
                    placeholder="e.g., 16"
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>Sleeper Coaches</label>
                  <input
                    type="number"
                    value={sleeperCoachesCount}
                    onChange={(e) => setSleeperCoachesCount(e.target.value)}
                    placeholder="e.g., 9"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>3-Tier AC Coaches</label>
                  <input
                    type="number"
                    value={threeTierACCoachesCount}
                    onChange={(e) => setThreeTierACCoachesCount(e.target.value)}
                    placeholder="e.g., 2"
                    min="0"
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowAddTrainModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={addingTrain}
                  >
                    {addingTrain ? "Adding..." : "Add Train"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Sign Up TTE Modal */}
      {
        showSignUpTTEModal && (
          <div className="modal-overlay" onClick={handleCloseTTEModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-back-btn" onClick={handleCloseTTEModal} title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2>Sign Up TTE</h2>
              {createdTTE ? (
                <div className="tte-success">
                  <div className="success-icon">✅</div>
                  <h3>TTE Created Successfully!</h3>
                  <div className="tte-details">
                    <p>
                      <strong>TTE ID:</strong> {createdTTE.employeeId}
                    </p>
                    <p>
                      <strong>Name:</strong> {createdTTE.name}
                    </p>
                    <p>
                      <strong>Train:</strong> {createdTTE.trainAssigned}
                    </p>
                    <p>
                      <strong>Password:</strong> {createdTTE.defaultPassword}
                    </p>
                  </div>
                  <p className="note">
                    ⚠️ Please share these credentials with the TTE
                  </p>
                  <button className="btn-submit" onClick={handleCloseTTEModal}>
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSignUpTTE}>
                  <div className="form-group">
                    <label>Select Train</label>
                    <select
                      value={selectedTrain}
                      onChange={(e) => setSelectedTrain(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Train --</option>
                      {trains.map((train) => (
                        <option key={train.trainNo} value={train.trainNo}>
                          {train.trainNo} - {train.trainName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>TTE Name</label>
                    <input
                      type="text"
                      value={tteName}
                      onChange={(e) => setTteName(e.target.value)}
                      placeholder="e.g., Ravi Kumar"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Employee ID</label>
                    <input
                      type="text"
                      value={tteEmployeeId}
                      onChange={(e) => setTteEmployeeId(e.target.value)}
                      placeholder="e.g., TTE_001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={ttePassword}
                      onChange={(e) => setTtePassword(e.target.value)}
                      placeholder="Enter password for TTE"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone <span style={{ color: '#999', fontWeight: 'normal' }}>(optional)</span></label>
                    <input
                      type="tel"
                      value={ttePhone}
                      onChange={(e) => setTtePhone(e.target.value)}
                      placeholder="e.g., 9876543210"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email <span style={{ color: '#999', fontWeight: 'normal' }}>(optional)</span></label>
                    <input
                      type="email"
                      value={tteEmail}
                      onChange={(e) => setTteEmail(e.target.value)}
                      placeholder="e.g., tte@railway.com"
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={handleCloseTTEModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-submit"
                      disabled={signingUpTTE}
                    >
                      {signingUpTTE ? "Creating..." : "Sign Up TTE"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
};

export default LandingPage;
