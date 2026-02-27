# 🎫 RAC Passenger Portal

The **Passenger Portal** for the RAC Reallocation System. Built with **Vite + React 19** and **Material-UI**.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Opens at: **http://localhost:5175**

**Default Login:** `IR_0001` / `Prasanth@123` (IRCTC ID)

---

## 📋 Features

| Feature | Description |
|---------|-------------|
| **IRCTC Login** | Secure authentication with JWT tokens |
| **PNR Check** | View journey details and current status |
| **Dashboard** | Current booking, journey progress, notifications |
| **Upgrade Offers** | Real-time offers with countdown timers |
| **Accept/Deny** | Respond to upgrade offers instantly |
| **QR Code Pass** | Boarding pass with dynamic QR code |
| **Push Notifications** | Browser notifications for offers (even when closed) |
| **Ticket Actions** | Cancel ticket, change boarding station |
| **History** | Past offers and journey history |
| **No-Show Self-Revert** | Request to revert accidental no-show marking |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Vite 7.2** | Build tool and dev server |
| **React 19** | UI framework |
| **Material-UI** | Component library |
| **Axios** | HTTP client with token refresh |
| **qrcode.react** | QR code generation |
| **Web Push API** | Browser notifications |

---

## 📁 Project Structure

```
passenger-portal/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── UpgradeOfferCard/   # Upgrade offer display
│   │   ├── QRBoardingPass/     # QR code pass component
│   │   └── NotificationBanner/ # Notification display
│   ├── pages/              # 10 page components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── PNRCheck.tsx
│   │   ├── UpgradeOffers.tsx
│   │   ├── BoardingPass.tsx
│   │   ├── OfferHistory.tsx
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   └── useNotifications.ts
│   ├── services/           # API services
│   │   └── api.ts
│   ├── utils/              # Utility functions
│   │   └── countdown.ts
│   ├── config/             # App configuration
│   ├── App.tsx             # Main router
│   └── main.tsx            # Entry point
├── public/
│   └── sw.js               # Service worker for push notifications
├── vite.config.js          # Vite configuration (port 5175)
└── package.json
```

---

## 📖 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 5175) |
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
| **Login** | IRCTC ID + Password authentication |
| **Dashboard** | Current booking status, journey progress |
| **PNR Check** | Enter PNR to view details |
| **Upgrade Offers** | Active offers with countdown timers |
| **Boarding Pass** | QR code for verification |
| **Offer History** | Past accepted/denied offers |
| **Notifications** | All notification history |
| **Profile** | Account settings |

---

## 🔔 Upgrade Offer Flow

```
1. TTE approves your RAC upgrade
   └── You receive push notification

2. Open "Upgrade Offers" page
   └── See countdown timer (5 minutes default)

3. View offer details
   ├── Current: RAC berth (e.g., S1-72)
   └── Upgrade: CNF berth (e.g., S1-15, Lower Berth)

4. Choose action
   ├── ACCEPT → Get upgraded to CNF
   └── DENY → Stay in RAC, offer goes to next passenger

5. After acceptance
   └── Download new boarding pass with QR code
```

---

## 🔔 Push Notifications

The portal sends browser push notifications for:

| Event | Notification |
|-------|--------------|
| **Upgrade Available** | "You have a new upgrade offer! Tap to view" |
| **Offer Expiring** | "Your upgrade offer expires in 1 minute" |
| **Upgrade Confirmed** | "Congratulations! You've been upgraded to CNF" |
| **No-Show Marked** | "You've been marked as no-show by TTE" |

**How it works:**
1. User grants notification permission
2. Browser creates push subscription
3. Subscription stored in MongoDB
4. Backend sends push via VAPID keys
5. Notification appears even when browser is closed

Requires HTTPS in production (localhost exempt).

---

## 🎫 QR Boarding Pass

The boarding pass includes:

| Field | Example |
|-------|---------|
| **PNR** | 1234567890 |
| **Name** | John Doe |
| **Status** | CNF (or RAC) |
| **Coach** | S1 |
| **Berth** | 15 |
| **Berth Type** | Lower Berth |
| **From** | Vijayawada (BZA) |
| **To** | Visakhapatnam (VSKP) |
| **QR Code** | Scannable by TTE |

TTE can scan QR code to verify passenger identity.

---

## 🔐 Authentication

| Token Type | Duration | Purpose |
|------------|----------|---------|
| **Access Token** | 1 hour | API authentication |
| **Refresh Token** | 7 days | Get new access tokens |

Tokens are automatically refreshed on 401 errors.

---

## 🎨 UI Features

| Feature | Description |
|---------|-------------|
| **Responsive Design** | Works on mobile and desktop |
| **Real-time Updates** | WebSocket-powered live status |
| **Countdown Timers** | Visual offer expiration |
| **Toast Notifications** | In-app alert messages |
| **Loading States** | Skeleton screens |

---

## 🔗 Related

- [Root Documentation](../README.md)
- [README.md](../README.md)
- [Backend API](../backend/README.md)
- [Frontend (Admin)](../admin-portal/README.md)
- [TTE Portal](../tte-portal/README.md)

---

**Last Updated:** 2025-12-23
