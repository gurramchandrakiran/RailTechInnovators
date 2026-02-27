# 👮 RAC TTE Portal

The **TTE (Travelling Ticket Examiner) Portal** for the RAC Reallocation System. Built with **Vite + React 19** and **Material-UI**.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Opens at: **http://localhost:5174**

**Default Login:** `TTE_01` / `Prasanth@123`

---

## 📋 Features

| Feature | Description |
|---------|-------------|
| **Secure Login** | Employee ID + password authentication with JWT |
| **Dashboard** | Train stats, journey status, alerts, quick actions |
| **Passenger List** | View all passengers with filters, search, sorting |
| **Passenger Verification** | Verify boarding status via PNR |
| **No-Show Management** | Mark passengers as no-show with reason selection |
| **RAC Queue** | View RAC passengers by priority (RAC 1 → RAC 2 → ...) |
| **Vacant Berths** | Real-time vacant berth list |
| **Pending Reallocations** | Approve/reject RAC upgrade requests |
| **Journey Control** | Advance to next station, view progress |
| **Push Notifications** | Receive alerts for new RAC upgrade requests |
| **Action History** | View all actions with undo capability |
| **Token Auto-Refresh** | Seamless token refresh without re-login |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Vite 7.2** | Build tool and dev server |
| **React 19** | UI framework |
| **Material-UI** | Component library |
| **Recharts** | Data visualization |
| **Axios** | HTTP client with auto-refresh |
| **Web Push API** | Browser notifications |

---

## 📁 Project Structure

```
tte-portal/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Navbar/         # Navigation bar
│   │   ├── Sidebar/        # Side menu
│   │   └── PassengerCard/  # Passenger display card
│   ├── pages/              # 17 page components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Passengers.tsx
│   │   ├── PassengerDetails.tsx
│   │   ├── RACQueue.tsx
│   │   ├── VacantBerths.tsx
│   │   ├── PendingReallocationsPage.tsx
│   │   ├── ActionHistory.tsx
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   └── useWebSocket.ts
│   ├── services/           # API and push services
│   │   └── pushNotificationService.ts
│   ├── utils/              # Utility functions
│   │   └── pushManager.ts
│   ├── api.ts              # Axios instance with interceptors
│   ├── App.tsx             # Main router
│   └── main.tsx            # Entry point
├── public/
│   └── sw.js               # Service worker for push notifications
├── vite.config.js          # Vite configuration (port 5174)
└── package.json
```

---

## 📖 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 5174) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## 🔧 Configuration

Create `.env` file (optional - has defaults):

```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
```

---

## 📊 Pages Overview

| Page | Description |
|------|-------------|
| **Login** | Secure TTE authentication |
| **Dashboard** | Train overview, stats, alerts |
| **All Passengers** | Complete passenger list with search |
| **Passenger Details** | Individual passenger info and actions |
| **RAC Queue** | RAC passengers by priority |
| **Vacant Berths** | Currently available berths |
| **Pending Reallocations** | Approve/reject upgrade requests |
| **Action History** | Audit trail with undo |
| **Journey Progress** | Station-by-station progress |

---

## 🔔 Workflow

### No-Show → Reallocation Flow

```
1. TTE marks passenger as NO-SHOW
   └── Berth becomes vacant

2. System identifies eligible RAC passengers
   └── Boarded + journey coverage match

3. Pending Reallocations page shows candidates
   └── Sorted by RAC priority (RAC 1 first)

4. TTE approves reallocation
   └── Passenger receives push notification

5. Passenger accepts offer
   └── Status upgrades from RAC → CNF
```

---

## 🔐 Authentication Flow

| Step | Action |
|------|--------|
| 1 | User enters Employee ID + Password |
| 2 | Backend validates and returns JWT (1 hour) + Refresh Token (7 days) |
| 3 | Tokens stored in localStorage |
| 4 | API calls include `Authorization: Bearer <token>` |
| 5 | On 401 error, auto-refresh using refresh token |
| 6 | On 403 error, redirect to login |

---

## 🔔 Push Notifications

The portal supports browser push notifications for:
- New pending reallocations
- Passenger upgrade responses
- Journey alerts

**Setup:**
1. Allow notifications when prompted
2. Browser creates push subscription
3. Notifications work even when browser is closed

Requires HTTPS in production (localhost exempt).

---

## 🎨 UI Features

| Feature | Description |
|---------|-------------|
| **Dark/Light Mode** | Theme switching |
| **Responsive Design** | Mobile-friendly layout |
| **Real-time Updates** | WebSocket-powered live data |
| **Toast Notifications** | In-app alert messages |
| **Loading States** | Skeleton screens and spinners |

---

## 🔗 Related

- [Root Documentation](../README.md)
- [README.md](../README.md)
- [Backend API](../backend/README.md)
- [Frontend (Admin)](../admin-portal/README.md)
- [Passenger Portal](../passenger-portal/README.md)

---

**Last Updated:** 2025-12-23
