// admin-portal/src/components/APIDocumentationLink.tsx
// Component for linking to Swagger API documentation

import React, { useState } from 'react';
import '../styles/components/APIDocumentationLink.css';

function APIDocumentationLink(): React.ReactElement {
    const [showTooltip, setShowTooltip] = useState<boolean>(false);

    const API_DOCS_URL = import.meta.env.VITE_API_DOCS_URL || 'http://localhost:5000/api-docs';

    return (
        <div className="api-docs-link">
            <button
                className="api-docs-button"
                onClick={() => window.open(API_DOCS_URL, '_blank', 'noopener,noreferrer')}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                title="Open API Documentation"
            >
                <span className="docs-icon"></span>
                <span className="docs-label">API Docs</span>
            </button>
            {showTooltip && (
                <div className="tooltip">
                    <p>Interactive API Documentation (Swagger)</p>
                    <p className="url">{API_DOCS_URL}</p>
                </div>
            )}
        </div>
    );
}

export default APIDocumentationLink;

