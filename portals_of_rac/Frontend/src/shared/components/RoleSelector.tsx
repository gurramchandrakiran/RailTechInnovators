// Frontend/src/shared/components/RoleSelector.tsx
// Landing page with 3 role cards — user picks their portal
import React, { useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './RoleSelector.css';

function RoleSelector(): React.ReactElement {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const rippleRef = useRef<HTMLDivElement>(null);
    const trailRefs = useRef<HTMLDivElement[]>([]);
    const rafRef = useRef<number>(0);
    const mousePos = useRef({ x: 0, y: 0 });

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        mousePos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const { x, y } = mousePos.current;

            // Main ripple glow follows cursor
            if (rippleRef.current) {
                rippleRef.current.style.left = `${x}px`;
                rippleRef.current.style.top = `${y}px`;
                rippleRef.current.style.opacity = '1';
            }

            // Trailing ripples with delay
            trailRefs.current.forEach((trail, i) => {
                if (trail) {
                    const delay = (i + 1) * 60;
                    setTimeout(() => {
                        trail.style.left = `${x}px`;
                        trail.style.top = `${y}px`;
                        trail.style.opacity = String(0.5 - i * 0.12);
                    }, delay);
                }
            });
        });
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (rippleRef.current) rippleRef.current.style.opacity = '0';
        trailRefs.current.forEach(trail => {
            if (trail) trail.style.opacity = '0';
        });
    }, []);

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const roles = [
        {
            id: 'admin',
            emoji: '\u{1F6E1}\uFE0F',
            title: 'Admin Portal',
            description: 'Train configuration, journey control, real-time monitoring & analytics',
            color: '#2dd4a0',
        },
        {
            id: 'tte',
            emoji: '\u{1F4CB}',
            title: 'TTE Portal',
            description: 'Boarding verification, no-show marking, RAC upgrades & passenger management',
            color: '#34d399',
        },
        {
            id: 'passenger',
            emoji: '\u{1F3AB}',
            title: 'Passenger Portal',
            description: 'Track your PNR status, view upgrade offers & manage your journey',
            color: '#6ee7b7',
        },
    ];

    return (
        <div
            className="role-selector-container"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* Main cursor ripple */}
            <div className="cursor-ripple" ref={rippleRef} />
            {/* Trailing ripples for water-drag effect */}
            {[0, 1, 2].map(i => (
                <div
                    key={i}
                    className={`cursor-trail cursor-trail-${i}`}
                    ref={el => { if (el) trailRefs.current[i] = el; }}
                />
            ))}

            <div className="role-selector-header">
                <h1>{'\u{1F682}'} Dynamic RAC Reallocation System</h1>
                <p>Select your portal to continue</p>
            </div>
            <div className="role-cards">
                {roles.map((role) => (
                    <div
                        key={role.id}
                        className="role-card"
                        style={{ '--card-accent': role.color } as React.CSSProperties}
                        onClick={() => navigate(`/login?role=${role.id}`)}
                    >
                        <div className="role-card-emoji">{role.emoji}</div>
                        <h2>{role.title}</h2>
                        <p>{role.description}</p>
                        <div className="role-card-arrow">{'\u2192'}</div>
                    </div>
                ))}
            </div>
            <div className="role-selector-footer">
                <p>{'\u00A9'} 2025 Indian Railways {'\u2014'} Dynamic RAC Reallocation System</p>
            </div>
        </div>
    );
}

export default RoleSelector;
