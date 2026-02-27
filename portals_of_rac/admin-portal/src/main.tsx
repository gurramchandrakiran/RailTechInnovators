import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/responsive-global.css';
import './styles/viewport-scale.css';
import App from './App';

// Error Boundary to catch runtime crashes
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
    componentDidCatch(error: any, info: any) { console.error(' React Error Boundary caught:', error, info); }
    render() {
        if (this.state.hasError) {
            return <div style={{ padding: 40, color: '#c0392b', fontFamily: 'monospace' }}>
                <h2>⚠️ App Crashed</h2>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(this.state.error)}</pre>
                <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 16px' }}>Reload</button>
            </div>;
        }
        return this.props.children;
    }
}

// Create root for React 19
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find root element');

const root = ReactDOM.createRoot(rootElement);

// Render App
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);
