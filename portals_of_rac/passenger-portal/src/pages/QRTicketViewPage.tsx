// passenger-portal/src/pages/QRTicketViewPage.tsx
// Standalone page for viewing ticket details when scanned from a QR code.
// Reads passenger data from URL search parameter (?data=base64) so it works
// without authentication — perfect for TTE verification.

import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/pages/QRTicketViewPage.css";

interface TicketData {
  pnr: string;
  name: string;
  train: string;
  trainName: string;
  date: string;
  status: string;
  coach: string;
  berth: string;
  berthType: string;
  class: string;
  from: string;
  to: string;
  upgraded: boolean;
  upgradedFrom: string | null;
  age?: number | null;
  gender?: string | null;
  irctcId?: string | null;
  email?: string | null;
  phone?: string | null;
  generated: string;
}

function QRTicketViewPage(): React.ReactElement {
  const [searchParams] = useSearchParams();

  const ticket: TicketData | null = useMemo(() => {
    const encoded = searchParams.get("data");
    if (!encoded) return null;
    try {
      // Reverse URL-safe base64: - back to +, _ back to /, re-add padding
      let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) base64 += '=';
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }, [searchParams]);

  if (!ticket) {
    return (
      <div className="qr-ticket-page">
        <div className="qr-ticket-error">
          <div className="error-icon">⚠️</div>
          <h2>Invalid Ticket QR Code</h2>
          <p>Could not decode ticket data from this QR code.</p>
        </div>
      </div>
    );
  }

  const statusClass =
    ticket.status === "CNF"
      ? "status-cnf"
      : ticket.status === "RAC"
        ? "status-rac"
        : "status-wl";

  return (
    <div className="qr-ticket-page">
      <div className="qr-ticket-card">
        {/* Header */}
        <div className="ticket-header">
          <div className="ticket-header-icon">🚂</div>
          <div>
            <h1>E-Boarding Pass</h1>
            <p>Indian Railways — RAC Reallocation System</p>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`ticket-status-banner ${statusClass}`}>
          <span className="status-label">{ticket.status}</span>
          {ticket.upgraded && (
            <span className="upgraded-badge">
              ⬆️ Upgraded from {ticket.upgradedFrom}
            </span>
          )}
        </div>

        {/* Passenger Info */}
        <div className="ticket-section">
          <h3>👤 Passenger Details</h3>
          <div className="ticket-grid">
            <div className="ticket-field ticket-field--full">
              <span className="field-label">Name</span>
              <span className="field-value name-value">{ticket.name}</span>
            </div>
            <div className="ticket-field">
              <span className="field-label">PNR Number</span>
              <span className="field-value pnr-value">{ticket.pnr}</span>
            </div>
            {ticket.age != null && (
              <div className="ticket-field">
                <span className="field-label">Age</span>
                <span className="field-value">{ticket.age} yrs</span>
              </div>
            )}
            {ticket.gender && (
              <div className="ticket-field">
                <span className="field-label">Gender</span>
                <span className="field-value">{ticket.gender}</span>
              </div>
            )}
          </div>
        </div>

        {/* Account / Signup Info */}
        {(ticket.irctcId || ticket.email || ticket.phone) && (
          <div className="ticket-section ticket-section--account">
            <h3>🪪 Account Details</h3>
            <div className="ticket-grid">
              {ticket.irctcId && (
                <div className="ticket-field">
                  <span className="field-label">IRCTC ID</span>
                  <span className="field-value irctc-value">
                    {ticket.irctcId}
                  </span>
                </div>
              )}
              {ticket.email && (
                <div className="ticket-field">
                  <span className="field-label">Email</span>
                  <span className="field-value">{ticket.email}</span>
                </div>
              )}
              {ticket.phone && (
                <div className="ticket-field">
                  <span className="field-label">Phone</span>
                  <span className="field-value">{ticket.phone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Train Info */}
        <div className="ticket-section">
          <h3>🚆 Train Details</h3>
          <div className="ticket-grid">
            <div className="ticket-field ticket-field--full">
              <span className="field-label">Train</span>
              <span className="field-value">
                {ticket.trainName} ({ticket.train})
              </span>
            </div>
            <div className="ticket-field">
              <span className="field-label">Date</span>
              <span className="field-value">{ticket.date}</span>
            </div>
            <div className="ticket-field">
              <span className="field-label">Class</span>
              <span className="field-value">{ticket.class}</span>
            </div>
          </div>
        </div>

        {/* Journey */}
        <div className="ticket-section">
          <h3>📍 Journey</h3>
          <div className="journey-route">
            <div className="route-point">
              <span className="route-dot from-dot"></span>
              <div>
                <span className="route-label">From</span>
                <span className="route-station">{ticket.from}</span>
              </div>
            </div>
            <div className="route-line"></div>
            <div className="route-point">
              <span className="route-dot to-dot"></span>
              <div>
                <span className="route-label">To</span>
                <span className="route-station">{ticket.to}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Seat Info */}
        <div className="ticket-section seat-section">
          <h3>💺 Seat Allocation</h3>
          <div className="seat-info">
            <div className="seat-block">
              <span className="seat-label">Coach</span>
              <span className="seat-number">{ticket.coach}</span>
            </div>
            <div className="seat-divider"></div>
            <div className="seat-block">
              <span className="seat-label">Berth</span>
              <span className="seat-number">{ticket.berth}</span>
            </div>
            <div className="seat-divider"></div>
            <div className="seat-block">
              <span className="seat-label">Type</span>
              <span className="seat-number">{ticket.berthType}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ticket-footer">
          <p>Generated: {new Date(ticket.generated).toLocaleString()}</p>
          <p className="verify-note">
            ✅ Show this pass to the TTE for verification
          </p>
        </div>
      </div>
    </div>
  );
}

export default QRTicketViewPage;
