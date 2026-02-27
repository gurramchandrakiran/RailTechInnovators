// admin-portal/src/pages/PassengersPage.tsx

import React, { useState, useEffect, ChangeEvent, CSSProperties, FocusEvent } from "react";
import {
    getAllPassengers,
    getPassengerCounts,
    setPassengerStatus,
    getVacantBerths,
} from "../services/apiWithErrorHandling";
import "../styles/pages/PassengersPage.css";

interface Station {
    name: string;
    code: string;
}

interface Passenger {
    pnr: string;
    name: string;
    age: number;
    gender: string;
    from: string;
    to: string;
    fromIdx: number;
    toIdx: number;
    class: string;
    pnrStatus: string;
    racStatus?: string;
    coach: string;
    berth: string;
    boarded?: boolean;
    noShow?: boolean;
    passengerStatus?: string;
}

interface Counts {
    total: number;
    cnf: number;
    rac: number;
    boarded: number;
    noShow: number;
    online?: number;
    offline?: number;
}

interface VacantBerth {
    coach: string;
    berthNo: number;
    fullBerthNo: string;
    type: string;
    class: string;
    currentStation: string;
    currentStationCode: string;
    vacantFromStation: string;
    vacantToStation: string;
    willOccupyAt: string;
    vacantFromStationCode?: string;
    vacantToStationCode?: string;
    vacantFromStationName?: string;
    vacantToStationName?: string;
    willOccupyAtCode?: string;
    isCurrentlyVacant: boolean;
}

interface TrainData {
    coaches?: any[];
    journeyStarted?: boolean;
    currentStationIdx?: number;
    stations?: Station[];
}

type PageType = 'config' | 'home' | 'rac-queue' | 'coaches' | 'passengers' | 'reallocation' | 'visualization' | 'add-passenger' | 'phase1';
type FilterStatus = 'all' | 'cnf' | 'rac' | 'boarded' | 'no-show' | 'online' | 'offline' | 'upcoming';

interface PassengersPageProps {
    trainData: TrainData | null;
    onClose: () => void;
    onNavigate: (page: PageType) => void;
}

interface PassengerStatusButtonProps {
    passenger: Passenger;
    onStatusUpdate: (pnr: string, status: string) => Promise<void>;
}

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
                <button onClick={() => handleToggle('online')} disabled={isUpdating} className="status-btn online-btn">
                    Online
                </button>
                <button onClick={() => handleToggle('offline')} disabled={isUpdating} className="status-btn offline-btn">
                    Offline
                </button>
                <button onClick={() => setShowButtons(false)} className="status-btn cancel-btn">

                </button>
            </div>
        );
    }

    return (
        <button onClick={() => setShowButtons(true)} disabled={isUpdating} className={`current-status-btn ${currentStatus.toLowerCase()}`}>
            {currentStatus}
        </button>
    );
}

function PassengersPage({ trainData, onClose, onNavigate }: PassengersPageProps): React.ReactElement {
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [filteredPassengers, setFilteredPassengers] = useState<Passenger[]>([]);
    const [counts, setCounts] = useState<Counts | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [journeyNotStarted, setJourneyNotStarted] = useState<boolean>(false);

    const [searchPNR, setSearchPNR] = useState<string>("");
    const [searchCoach, setSearchCoach] = useState<string>("");
    const [searchBerth, setSearchBerth] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [showVacantBerths, setShowVacantBerths] = useState<boolean>(false);
    const [vacantBerths, setVacantBerths] = useState<VacantBerth[]>([]);
    const [filteredVacantBerths, setFilteredVacantBerths] = useState<VacantBerth[]>([]);
    const [vacantFromStation, setVacantFromStation] = useState<string>("");
    const [vacantToStation, setVacantToStation] = useState<string>("");
    const [vacantBerthSearch, setVacantBerthSearch] = useState<string>("");

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

        const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:5000');

        ws.onopen = (): void => {
            console.log('PassengersPage WebSocket connected');
        };

        ws.onmessage = (event: MessageEvent): void => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'RAC_REALLOCATION_APPROVED' ||
                    message.type === 'TRAIN_UPDATE' ||
                    message.type === 'NO_SHOW' ||
                    message.type === 'RAC_REALLOCATION') {
                    console.log('✅ Passenger update detected, refreshing data...', message.type);
                    loadData();
                }
            } catch (error) {
                console.error('WebSocket message parse error:', error);
            }
        };

        ws.onerror = (error: Event): void => {
            console.error('WebSocket error:', error);
        };

        return () => ws.close();
    }, []);

    useEffect(() => {
        applyFilters();
        calculateVacantBerths();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [passengers, searchPNR, searchCoach, searchBerth, filterStatus, trainData]);

    useEffect(() => {
        filterVacantBerths();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vacantBerths, vacantFromStation, vacantToStation, vacantBerthSearch]);

    const calculateVacantBerths = async (): Promise<void> => {
        if (!trainData || !trainData.coaches || !trainData.journeyStarted) {
            setVacantBerths([]);
            return;
        }

        const currentStationIdx = trainData.currentStationIdx || 0;

        try {
            const response = await getVacantBerths();

            if (response.success && response.data && response.data.vacancies) {
                const vacant: VacantBerth[] = response.data.vacancies.map((berth: any) => ({
                    coach: berth.coachNo,
                    berthNo: berth.berthNo,
                    fullBerthNo: berth.fullBerthNo,
                    type: berth.type,
                    class: berth.class,
                    currentStation: trainData?.stations?.[currentStationIdx]?.name || "N/A",
                    currentStationCode: trainData?.stations?.[currentStationIdx]?.code || "",
                    vacantFromStation: berth.vacantFromStation,
                    vacantToStation: berth.vacantToStation,
                    willOccupyAt: berth.willOccupyAt,
                    vacantFromStationCode: berth.vacantFromStationCode || berth.vacantFromStation,
                    vacantToStationCode: berth.vacantToStationCode || berth.vacantToStation,
                    willOccupyAtCode: berth.willOccupyAtCode || berth.willOccupyAt,
                    isCurrentlyVacant: berth.isCurrentlyVacant
                }));

                setVacantBerths(vacant);
            } else {
                setVacantBerths([]);
            }
        } catch (error) {
            console.error('Error fetching vacant berths:', error);
            setVacantBerths([]);
        }
    };

    const filterVacantBerths = (): void => {
        let filtered = [...vacantBerths];

        if (vacantBerthSearch.trim()) {
            const searchTerm = vacantBerthSearch.toLowerCase();
            filtered = filtered.filter((berth) => berth.fullBerthNo?.toLowerCase().includes(searchTerm));
        }

        if (vacantFromStation.trim()) {
            const searchTerm = vacantFromStation.toLowerCase();
            filtered = filtered.filter((berth) =>
                berth.vacantFromStation?.toLowerCase().includes(searchTerm) ||
                berth.vacantFromStationName?.toLowerCase().includes(searchTerm)
            );
        }

        if (vacantToStation.trim()) {
            const searchTerm = vacantToStation.toLowerCase();
            filtered = filtered.filter((berth) =>
                berth.vacantToStation?.toLowerCase().includes(searchTerm) ||
                berth.vacantToStationName?.toLowerCase().includes(searchTerm)
            );
        }

        setFilteredVacantBerths(filtered);
    };

    const loadData = async (): Promise<void> => {
        try {
            setLoading(true);
            setJourneyNotStarted(false);

            const [passengersRes, countsRes] = await Promise.all([
                getAllPassengers(),
                getPassengerCounts(),
            ]);

            if (passengersRes.success) {
                const allPassengers = passengersRes.data.passengers || [];
                setPassengers(allPassengers);
            } else if (
                passengersRes.error?.toLowerCase().includes('journey has not started') ||
                passengersRes.error?.toLowerCase().includes('train is not initialized')
            ) {
                setJourneyNotStarted(true);
            }

            if (countsRes.success) {
                setCounts(countsRes.data);
            }
        } catch (error) {
            console.error("Error loading passengers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (pnr: string, status: string): Promise<void> => {
        try {
            await setPassengerStatus(pnr, status);
            await loadData();
        } catch (error: any) {
            console.error('Error updating passenger status:', error);
            alert(error.message || 'Failed to update passenger status');
        }
    };

    const applyFilters = (): void => {
        let filtered = [...passengers];

        if (searchPNR.trim()) {
            filtered = filtered.filter((p) => String(p.pnr).includes(searchPNR.trim()));
        }

        if (searchCoach.trim()) {
            filtered = filtered.filter((p) => p.coach?.toLowerCase().includes(searchCoach.trim().toLowerCase()));
        }

        if (searchBerth.trim()) {
            filtered = filtered.filter((p) => p.berth?.toLowerCase().includes(searchBerth.trim().toLowerCase()));
        }

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
                filtered = filtered.filter((p) => p.passengerStatus?.toLowerCase() === 'online');
                break;
            case "offline":
                filtered = filtered.filter((p) => !p.passengerStatus || p.passengerStatus.toLowerCase() === 'offline');
                break;
            case "upcoming":
                filtered = filtered.filter((p) => p.fromIdx > (trainData?.currentStationIdx || 0) && !p.noShow && !p.boarded);
                break;
            default:
                break;
        }

        setFilteredPassengers(filtered);
    };

    const inputStyle: CSSProperties = {
        width: '100%',
        maxWidth: '200px',
        padding: '10px 15px',
        border: '2px solid #e1e8ed',
        borderRadius: '6px',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s ease',
    };

    const getButtonStyle = (isActive: boolean, color: string): CSSProperties => ({
        padding: '8px 20px',
        background: isActive ? color : '#ecf0f1',
        color: isActive ? 'white' : '#2c3e50',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: isActive ? 600 : 500,
        fontSize: '13px',
        transition: 'all 0.2s ease'
    });

    if (loading) {
        return (
            <div className="passengers-page">
                <div className="page-header">
                    <button className="back-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>

                    </button>
                    <h2> Passenger List</h2>
                </div>
                <div className="loading-container">
                    <div className="spinner-large"></div>
                    <p>Loading passengers...</p>
                </div>
            </div>
        );
    }

    if (journeyNotStarted) {
        return (
            <div className="passengers-page">
                <div className="page-header">
                    <button className="back-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h2>Passenger List & Vacant Positions</h2>
                </div>
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚂</div>
                    <h3 style={{ marginBottom: '8px', color: '#2c3e50' }}>Journey Not Started</h3>
                    <p style={{ color: '#5a6c7d', marginBottom: '20px' }}>
                        The journey hasn't been started yet. Go to the <strong>Home</strong> page to initialize the train and start the journey.
                    </p>
                    <button className="back-btn" onClick={onClose} style={{ background: '#0891b2', color: 'white', padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>
                        🏠 Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="passengers-page">
            <div className="page-header">
                <button className="back-btn" onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>

                </button>
                <h2> Passenger List & Vacant Positions ({counts ? counts.total : passengers.length} total)</h2>
            </div>

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

            {!showVacantBerths && (
                <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="🔍 Search by PNR..."
                            value={searchPNR}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchPNR(e.target.value)}
                            style={inputStyle}
                            onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.style.borderColor = '#3498db'}
                            onBlur={(e: FocusEvent<HTMLInputElement>) => e.target.style.borderColor = '#e1e8ed'}
                        />
                        <input
                            type="text"
                            placeholder="🚂 Coach (S1, B2)..."
                            value={searchCoach}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchCoach(e.target.value)}
                            style={{ ...inputStyle, maxWidth: '150px' }}
                            onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.style.borderColor = '#3498db'}
                            onBlur={(e: FocusEvent<HTMLInputElement>) => e.target.style.borderColor = '#e1e8ed'}
                        />
                        <input
                            type="text"
                            placeholder=" Berth (S1-4, B2-37)..."
                            value={searchBerth}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchBerth(e.target.value)}
                            style={{ ...inputStyle, maxWidth: '180px' }}
                            onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.style.borderColor = '#3498db'}
                            onBlur={(e: FocusEvent<HTMLInputElement>) => e.target.style.borderColor = '#e1e8ed'}
                        />
                        {(searchPNR || searchCoach || searchBerth) && filteredPassengers.length > 0 && (
                            <span style={{ fontSize: '13px', color: '#5a6c7d' }}>
                                {filteredPassengers.length} result(s)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {!showVacantBerths && (
                <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => setFilterStatus("all")} style={getButtonStyle(filterStatus === "all", '#3498db')}>
                        All ({counts?.total || 0})
                    </button>
                    <button onClick={() => setFilterStatus("cnf")} style={getButtonStyle(filterStatus === "cnf", '#27ae60')}>
                        CNF ({counts?.cnf || 0})
                    </button>
                    <button onClick={() => setFilterStatus("rac")} style={getButtonStyle(filterStatus === "rac", '#f39c12')}>
                        RAC ({counts?.rac || 0})
                    </button>
                    <button onClick={() => setFilterStatus("boarded")} style={getButtonStyle(filterStatus === "boarded", '#9b59b6')}>
                        Boarded ({counts?.boarded || 0})
                    </button>
                    <button onClick={() => setFilterStatus("no-show")} style={getButtonStyle(filterStatus === "no-show", '#e74c3c')}>
                        No-Show ({counts?.noShow || 0})
                    </button>
                    <button onClick={() => setFilterStatus("online")} style={getButtonStyle(filterStatus === "online", '#16a085')}>
                        Online ({counts?.online || 0})
                    </button>
                    <button onClick={() => setFilterStatus("offline")} style={getButtonStyle(filterStatus === "offline", '#7f8c8d')}>
                        Offline ({counts?.offline || 0})
                    </button>
                    <button onClick={() => setFilterStatus("upcoming")} style={getButtonStyle(filterStatus === "upcoming", '#1abc9c')}>
                        Upcoming
                    </button>
                </div>
            )}

            {trainData && trainData.journeyStarted && (
                <div className="vacant-toggle-section" style={{ marginTop: '30px' }}>
                    <button onClick={() => setShowVacantBerths(!showVacantBerths)} className="vacant-toggle-btn">
                        {showVacantBerths ? " Show Passengers" : " Show Vacant Berths"}
                        {!showVacantBerths && (
                            <span className="toggle-count">
                                ({vacantBerths.length} vacant at{" "}
                                {trainData?.stations?.[trainData.currentStationIdx]?.code || "N/A"})
                            </span>
                        )}
                    </button>
                </div>
            )}

            {showVacantBerths && trainData && trainData.journeyStarted && (
                <div className="vacant-berths-section" style={{ marginTop: '20px' }}>
                    <div className="section-header">
                        <h3>All Vacant Berth Segments Across Entire Journey</h3>
                        <span className="badge-count">{vacantBerths.length} segments</span>
                    </div>

                    <div className="vacant-filters">
                        <div className="vacant-filter-group">
                            <label className="filter-label">🔍 Filter by Berth & Stations</label>
                            <div className="vacant-filter-inputs">
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
                                    onClick={() => { setVacantBerthSearch(""); setVacantFromStation(""); setVacantToStation(""); }}
                                    className="vacant-filter-reset"
                                    title="Clear Filters"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    {vacantBerths.length === 0 ? (
                        <div className="empty-state">
                            <p>✅ No vacant segments found for any berths across the entire journey!</p>
                        </div>
                    ) : filteredVacantBerths.length === 0 ? (
                        <div className="empty-state">
                            <p>🔍 No berths match your filter criteria</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <div className="filter-result-info">
                                Showing <strong>{filteredVacantBerths.length}</strong> of <strong>{vacantBerths.length}</strong> vacant segments
                            </div>
                            <table className="vacant-berths-table">
                                <thead>
                                    <tr>
                                        <th>No.</th>
                                        <th>Berth</th>
                                        <th>Type</th>
                                        <th>Class</th>
                                        <th>Current Station</th>
                                        <th>Vacant From</th>
                                        <th>Vacant To</th>
                                        <th>Will Occupy At</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVacantBerths.map((berth, idx) => (
                                        <tr key={`${berth.fullBerthNo}-${idx}`} style={{ backgroundColor: berth.isCurrentlyVacant ? '#f0f9ff' : '#fff' }}>
                                            <td className="td-no">{idx + 1}</td>
                                            <td className="td-berth">{berth.fullBerthNo}</td>
                                            <td className="td-type">{berth.type}</td>
                                            <td className="td-class">{berth.class}</td>
                                            <td className="td-station" style={{ textAlign: 'left' }}>{berth.currentStation}</td>
                                            <td className="td-station" style={{ textAlign: 'left' }}>{berth.vacantFromStation}</td>
                                            <td className="td-station" style={{ textAlign: 'left' }}>{berth.vacantToStation}</td>
                                            <td className="td-station" style={{ textAlign: 'left' }}>{berth.willOccupyAt}</td>
                                            <td className="td-status">
                                                {berth.isCurrentlyVacant ? (
                                                    <span className="badge" style={{ background: '#10b981', color: 'white' }}>NOW</span>
                                                ) : (
                                                    <span className="badge" style={{ background: '#94a3b8', color: 'white' }}>FUTURE</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="add-passenger-button-container">
                        <button onClick={() => onNavigate("add-passenger")} className="btn-add-passenger-bottom" title="Add a new passenger to vacant berths">
                            Add New Passenger
                        </button>
                        <p className="add-passenger-hint">Check vacant berths above and add passengers to available berths</p>
                    </div>
                </div>
            )}

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
                                                            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>{">"}</span>
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
                                Showing {filteredPassengers.length} of {passengers.length} passengers
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default PassengersPage;

