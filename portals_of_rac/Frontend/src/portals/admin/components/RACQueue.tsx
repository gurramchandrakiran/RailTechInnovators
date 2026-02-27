// admin-portal/src/components/RACQueue.tsx

import React from "react";
import "../styles/components/RACQueue.css";

interface RACPassenger {
    pnr: string;
    name: string;
    age: number;
    gender: string;
    class: string;
    racStatus?: string;
    racNumber?: number;
    berthType?: string;
    Boarding_Station?: string;
    Deboarding_Station?: string;
}

interface RACQueueProps {
    racQueue?: RACPassenger[];
}

function RACQueue({ racQueue = [] }: RACQueueProps): React.ReactElement {
    if (!racQueue.length) {
        return (
            <div className="rac-queue-panel">
                <h3 className="panel-header"> RAC Queue (0 passengers)</h3>
                <div className="empty-queue">
                    <p>✅ No RAC passengers in queue - All confirmed!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rac-queue-panel">
            <h3 className="panel-header">
                 RAC Queue ({racQueue.length} passengers)
            </h3>

            <div className="rac-table-container">
                <table className="rac-table">
                    <thead>
                        <tr>
                            <th>Position</th>
                            <th>RAC No.</th>
                            <th>PNR</th>
                            <th>Name</th>
                            <th>Age/Gender</th>
                            <th>Class</th>
                            <th>Berth Type</th>
                            <th>From → To</th>
                        </tr>
                    </thead>
                    <tbody>
                        {racQueue.slice(0, 20).map((p, idx) => (
                            <tr key={p.pnr} className={idx < 5 ? "priority-high" : ""}>
                                <td className="position">{idx + 1}</td>
                                <td className="rac-number">
                                    {p.racStatus || `RAC ${p.racNumber}`}
                                </td>
                                <td className="pnr">{p.pnr}</td>
                                <td className="name">{p.name}</td>
                                <td className="age-gender">
                                    {p.age}/{p.gender}
                                </td>
                                <td className="class">{p.class}</td>
                                <td className="berth-type">{p.berthType || "-"}</td>
                                <td className="journey">
                                    {p.Boarding_Station} → {p.Deboarding_Station}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {racQueue.length > 20 && (
                    <div className="queue-footer">
                        ... and {racQueue.length - 20} more passengers in queue
                    </div>
                )}
            </div>
        </div>
    );
}

export default RACQueue;

