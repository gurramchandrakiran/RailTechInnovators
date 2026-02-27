// tte-portal/src/pages/BoardedPassengersPage.tsx

import React, { useState, useEffect, FocusEvent } from "react";
import { tteAPI } from "../api";
import "../styles/pages/PassengersPage.css";

interface Passenger {
    pnr: string;
    name: string;
    age?: number;
    gender?: string;
    pnrStatus: string;
    class?: string;
    coach?: string;
    berth?: string;
    from?: string;
    to?: string;
    passengerStatus?: string;
    noShow: boolean;
    boarded: boolean;
}

function BoardedPassengersPage(): React.ReactElement {
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [currentStation, setCurrentStation] = useState<string>("");
    const [filter, setFilter] = useState<string>("all");
    const [updating, setUpdating] = useState<string | null>(null);
    const [searchPNR, setSearchPNR] = useState<string>("");
    const [searchCoach, setSearchCoach] = useState<string>(""); // Coach filter

    // Fetch boarded passengers
    const fetchBoardedPassengers = async (): Promise<void> => {
        try {
            setLoading(true);
            const response = await tteAPI.getBoardedPassengers();

            if (response.success) {
                setPassengers(response.data.passengers || []);
                setCurrentStation(response.data.currentStation || "");
            }
        } catch (error) {
            console.error("Error fetching boarded passengers:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBoardedPassengers();

        // Refresh every 60 seconds
        const interval = setInterval(fetchBoardedPassengers, 60000);
        return () => clearInterval(interval);
    }, []);

    // Mark passenger as no-show
    const handleMarkNoShow = async (pnr: string): Promise<void> => {
        if (!window.confirm(`Mark passenger ${pnr} as NO-SHOW?`)) {
            return;
        }

        setUpdating(pnr);
        try {
            const response = await tteAPI.markNoShow(pnr);
            if (response.success) {
                setPassengers(prev => prev.map(p =>
                    p.pnr === pnr ? { ...p, noShow: true } : p
                ));
                alert('✅ Passenger marked as NO-SHOW');
            }
        } catch (error: any) {
            alert('❌ Failed to mark as NO-SHOW: ' + (error.response?.data?.message || error.message));
        } finally {
            setUpdating(null);
        }
    };

    // Revert no-show status
    const handleRevertNoShow = async (pnr: string): Promise<void> => {
        if (!window.confirm(`Revert NO-SHOW status for passenger ${pnr}?`)) {
            return;
        }

        setUpdating(pnr);
        try {
            const response = await tteAPI.revertNoShow(pnr);
            if (response.success) {
                setPassengers(prev => prev.map(p =>
                    p.pnr === pnr ? { ...p, noShow: false, boarded: true } : p
                ));
                alert('✅ NO-SHOW status reverted successfully');
            }
        } catch (error: any) {
            alert('❌ Failed to revert: ' + (error.response?.data?.message || error.message));
        } finally {
            setUpdating(null);
        }
    };

    // Filter passengers based on selected filter and search
    const filteredPassengers = passengers.filter((p) => {
        if (filter === "rac" && p.pnrStatus !== "RAC") return false;
        if (filter === "cnf" && p.pnrStatus !== "CNF") return false;
        if (searchPNR && !p.pnr?.toLowerCase().includes(searchPNR.toLowerCase())) return false;
        if (searchCoach && !p.coach?.toLowerCase().includes(searchCoach.toLowerCase())) return false;
        return true;
    });

    const racCount = passengers.filter(p => p.pnrStatus === "RAC").length;
    const cnfCount = passengers.filter(p => p.pnrStatus === "CNF").length;

    const handleInputFocus = (e: FocusEvent<HTMLInputElement>): void => {
        e.target.style.borderColor = '#3498db';
    };

    const handleInputBlur = (e: FocusEvent<HTMLInputElement>): void => {
        e.target.style.borderColor = '#e1e8ed';
    };

    return (
        <div className="passengers-page">
            <h2 style={{ marginBottom: '10px', color: '#2c3e50' }}>🚂 Currently Boarded Passengers</h2>
            <p style={{ marginBottom: '15px', color: '#5a6c7d', fontSize: '13px' }}>
                Showing passengers currently onboard at <strong>{currentStation || "N/A"}</strong> ({passengers.length} passengers)
            </p>

            {/* Search Box */}
            <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="🔍 Search by PNR..."
                        value={searchPNR}
                        onChange={(e) => setSearchPNR(e.target.value)}
                        style={{
                            width: '100%',
                            maxWidth: '300px',
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
                        placeholder="🚂 Filter by Coach (e.g., S1, B2)..."
                        value={searchCoach}
                        onChange={(e) => setSearchCoach(e.target.value)}
                        style={{
                            width: '100%',
                            maxWidth: '300px',
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
                    {(searchPNR || searchCoach) && (
                        <span style={{ fontSize: '13px', color: '#5a6c7d' }}>
                            {filteredPassengers.length} result(s)
                        </span>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => setFilter("all")} style={{ padding: '8px 20px', background: filter === "all" ? '#3498db' : '#ecf0f1', color: filter === "all" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filter === "all" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                    All ({passengers.length})
                </button>
                <button onClick={() => setFilter("cnf")} style={{ padding: '8px 20px', background: filter === "cnf" ? '#27ae60' : '#ecf0f1', color: filter === "cnf" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filter === "cnf" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                    CNF ({cnfCount})
                </button>
                <button onClick={() => setFilter("rac")} style={{ padding: '8px 20px', background: filter === "rac" ? '#f39c12' : '#ecf0f1', color: filter === "rac" ? 'white' : '#2c3e50', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: filter === "rac" ? '600' : '500', fontSize: '13px', transition: 'all 0.2s ease' }}>
                    RAC ({racCount})
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="empty-state">Loading boarded passengers...</div>
            ) : filteredPassengers.length === 0 ? (
                <div className="empty-state">
                    {(searchPNR || searchCoach) ?
                        `No passengers found matching your search criteria` :
                        `No ${filter !== "all" ? filter : ""} boarded passengers at current station`
                    }
                </div>
            ) : (
                <div className="table-container">
                    <table className="pass-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>PNR</th>
                                <th>Name</th>
                                <th className="th-age">Age</th>
                                <th className="th-gender">Gender</th>
                                <th className="th-status">Status</th>
                                <th>Class</th>
                                <th>Coach</th>
                                <th>Seat No</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Passenger Status</th>
                                <th>No Show</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPassengers.map((passenger, index) => (
                                <tr key={passenger.pnr || index} className={passenger.noShow ? 'no-show-row' : ''}>
                                    <td className="td-no">{index + 1}</td>
                                    <td className="td-pnr">{passenger.pnr || "N/A"}</td>
                                    <td className="td-name">{passenger.name || "N/A"}</td>
                                    <td className="td-age">{passenger.age || "N/A"}</td>
                                    <td className="td-gender">{passenger.gender || "N/A"}</td>
                                    <td className="td-status">
                                        <span className={`badge ${passenger.pnrStatus?.toLowerCase()}`}>
                                            {passenger.pnrStatus || "N/A"}
                                        </span>
                                    </td>
                                    <td className="td-class">{passenger.class || "N/A"}</td>
                                    <td className="td-coach">{passenger.coach || "N/A"}</td>
                                    <td className="td-berth">{passenger.berth || "N/A"}</td>
                                    <td className="td-from">{passenger.from || "N/A"}</td>
                                    <td className="td-to">{passenger.to || "N/A"}</td>
                                    <td className="td-passenger-status">
                                        <span className={`current-status-btn ${passenger.passengerStatus?.toLowerCase() === "online" ? "online" : "offline"}`}>
                                            {passenger.passengerStatus || "Offline"}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {passenger.noShow ? (
                                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                                                <span style={{ padding: '4px 10px', background: '#e74c3c', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                                                    NO-SHOW
                                                </span>
                                                <button onClick={() => handleRevertNoShow(passenger.pnr)} disabled={updating === passenger.pnr} style={{ padding: '4px 10px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: updating === passenger.pnr ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: updating === passenger.pnr ? 0.6 : 1 }}>
                                                    {updating === passenger.pnr ? 'Reverting...' : 'Revert'}
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleMarkNoShow(passenger.pnr)} disabled={updating === passenger.pnr} style={{ padding: '4px 10px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: updating === passenger.pnr ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: updating === passenger.pnr ? 0.6 : 1 }}>
                                                {updating === passenger.pnr ? 'Updating...' : 'Mark No-Show'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default BoardedPassengersPage;

