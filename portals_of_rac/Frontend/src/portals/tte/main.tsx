// tte-portal/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/responsive-global.css';
import './styles/viewport-scale.css';
import App from './App';

// Register service worker for TTE push notifications
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then((reg: ServiceWorkerRegistration) => console.log('✅ TTE Service Worker registered:', reg.scope))
        .catch((err: Error) => console.error('❌ TTE SW registration failed:', err));
}

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
