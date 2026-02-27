// admin-portal/src/components/common/LoadingSpinner.tsx
// Example TypeScript React component

import React from 'react';

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    message?: string;
    fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'medium',
    message = 'Loading...',
    fullScreen = false
}) => {
    const sizeMap: Record<string, string> = {
        small: '24px',
        medium: '40px',
        large: '60px'
    };

    const spinnerStyle: React.CSSProperties = {
        width: sizeMap[size],
        height: sizeMap[size],
        border: '3px solid #e1e8ed',
        borderTop: '3px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    };

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '20px',
        ...(fullScreen && {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            zIndex: 9999
        })
    };

    return (
        <div style={containerStyle}>
            <style>
                {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
            </style>
            <div style={spinnerStyle}></div>
            {message && (
                <p style={{
                    margin: 0,
                    color: '#5a6c7d',
                    fontSize: size === 'small' ? '12px' : '14px'
                }}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default LoadingSpinner;
