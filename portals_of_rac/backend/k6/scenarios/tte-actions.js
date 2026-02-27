import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const tteActions = new Counter('tte_actions');
const actionDuration = new Trend('action_duration');

export const options = {
    scenarios: {
        // Multiple TTEs performing actions simultaneously
        concurrent_tte_actions: {
            executor: 'constant-vus',
            vus: 10,           // 10 TTEs acting concurrently
            duration: '2m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<600'],
        errors: ['rate<0.02'],
        action_duration: ['p(95)<800'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Simulated TTE credentials
const TTE_ACCOUNTS = [
    { id: 'TTE001', password: 'tte123' },
    { id: 'TTE002', password: 'tte123' },
    { id: 'TTE003', password: 'tte123' },
    { id: 'TTE004', password: 'tte123' },
    { id: 'TTE005', password: 'tte123' },
];

// Generate random PNR for testing
const generatePNR = () => `PNR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

export function setup() {
    // Login multiple TTEs
    const tokens = [];

    for (const tte of TTE_ACCOUNTS) {
        const loginRes = http.post(`${BASE_URL}/api/auth/staff/login`, JSON.stringify({
            employeeId: tte.id,
            password: tte.password
        }), {
            headers: { 'Content-Type': 'application/json' },
        });

        tokens.push({
            tteId: tte.id,
            token: loginRes.json('token') || 'mock-token'
        });
    }

    return { tokens };
}

export default function (data) {
    const tteData = data.tokens[__VU % data.tokens.length];
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tteData.token}`,
    };

    // Randomly select an action type
    const actionType = Math.floor(Math.random() * 5);

    group(`TTE Action: ${tteData.tteId}`, () => {
        const startTime = Date.now();

        switch (actionType) {
            case 0:
                // Mark No-Show
                group('Mark No-Show', () => {
                    const pnr = generatePNR();
                    const res = http.post(`${BASE_URL}/api/tte/mark-no-show`, JSON.stringify({
                        pnr: pnr,
                        reason: 'Passenger did not board'
                    }), { headers });

                    check(res, {
                        'no-show marked': (r) => r.status === 200 || r.status === 400 || r.status === 404 || r.status === 401,
                    });
                    tteActions.add(1);
                    errorRate.add(res.status >= 500);
                });
                break;

            case 1:
                // Confirm Boarding
                group('Confirm Boarding', () => {
                    const pnr = generatePNR();
                    const res = http.post(`${BASE_URL}/api/tte/confirm-boarding`, JSON.stringify({
                        pnr: pnr,
                        stationCode: 'HYB'
                    }), { headers });

                    check(res, {
                        'boarding confirmed': (r) => r.status === 200 || r.status === 400 || r.status === 404 || r.status === 401,
                    });
                    tteActions.add(1);
                    errorRate.add(res.status >= 500);
                });
                break;

            case 2:
                // Add Offline Upgrade
                group('Add Offline Upgrade', () => {
                    const pnr = generatePNR();
                    const res = http.post(`${BASE_URL}/api/tte/offline-upgrade`, JSON.stringify({
                        pnr: pnr,
                        newCoach: 'S1',
                        newBerth: 'LB',
                        berthNumber: Math.floor(Math.random() * 72) + 1
                    }), { headers });

                    check(res, {
                        'offline upgrade added': (r) => r.status === 200 || r.status === 400 || r.status === 404 || r.status === 401,
                    });
                    tteActions.add(1);
                    errorRate.add(res.status >= 500);
                });
                break;

            case 3:
                // Get Passengers List
                group('Get Passengers List', () => {
                    const res = http.get(`${BASE_URL}/api/tte/passengers?coach=S1`, { headers });

                    check(res, {
                        'passengers retrieved': (r) => r.status === 200 || r.status === 401,
                    });
                    tteActions.add(1);
                    errorRate.add(res.status >= 500);
                });
                break;

            case 4:
                // Get Upgraded Passengers
                group('Get Upgraded Passengers', () => {
                    const res = http.get(`${BASE_URL}/api/tte/upgraded-passengers`, { headers });

                    check(res, {
                        'upgraded passengers retrieved': (r) => r.status === 200 || r.status === 401,
                    });
                    tteActions.add(1);
                    errorRate.add(res.status >= 500);
                });
                break;
        }

        actionDuration.add(Date.now() - startTime);
    });

    sleep(Math.random() * 2 + 0.5); // Random delay 0.5-2.5s
}

export function teardown(data) {
    console.log('TTE actions load test completed');
    console.log(`Total TTEs simulated: ${data.tokens.length}`);
}
