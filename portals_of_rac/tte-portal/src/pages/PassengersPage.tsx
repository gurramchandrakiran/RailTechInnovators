// tte-portal/src/pages/PassengersPage.tsx
// Updated to fix export issue

import React, { useState, useEffect, FocusEvent, ChangeEvent } from "react";
import { tteAPI } from "../api";
import "../styles/pages/PassengersPage.css";

interface Passenger {
    pnr: string;
    name: string;
    age?: number;
    gender?: string;
    pnrStatus: string;
    racStatus?: string;
    class?: string;
    coach?: string;
    berth?: string;
    from: string;
    to: string;
    fromIdx?: number;
    toIdx?: number;
    passengerStatus?: string;
    boarded: boolean;
    noShow: boolean;
}

interface VacantBerth {
    coach: string;
    berthNo: string;
    fullBerthNo: string;
    type: string;
    class: string;
    currentStation: string;
    currentStationCode: string;
    vacantFromStation: string;
    vacantToStation: string;
    vacantFromStationCode: string;
    vacantToStationCode: string;
    vacantFromStationName?: string;
    vacantToStationName?: string;
    willOccupyAt: string;
    isCurrentlyVacant: boolean;
}

interface Station {
    code: string;
    name: string;
}

interface Coach {
    coachNo: string;
    [key: string]: any;
}

interface TrainData {
    stations: Station[];
    currentStationIdx: number;
    journeyStarted: boolean;
    coaches?: Coach[];
}

interface Counts {
    total: number;
    cnf: number;
    rac: number;
    boarded: number;
    noShow: number;
    online: number;
    offline: number;
}

interface PassengerStatusButtonProps {
    passenger: Passenger;
    onStatusUpdate: (pnr: string, status: string) => Promise<void>;
}

// Passenger Status Button Component
function PassengerStatusButton({ passenger, onStatusUpdate }: PassengerStatusButtonProps): React.ReactElement {
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const [showButtons, setShowButtons] = useState<boolean>(false);

    const currentStatus = passenger.passengerStatus || 'Offline';

    const handleToggle = async (newStatus: string): Promise<void> => {
        setIsUpdating(true);
        try {
            await onStatusUpdate(passenger.pnr, newStatus);
            setShowButtons(false);
        } catch (error) {
            console.error('Failed to update status:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    if (showButtons) {
        return (
            <div className="status-buttons-container">
                <button
                    onClick={() => handleToggle('online')}
                    disabled={isUpdating}
                    className="status-btn online-btn"
                >
                    Online
                </button>
                <button
                    onClick={() => handleToggle('offline')}
                    disabled={isUpdating}
                    className="status-btn offline-btn"
                >
                    Offline
                </button>
                <button
                    onClick={() => setShowButtons(false)}
                    className="status-btn cancel-btn"
                >
                    ✕
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => setShowButtons(true)}
            disabled={isUpdating}
            className={`current-status-btn ${currentStatus.toLowerCase()}`}
        >
            {currentStatus}
        </button>
    );
}

function PassengersPage(): React.ReactElement {
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [filteredPassengers, setFilteredPassengers] = useState<Passenger[]>([]);
    const [counts, setCounts] = useState<Counts | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [trainData, setTrainData] = useState<TrainData | null>(null);

    const [searchPNR, setSearchPNR] = useState<string>("");
    const [searchCoach, setSearchCoach] = useState<string>("");
    const [searchBerth, setSearchBerth] = useState<string>(""); // Berth filter (e.g., S1-4)
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [showVacantBerths, setShowVacantBerths] = useState<boolean>(false);
    const [vacantBerths, setVacantBerths] = useState<VacantBerth[]>([]);
    const [filteredVacantBerths, setFilteredVacantBerths] = useState<VacantBerth[]>([]);
    const [vacantFromStation, setVacantFromStation] = useState<string>("");
    const [vacantToStation, setVacantToStation] = useState<string>("");
    const [vacantCoach, setVacantCoach] = useState<string>("");
    const [vacantBerthSearch, setVacantBerthSearch] = useState<string>(""); // Berth filter for vacant berths

    // ✅ NEW: Multi-Passenger Grouping State
    const [expandedPNRs, setExpandedPNRs] = useState<Set<string>>(new Set());

    // ✅ NEW: Group passengers by PNR
    const groupPassengersByPNR = (passengerList: Passenger[]): Map<string, Passenger[]> => {
        const groups = new Map<string, Passenger[]>();
        passengerList.forEach(p => {
            const existing = groups.get(p.pnr) || [];
            groups.set(p.pnr, [...existing, p]);
        });
        return groups;
    };

    const togglePNRExpansion = (pnr: string): void => {
        setExpandedPNRs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pnr)) {
                newSet.delete(pnr);
            } else {
                newSet.add(pnr);
            }
            return newSet;
        });
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
        calculateVacantBerths();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [passengers, searchPNR, searchCoach, searchBerth, filterStatus, trainData]);

    useEffect(() => {
        filterVacantBerths();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vacantBerths, vacantFromStation, vacantToStation, vacantCoach, vacantBerthSearch]);

    const calculateVacantBerths = async (): Promise<void> => {
        if (!trainData || !trainData.coaches || !trainData.journeyStarted) {
            setVacantBerths([]);
            return;
        }

        try {
            // Fetch vacant berths from backend API using tteAPI
            const data = await tteAPI.getVacantBerths();

            console.log('🔍 TTE Portal - Vacant Berths API Response (ALL segments):', data);

            if (data.success && data.data && data.data.vacancies) {
                // TTE Portal: Filter to show ONLY vacant berths at current station
                const currentStationName = trainData.stations[trainData.currentStationIdx]?.name || "N/A";

                const vacant: VacantBerth[] = data.data.vacancies
                    .filter((berth: any) => berth.isCurrentlyVacant) // Only show berths vacant NOW at current station
                    .map((berth: any) => {
                        console.log('📦 TTE Portal - Current station vacant berth:', berth.fullBerthNo,
                            `Vacant at: ${currentStationName}`);

                        return {
                            coach: berth.coachNo,
                            berthNo: berth.berthNo,
                            fullBerthNo: berth.fullBerthNo,
                            type: berth.type,
                            class: berth.class,
                            currentStation: currentStationName,
                            currentStationCode: trainData.stations[trainData.currentStationIdx]?.code || "",
                            vacantFromStation: berth.vacantFromStation,
                            vacantToStation: berth.vacantToStation,
                            vacantFromStationCode: berth.vacantFromStationCode || berth.vacantFromStation,
                            vacantToStationCode: berth.vacantToStationCode || berth.vacantToStation,
                            willOccupyAt: berth.willOccupyAt,
                            isCurrentlyVacant: berth.isCurrentlyVacant
                        };
                    });

                console.log('✅ TTE Portal - Current station vacant berths:', vacant.length);
                setVacantBerths(vacant);
            } else {
                setVacantBerths([]);
            }
        } catch (error) {
            console.error('TTE Portal - Error fetching vacant berths:', error);
            setVacantBerths([]);
        }
    };

    const filterVacantBerths = (): void => {
        let filtered = [...vacantBerths];

        // Filter by berth number (e.g., S1-4, B2-37)
        if (vacantBerthSearch.trim()) {
            const searchTerm = vacantBerthSearch.toLowerCase();
            filtered = filtered.filter(
                (berth) => berth.fullBerthNo?.toLowerCase().includes(searchTerm)
            );
        }

        // Filter by coach (case-insensitive)
        if (vacantCoach.trim()) {
            const searchTerm = vacantCoach.toLowerCase();
            filtered = filtered.filter(
                (berth) => berth.coach?.toLowerCase().includes(searchTerm)
            );
        }

        // Filter by "from" station (check both code and name, case-insensitive)
        if (vacantFromStation.trim()) {
            const searchTerm = vacantFromStation.toLowerCase();
            filtered = filtered.filter(
                (berth) =>
                    berth.vacantFromStation?.toLowerCase().includes(searchTerm) ||
                    berth.vacantFromStationName?.toLowerCase().includes(searchTerm) ||
                    berth.vacantFromStationCode?.toLowerCase().includes(searchTerm)
            );
        }

        // Filter by "to" station (check both code and name, case-insensitive)
        if (vacantToStation.trim()) {
            const searchTerm = vacantToStation.toLowerCase();
            filtered = filtered.filter(
                (berth) =>
                    berth.vacantToStation?.toLowerCase().includes(searchTerm) ||
                    berth.vacantToStationName?.toLowerCase().includes(searchTerm) ||
                    berth.vacantToStationCode?.toLowerCase().includes(searchTerm)
            );
        }

        setFilteredVacantBerths(filtered);
    };

    const loadData = async (): Promise<void> => {
        try {
            setLoading(true);
            console.log('🔄 TTE PassengersPage - Starting data load...');

            // TTE API structure - fetch passengers AND train state
            const [passengersRes, trainStateRes] = await Promise.all([
                tteAPI.getPassengers({}),
                tteAPI.getTrainState()
            ]);

            console.log('📦 Passengers Response:', passengersRes);
            console.log('📦 Train State Response:', trainStateRes);

            if (passengersRes.success) {
                const allPassengers = passengersRes.data.passengers || [];
                console.log(`✅ Setting ${allPassengers.length} passengers`);
                setPassengers(allPassengers);

                // Calculate counts from data
                const newCounts: Counts = {
                    total: allPassengers.length,
                    cnf: allPassengers.filter((p: Passenger) => p.pnrStatus === 'CNF').length,
                    rac: allPassengers.filter((p: Passenger) => p.pnrStatus === 'RAC').length,
                    boarded: allPassengers.filter((p: Passenger) => p.boarded && !p.noShow).length,
                    noShow: allPassengers.filter((p: Passenger) => p.noShow).length,
                    online: allPassengers.filter((p: Passenger) => p.passengerStatus?.toLowerCase() === 'online').length,
                    offline: allPassengers.filter((p: Passenger) => !p.passengerStatus || p.passengerStatus.toLowerCase() === 'offline').length
                };
                console.log('📊 Counts:', newCounts);
                setCounts(newCounts);
            } else {
                console.error('❌ Passengers API failed:', passengersRes);
            }

            if (trainStateRes.success) {
                console.log('✅ Train state set');
                setTrainData(trainStateRes.data);
            } else {
                console.error('❌ Train state API failed:', trainStateRes);
            }
        } catch (error) {
            console.error("❌ Error loading data:", error);
        } finally {
            setLoading(false);
            console.log('✅ Load complete');
        }
    };

    const handleStatusUpdate = async (_pnr: string, _status: string): Promise<void> => {
        try {
            // TTE API doesn't have setPassengerStatus - skip for now
            alert('Status update not available in TTE portal yet');
            // await tteAPI.setPassengerStatus(pnr, status);
            // await loadData();
        } catch (error) {
            console.error('Error updating passenger status:', error);
            alert('Failed to update passenger status');
        }
    };

    const applyFilters = (): void => {
        let filtered = [...passengers];

        // Search by PNR
        if (searchPNR.trim()) {
            filtered = filtered.filter((p) =>
                String(p.pnr).includes(searchPNR.trim()),
            );
        }

        // Search by Coach
        if (searchCoach.trim()) {
            filtered = filtered.filter((p) =>
                p.coach?.toLowerCase().includes(searchCoach.trim().toLowerCase()),
            );
        }

        // Search by Berth (e.g., S1-4, B2-37)
        if (searchBerth.trim()) {
            filtered = filtered.filter((p) =>
                p.berth?.toLowerCase().includes(searchBerth.trim().toLowerCase()),
            );
        }

        // Filter by status
        switch (filterStatus) {
            case "cnf":
                filtered = filtered.filter((p) => p.pnrStatus === "CNF");
                break;
            case "rac":
                filtered = filtered.filter((p) => p.pnrStatus === "RAC");
                break;
            case "boarded":
                filtered = filtered.filter((p) => p.boarded === true && !p.noShow);
                break;
            case "no-show":
                filtered = filtered.filter((p) => p.noShow === true);
                break;
            case "online":
                filtered = filtered.filter((p) => p.passengerStatus && p.passengerStatus.toLowerCase() === 'online');
                break;
            case "offline":
                filtered = filtered.filter((p) => !p.passengerStatus || p.passengerStatus.toLowerCase() === 'offline');
                break;
            case "upcoming":
                filtered = filtered.filter(
                    (p) =>
                        trainData && p.fromIdx !== undefined &&
                        p.fromIdx > trainData.currentStationIdx && !p.noShow && !p.boarded,
                );
                break;
            default:
                break;
        }

        setFilteredPassengers(filtered);
    };

    const handleInputFocus = (e: FocusEvent<HTMLInputElement>): void => {
        e.target.style.borderColor = '#3498db';
    };

    const handleInputBlur = (e: FocusEvent<HTMLInputElement>): void => {
        e.target.style.borderColor = '#e1e8ed';
    };

    if (loading) {
        return (
            <div className="passengers-page">
                <div className="page-header">
                    <h2>👥 Passenger List</h2>
                </div>
                <div className="loading-container">
                    <div className="spinner-large"></div>
                    <p>Loading passengers...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="passengers-page">
            <div className="page-header">
                <h2>
                    👥 Passenger List ({counts ? counts.total : passengers.length} total)
                </h2>
            </div>

            {/* Statistics - Compact */}
            {counts && (
                <div className="pass-stats">
                    <div className="pass-stat" onClick={() => setFilterStatus("all")}>
                        <div className="pass-stat-label">Total</div>
                        <div className="pass-stat-value">{counts.total}</div>
                    </div>
                    <div className="pass-stat" onClick={() => setFilterStatus("cnf")}>
                        <div className="pass-stat-label">CNF</div>
                        <div className="pass-stat-value">{counts.cnf}</div>
                    </div>
                    <div className="pass-stat" onClick={() => setFilterStatus("rac")}>
                        <div className="pass-stat-label">RAC</div>
                        <div className="pass-stat-value">{counts.rac}</div>
                    </div>
                    <div className="pass-stat" onClick={() => setFilterStatus("boarded")}>
                        <div className="pass-stat-label">Boarded</div>
                        <div className="pass-stat-value">{counts.boarded}</div>
                    </div>
                    <div className="pass-stat" onClick={() => setFilterStatus("no-show")}>
                        <div className="pass-stat-label">No-Show</div>
                        <div className="pass-stat-value">{counts.noShow}</div>
                    </div>
                    <div className="pass-stat" onClick={() => setFilterStatus("online")}>
                        <div className="pass-stat-label">Online</div>
                        <div className="pass-stat-value">{counts.online || 0}</div>
                    </div>
                    <div className="pass-stat" onClick={() => setFilterStatus("offline")}>
                        <div className="pass-stat-label">Offline</div>
                        <div className="pass-stat-value">{counts.offline || 0}</div>
                    </div>
                </div>
            )}

            {/* Search Boxes - Only show when viewing passengers */}
            {!showVacantBerths && (
                <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="🔍 Search by PNR..."
                            value={searchPNR}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchPNR(e.target.value)}
                            style={{
                                width: '100%',
                                maxWidth: '200px',
                                padding: '10px 15px',
                                border: '2px solid #e1e8ed',
                                borderRadius: '6px',
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'border-color 0.2s ease',
                            }}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                        />
                        <input
                            type="text"
                            placeholder="🚂 Coach (S1, B2)..."
                            value={searchCoach}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchCoach(e.target.value)}
                            style={{
                                width: '100%',
                                maxWidth: '150px',
                                padding: '10px 15px',
                                border: '2px solid #e1e8ed',
                                borderRadius: '6px',
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'border-color 0.2s ease',
                            }}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                        />
                        <input
                            type="text"
                            placeholder="🛏️ Berth (S1-4, B2-37)..."
                            value={searchBerth}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchBerth(e.target.value)}
                            style={{
                                width: '100%',
                                maxWidth: '180px',
                                padding: '10px 15px',
                                border: '2px solid #e1e8ed',
                                borderRadius: '6px',
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'border-color 0.2s ease',
                            }}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                        />
                        {(searchPNR || searchCoach || searchBerth) && filteredPassengers.length > 0 && (
                            <span style={{ fontSize: '13px', color: '#5a6c7d' }}>
                                {filteredPassengers.length} result(s)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Filter Options - Only show when viewing passengers */}
            {!showVacantBerths && (
                <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => setFilterStatus("all")} style={{ padding: '8px 20px', background: filterStatus === "all" ? '#3498db' : '#ecf0f1', color: filterStatus === "all" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filterStatus === "all" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                        All ({counts?.total || 0})
                    </button>
                    <button onClick={() => setFilterStatus("cnf")} style={{ padding: '8px 20px', background: filterStatus === "cnf" ? '#27ae60' : '#ecf0f1', color: filterStatus === "cnf" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filterStatus === "cnf" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                        CNF ({counts?.cnf || 0})
                    </button>
                    <button onClick={() => setFilterStatus("rac")} style={{ padding: '8px 20px', background: filterStatus === "rac" ? '#f39c12' : '#ecf0f1', color: filterStatus === "rac" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filterStatus === "rac" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                        RAC ({counts?.rac || 0})
                    </button>
                    <button onClick={() => setFilterStatus("boarded")} style={{ padding: '8px 20px', background: filterStatus === "boarded" ? '#9b59b6' : '#ecf0f1', color: filterStatus === "boarded" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filterStatus === "boarded" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                        Boarded ({counts?.boarded || 0})
                    </button>
                    <button onClick={() => setFilterStatus("no-show")} style={{ padding: '8px 20px', background: filterStatus === "no-show" ? '#e74c3c' : '#ecf0f1', color: filterStatus === "no-show" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filterStatus === "no-show" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                        No-Show ({counts?.noShow || 0})
                    </button>
                    <button onClick={() => setFilterStatus("upcoming")} style={{ padding: '8px 20px', background: filterStatus === "upcoming" ? '#1abc9c' : '#ecf0f1', color: filterStatus === "upcoming" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filterStatus === "upcoming" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                        Upcoming
                    </button>
                </div>
            )}

            {/* Vacant Berths Toggle Button - Separate Row */}
            {trainData && trainData.journeyStarted && (
                <div className="vacant-toggle-section">
                    <button
                        onClick={() => setShowVacantBerths(!showVacantBerths)}
                        className="vacant-toggle-btn"
                    >
                        {showVacantBerths ? "👥 View Passengers List " : "🛏️ View Vacant Berths"}
                        {!showVacantBerths && (
                            <span className="toggle-count">
                                ({vacantBerths.length} vacant at{" "}
                                {trainData.stations[trainData.currentStationIdx]?.code})
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Vacant Berths Section */}
            {showVacantBerths && trainData && trainData.journeyStarted && (
                <div className="vacant-berths-section" style={{ marginTop: '30px' }}>
                    <div className="section-header">
                        <h3>
                            Vacant Berths at{" "}
                            {trainData.stations[trainData.currentStationIdx]?.name}
                        </h3>
                        <span className="badge-count">{vacantBerths.length} vacant</span>
                    </div>

                    {/* Vacant Berths Filter */}
                    <div className="vacant-filters">
                        <div className="vacant-filter-group">
                            <label className="filter-label">🔍 Filter by Coach & Stations</label>
                            <div className="vacant-filter-inputs">
                                <input
                                    type="text"
                                    placeholder="Coach: (e.g., S1, B1, B2...)"
                                    value={vacantCoach}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setVacantCoach(e.target.value)}
                                    className="vacant-filter-input"
                                />
                                <input
                                    type="text"
                                    placeholder="Berth: (e.g., S1-4, B2-37)"
                                    value={vacantBerthSearch}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setVacantBerthSearch(e.target.value)}
                                    className="vacant-filter-input"
                                />
                                <input
                                    type="text"
                                    placeholder="From Station"
                                    value={vacantFromStation}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setVacantFromStation(e.target.value)}
                                    className="vacant-filter-input"
                                />
                                <input
                                    type="text"
                                    placeholder="To Station"
                                    value={vacantToStation}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setVacantToStation(e.target.value)}
                                    className="vacant-filter-input"
                                />
                                <button
                                    onClick={() => {
                                        setVacantCoach("");
                                        setVacantBerthSearch("");
                                        setVacantFromStation("");
                                        setVacantToStation("");
                                    }}
                                    className="vacant-filter-reset"
                                    title="Clear Filters"
                                >
                                    ✕ Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    {vacantBerths.length === 0 ? (
                        <div className="empty-state">
                            <p>✅ All berths are occupied at this station!</p>
                        </div>
                    ) : (
                        <>
                            {filteredVacantBerths.length === 0 ? (
                                <div className="empty-state">
                                    <p>🔍 No berths match your filter criteria</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <div className="filter-result-info">
                                        Showing <strong>{filteredVacantBerths.length}</strong> of{" "}
                                        <strong>{vacantBerths.length}</strong> vacant berths
                                    </div>
                                    <table className="vacant-berths-table">
                                        <thead>
                                            <tr>
                                                <th>No.</th>
                                                <th>Coach</th>
                                                <th>Berth</th>
                                                <th>Type</th>
                                                <th>Class</th>
                                                <th>Current Station</th>
                                                <th>Vacant From</th>
                                                <th>Will Occupy At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredVacantBerths.map((berth, idx) => (
                                                <tr key={berth.fullBerthNo}>
                                                    <td className="td-no">{idx + 1}</td>
                                                    <td className="td-coach">{berth.coach}</td>
                                                    <td className="td-berth">{berth.fullBerthNo}</td>
                                                    <td className="td-type">{berth.type}</td>
                                                    <td className="td-class">{berth.class}</td>
                                                    <td className="td-station">
                                                        {berth.currentStation}
                                                    </td>
                                                    <td className="td-station">
                                                        {berth.vacantFromStation}
                                                    </td>
                                                    <td className="td-station">
                                                        {berth.vacantToStation}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Table - Compact & Tabular */}
            {!showVacantBerths && (
                <div className="table-container">
                    {filteredPassengers.length === 0 ? (
                        <div className="empty-state">
                            <p>No passengers match your filters</p>
                        </div>
                    ) : (
                        <>
                            <table className="pass-table">
                                <thead>
                                    <tr>
                                        <th>No.</th>
                                        <th>PNR</th>
                                        <th>Name</th>
                                        <th className="th-age">Age</th>
                                        <th className="th-gender">Gender</th>
                                        <th className="th-status">Status</th>
                                        <th className="th-rac">RAC Que_no</th>
                                        <th>Coach</th>
                                        <th>Class</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Berth</th>
                                        <th>Boarded</th>
                                        <th>Passenger Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const grouped = groupPassengersByPNR(filteredPassengers);
                                        const rows: React.ReactElement[] = [];
                                        let rowIndex = 0;

                                        grouped.forEach((passengerGroup, pnr) => {
                                            const isMultiPassenger = passengerGroup.length > 1;
                                            const isExpanded = expandedPNRs.has(pnr);

                                            if (isMultiPassenger) {
                                                // Render GROUP HEADER ROW
                                                const firstPassenger = passengerGroup[0];
                                                const groupStatus = firstPassenger.passengerStatus || 'Offline';

                                                rows.push(
                                                    <tr
                                                        key={`group-${pnr}`}
                                                        className="group-header-row"
                                                        onClick={() => togglePNRExpansion(pnr)}
                                                    >
                                                        <td className="td-no">{++rowIndex}</td>
                                                        <td className="td-pnr" colSpan={2}>
                                                            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                                                            <strong>{pnr}</strong>
                                                            <span className="passenger-count-badge">
                                                                {passengerGroup.length} passengers
                                                            </span>
                                                        </td>
                                                        <td className="td-age">-</td>
                                                        <td className="td-gender">-</td>
                                                        <td className="td-status">
                                                            <span className={`badge ${firstPassenger.pnrStatus.toLowerCase().replace(" ", "-")}`}>
                                                                {firstPassenger.pnrStatus}
                                                            </span>
                                                        </td>
                                                        <td className="td-rac">{firstPassenger.racStatus || '-'}</td>
                                                        <td className="td-coach">{firstPassenger.coach}</td>
                                                        <td className="td-class">{firstPassenger.class}</td>
                                                        <td className="td-from">{firstPassenger.from}</td>
                                                        <td className="td-to">{firstPassenger.to}</td>
                                                        <td className="td-berth">Multiple</td>
                                                        <td className="td-boarded">
                                                            {passengerGroup.every(p => p.boarded) ? "✅" :
                                                                passengerGroup.some(p => p.boarded) ? "⏳" : "⏳"}
                                                        </td>
                                                        <td className="td-passenger-status">
                                                            <span className={`current-status-btn ${groupStatus.toLowerCase()}`}>
                                                                {groupStatus}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );

                                                // Render DETAIL ROWS (if expanded)
                                                if (isExpanded) {
                                                    passengerGroup.forEach((p, idx) => {
                                                        rows.push(
                                                            <tr key={`${pnr}-${idx}`} className={`passenger-detail-row ${p.noShow ? "no-show-row" : ""}`}>
                                                                <td className="td-no"></td>
                                                                <td className="td-pnr" style={{ paddingLeft: '40px', fontSize: '0.9em', color: '#6b7280' }}>
                                                                    #{idx + 1}
                                                                </td>
                                                                <td className="td-name">{p.name}</td>
                                                                <td className="td-age">{p.age}</td>
                                                                <td className="td-gender">{p.gender}</td>
                                                                <td className="td-status">
                                                                    <span className={`badge ${p.pnrStatus.toLowerCase().replace(" ", "-")}`}>
                                                                        {p.pnrStatus}
                                                                    </span>
                                                                </td>
                                                                <td className="td-rac">{p.racStatus || '-'}</td>
                                                                <td className="td-coach">{p.coach}</td>
                                                                <td className="td-class">{p.class}</td>
                                                                <td className="td-from">{p.from}</td>
                                                                <td className="td-to">{p.to}</td>
                                                                <td className="td-berth">{p.berth}</td>
                                                                <td className="td-boarded">
                                                                    {p.noShow ? "❌" : p.boarded ? "✅" : "⏳"}
                                                                </td>
                                                                <td className="td-passenger-status">
                                                                    <PassengerStatusButton passenger={p} onStatusUpdate={handleStatusUpdate} />
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                }
                                            } else {
                                                // Render SINGLE PASSENGER ROW (no grouping)
                                                const p = passengerGroup[0];
                                                rows.push(
                                                    <tr key={p.pnr} className={p.noShow ? "no-show-row" : ""}>
                                                        <td className="td-no">{++rowIndex}</td>
                                                        <td className="td-pnr">{p.pnr}</td>
                                                        <td className="td-name">{p.name}</td>
                                                        <td className="td-age">{p.age}</td>
                                                        <td className="td-gender">{p.gender}</td>
                                                        <td className="td-status">
                                                            <span className={`badge ${p.pnrStatus.toLowerCase().replace(" ", "-")}`}>
                                                                {p.pnrStatus}
                                                            </span>
                                                        </td>
                                                        <td className="td-rac">{p.racStatus || '-'}</td>
                                                        <td className="td-coach">{p.coach}</td>
                                                        <td className="td-class">{p.class}</td>
                                                        <td className="td-from">{p.from}</td>
                                                        <td className="td-to">{p.to}</td>
                                                        <td className="td-berth">{p.berth}</td>
                                                        <td className="td-boarded">
                                                            {p.noShow ? "❌" : p.boarded ? "✅" : "⏳"}
                                                        </td>
                                                        <td className="td-passenger-status">
                                                            <PassengerStatusButton passenger={p} onStatusUpdate={handleStatusUpdate} />
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        });

                                        return rows;
                                    })()}
                                </tbody>
                            </table>

                            <div className="table-footer">
                                Showing {filteredPassengers.length} of {passengers.length}{" "}
                                passengers
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default PassengersPage;

