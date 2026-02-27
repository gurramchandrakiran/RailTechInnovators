// admin-portal/src/components/PassengerList.tsx

import React, { useState, useEffect, useMemo, ChangeEvent } from "react";
import { getAllPassengers, getRACQueue } from "../services/api";
import "../styles/components/PassengerList.css";

interface Station {
    code: string;
    name: string;
}

interface Passenger {
    pnr: string;
    name?: string;
    age?: number;
    gender?: string;
    from?: string;
    to?: string;
    fromIdx?: number;
    toIdx?: number;
    class?: string;
    pnrStatus?: string;
    racStatus?: string;
    berth?: string;
    berthType?: string;
    coach?: string;
    racNumber?: number;
    boarded?: boolean;
    noShow?: boolean;
    seatNo?: string;
}

interface PassengerListProps {
    currentStationIdx: number;
    stations: Station[];
}

interface PassengerStatus {
    text: string;
    class: string;
}

interface Stats {
    total: number;
    boarded: number;
    noShow: number;
    notBoarded: number;
    upcoming: number;
    cnf: number;
    rac: number;
}

type FilterStatus = 'all' | 'boarded' | 'no-show' | 'not-boarded' | 'upcoming' | 'cnf' | 'rac';
type SortColumn = 'pnr' | 'name' | 'age' | 'gender' | 'from' | 'to' | 'class' | 'pnrStatus' | 'racStatus' | 'berth' | 'berthType' | 'status';

function PassengerList({ currentStationIdx, stations }: PassengerListProps): React.ReactElement {
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [searchPNR, setSearchPNR] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [filterClass, setFilterClass] = useState<string>("all");
    const [sortBy, setSortBy] = useState<SortColumn>("pnr");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [currentPage, setCurrentPage] = useState<number>(1);
    const passengersPerPage = 20;

    useEffect(() => {
        const fetchPassengers = async (): Promise<void> => {
            try {
                const [passengersRes, racRes] = await Promise.all([
                    getAllPassengers(),
                    getRACQueue(),
                ]);

                // API functions already return unwrapped data (not response.data)
                // getAllPassengers returns { passengers: [] } or Passenger[]
                const berthPassengers: Passenger[] = Array.isArray(passengersRes)
                    ? passengersRes
                    : (passengersRes as any)?.passengers || [];
                console.log('📊 Berth passengers:', berthPassengers.length);

                let racPassengers: Passenger[] = [];

                // Check if racRes is an array or has a queue property
                if (Array.isArray(racRes)) {
                    console.log('🔍 RAC Response is array:', racRes.length);
                    racPassengers = racRes
                        .filter((r: any) => r.pnrStatus === "RAC")
                        .map((r: any): Passenger => ({
                            pnr: r.pnr,
                            name: r.name,
                            age: r.age,
                            gender: r.gender,
                            from: r.from,
                            to: r.to,
                            fromIdx: r.fromIdx,
                            toIdx: r.toIdx,
                            class: r.class,
                            pnrStatus: "RAC",
                            racStatus: r.racStatus,
                            berth: r.seatNo ? `${r.coach || "RAC"}-${r.seatNo}` : "RAC",
                            berthType: r.berthType || "RAC",
                            coach: r.coach,
                            racNumber: r.racNumber,
                            boarded: false,
                            noShow: false,
                        }));
                }

                console.log('📊 RAC passengers from queue:', racPassengers.length);

                const uniquePassengers = new Map<string, Passenger>();

                berthPassengers.forEach(p => {
                    if (p.pnr) uniquePassengers.set(p.pnr, p);
                });

                racPassengers.forEach(p => {
                    if (p.pnr) uniquePassengers.set(p.pnr, p);
                });

                const allPassengers = Array.from(uniquePassengers.values());
                console.log('📊 Total unique passengers:', allPassengers.length);

                setPassengers(allPassengers);
            } catch (err) {
                console.error('Error fetching passengers:', err);
                setPassengers([]);
            }
        };

        fetchPassengers();
    }, [currentStationIdx, stations]);

    const filteredAndSortedPassengers = useMemo(() => {
        console.log('🔄 Filtering... Status:', filterStatus, 'Class:', filterClass);
        console.log('📊 Total Passengers in State:', passengers.length);
        if (passengers.length > 0) {
            const sampleRAC = passengers.find(p => p.pnrStatus === 'RAC');
            console.log('🔍 Sample RAC Passenger:', sampleRAC);
        }

        let result = [...passengers];

        if (searchPNR.trim()) {
            result = result.filter((p) => String(p.pnr).includes(searchPNR.trim()));
        }

        if (filterStatus !== "all") {
            result = result.filter((p) => {
                switch (filterStatus) {
                    case "boarded":
                        return p.boarded && !p.noShow;
                    case "no-show":
                        return p.noShow;
                    case "not-boarded":
                        return !p.boarded && !p.noShow && (p.fromIdx || 0) <= currentStationIdx;
                    case "upcoming":
                        return !p.boarded && !p.noShow && (p.fromIdx || 0) > currentStationIdx;
                    case "cnf":
                        return p.pnrStatus === "CNF";
                    case "rac":
                        const isRac = (p.pnrStatus && p.pnrStatus.toUpperCase() === "RAC") || (p.racStatus && p.racStatus !== '-');
                        return isRac;
                    default:
                        return true;
                }
            });
        }

        if (filterClass !== "all") {
            result = result.filter((p) => p.class === filterClass);
        }

        console.log('✅ Filtered Result Count:', result.length);

        result.sort((a, b) => {
            const compareA = String((a as any)[sortBy] ?? "");
            const compareB = String((b as any)[sortBy] ?? "");
            if (compareA < compareB) return sortOrder === "asc" ? -1 : 1;
            if (compareA > compareB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [
        passengers,
        searchPNR,
        filterStatus,
        filterClass,
        sortBy,
        sortOrder,
        currentStationIdx,
    ]);

    const totalPages = Math.ceil(
        filteredAndSortedPassengers.length / passengersPerPage,
    );
    const paginatedPassengers = filteredAndSortedPassengers.slice(
        (currentPage - 1) * passengersPerPage,
        currentPage * passengersPerPage,
    );

    const stats = useMemo<Stats>(
        () => ({
            total: passengers.length,
            boarded: passengers.filter((p) => p.boarded && !p.noShow).length,
            noShow: passengers.filter((p) => p.noShow).length,
            notBoarded: passengers.filter(
                (p) => !p.boarded && !p.noShow && (p.fromIdx || 0) <= currentStationIdx,
            ).length,
            upcoming: passengers.filter(
                (p) => !p.boarded && (p.fromIdx || 0) > currentStationIdx,
            ).length,
            cnf: passengers.filter((p) => p.pnrStatus === "CNF").length,
            rac: passengers.filter((p) => p.pnrStatus === "RAC").length,
        }),
        [passengers, currentStationIdx],
    );

    const getPassengerStatus = (p: Passenger): PassengerStatus => {
        if (p.noShow) return { text: "No-Show", class: "no-show" };
        if (p.boarded) return { text: "Boarded", class: "boarded" };
        if ((p.fromIdx || 0) <= currentStationIdx)
            return { text: "Missed", class: "missed" };
        if ((p.fromIdx || 0) > currentStationIdx)
            return { text: "Upcoming", class: "upcoming" };
        return { text: "Unknown", class: "unknown" };
    };

    const handleSort = (column: SortColumn): void => {
        if (sortBy === column) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        else {
            setSortBy(column);
            setSortOrder("asc");
        }
        setCurrentPage(1);
    };

    const resetFilters = (): void => {
        setSearchPNR("");
        setFilterStatus("all");
        setFilterClass("all");
        setSortBy("pnr");
        setSortOrder("asc");
        setCurrentPage(1);
    };

    const handleStatClick = (key: string): void => {
        const map: Record<string, FilterStatus> = {
            total: 'all',
            boarded: 'boarded',
            noShow: 'no-show',
            notBoarded: 'not-boarded',
            upcoming: 'upcoming',
            cnf: 'cnf',
            rac: 'rac'
        };
        if (map[key]) {
            setFilterStatus(map[key]);
            setCurrentPage(1);
        }
    };

    return (
        <div className="passenger-list-panel">
            <div className="panel-header">
                <h3>
                     Passenger List ({filteredAndSortedPassengers.length} of{" "}
                    {passengers.length})
                </h3>
            </div>

            <div className="stats-grid">
                {Object.entries(stats).map(([key, val]) => (
                    <div
                        key={key}
                        className={`stat-card ${key} ${filterStatus === (key === 'total' ? 'all' : key.replace(/([A-Z])/g, "-$1").toLowerCase()) ? 'active' : ''}`}
                        onClick={() => handleStatClick(key)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="stat-value">{val}</div>
                        <div className="stat-label">{key.replace(/([A-Z])/g, " $1")}</div>
                    </div>
                ))}
            </div>

            <div className="filters-section">
                <div className="filter-group">
                    <label>🔍 PNR:</label>
                    <input
                        type="text"
                        value={searchPNR}
                        placeholder="Enter PNR..."
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            setSearchPNR(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="filter-input"
                    />
                </div>

                <div className="filter-group">
                    <label>📊 Status:</label>
                    <select
                        value={filterStatus}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            setFilterStatus(e.target.value as FilterStatus);
                            setCurrentPage(1);
                        }}
                        className="filter-select"
                    >
                        <option value="all">All</option>
                        <option value="boarded">✅ Boarded</option>
                        <option value="no-show">❌ No-Show</option>
                        <option value="not-boarded">⚠️ Missed</option>
                        <option value="upcoming">⏳ Upcoming</option>
                        <option value="cnf"> CNF</option>
                        <option value="rac"> RAC</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label> Class:</label>
                    <select
                        value={filterClass}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                            setFilterClass(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="filter-select"
                    >
                        <option value="all">All</option>
                        <option value="SL">Sleeper (SL)</option>
                        <option value="AC_3_Tier">AC 3-Tier (AC_3_Tier)</option>
                        <option value="2A">AC 2-Tier (2A)</option>
                    </select>
                </div>

                <button onClick={resetFilters} className="reset-btn">
                    🔄 Reset
                </button>
            </div>

            <div className="table-container">
                {filteredAndSortedPassengers.length === 0 ? (
                    <div className="no-results">
                        <p>No passengers match your filters</p>
                    </div>
                ) : (
                    <>
                        <table className="passengers-table">
                            <thead>
                                <tr>
                                    {[
                                        "pnr",
                                        "name",
                                        "age",
                                        "gender",
                                        "from",
                                        "to",
                                        "class",
                                        "pnrStatus",
                                        "racStatus",
                                        "berth",
                                        "berthType",
                                        "status",
                                    ].map((col) => (
                                        <th
                                            key={col}
                                            onClick={() => handleSort(col as SortColumn)}
                                            className="sortable"
                                        >
                                            {col.toUpperCase()}{" "}
                                            {sortBy === col && (sortOrder === "asc" ? "▲" : "▼")}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedPassengers.map((p, i) => {
                                    const status = getPassengerStatus(p);
                                    return (
                                        <tr key={`${p.pnr}-${i}`} className={`row-${status.class}`}>
                                            <td className="pnr-cell">{p.pnr}</td>
                                            <td className="name-cell">{p.name || "N/A"}</td>
                                            <td className="age-cell">{p.age || "N/A"}</td>
                                            <td className="gender-cell">{p.gender || "N/A"}</td>
                                            <td className="station-cell">{p.from || "N/A"}</td>
                                            <td className="station-cell">{p.to || "N/A"}</td>
                                            <td>
                                                <span className="class-badge">{p.class || "N/A"}</span>
                                            </td>
                                            <td>
                                                <span
                                                    className={`pnr-status-badge ${p.pnrStatus === "CNF" ? "cnf" : "rac"}`}
                                                >
                                                    {p.pnrStatus || "N/A"}
                                                </span>
                                            </td>
                                            <td className="rac-status-cell">
                                                <span
                                                    className={`rac-status-badge ${p.racStatus && p.racStatus !== "-" ? "rac-active" : "rac-inactive"}`}
                                                >
                                                    {p.racStatus || "-"}
                                                </span>
                                            </td>
                                            <td className="berth-cell">{p.berth}</td>
                                            <td className="berth-type-cell">{p.berthType}</td>
                                            <td>
                                                <span className={`status-badge ${status.class}`}>
                                                    {status.text}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className="page-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(1)}
                                >
                                    ⏮
                                </button>
                                <button
                                    className="page-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => p - 1)}
                                >
                                    ◀
                                </button>
                                <span className="page-info">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    className="page-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                >
                                    ▶
                                </button>
                                <button
                                    className="page-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(totalPages)}
                                >
                                    ⏭
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default PassengerList;

