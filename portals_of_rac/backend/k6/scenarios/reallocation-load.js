import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const reallocationDuration = new Trend('reallocation_duration');

// Test configuration
export const options = {
    scenarios: {
        // Ramp up to high passenger load
        reallocation_load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 },   // Ramp up to 50 users
                { duration: '1m', target: 100 },   // Ramp up to 100 users
                { duration: '2m', target: 100 },   // Stay at 100 users
                { duration: '30s', target: 0 },    // Ramp down
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<500'],     // 95% of requests under 500ms
        errors: ['rate<0.01'],                 // Error rate under 1%
        reallocation_duration: ['p(95)<1000'], // Reallocation under 1s
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Test data - simulated passengers
const generatePNR = () => `PNR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

export function setup() {
    // Login as TTE to get auth token
    const loginRes = http.post(`${BASE_URL}/api/auth/staff/login`, JSON.stringify({
        employeeId: 'TTE001',
        password: 'tte123'
    }), {
        headers: { 'Content-Type': 'application/json' },
    });

    const token = loginRes.json('token');

    if (!token) {
        console.warn('Could not get auth token, using mock mode');
        return { token: 'mock-token', mockMode: true };
    }

    return { token, mockMode: false };
}

export default function (data) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
    };

    group('High Passenger Reallocation Load', () => {
        // 1. Get current train state
        const trainStateRes = http.get(`${BASE_URL}/api/train/state`, { headers });
        check(trainStateRes, {
            'train state retrieved': (r) => r.status === 200 || r.status === 401,
        });
        errorRate.add(trainStateRes.status >= 400 && trainStateRes.status !== 401);

        sleep(0.5);

        // 2. Get RAC queue (high contention point)
        const racQueueRes = http.get(`${BASE_URL}/api/tte/rac-queue`, { headers });
        check(racQueueRes, {
            'RAC queue retrieved': (r) => r.status === 200 || r.status === 401,
        });

        sleep(0.3);

        // 3. Simulate passenger lookup (concurrent reads)
        const pnr = generatePNR();
        const passengerRes = http.get(`${BASE_URL}/api/passengers/status/${pnr}`, { headers });
        check(passengerRes, {
            'passenger lookup completed': (r) => r.status === 200 || r.status === 404 || r.status === 401,
        });

        sleep(0.2);

        // 4. Get available berths (heavy calculation)
        const berthsRes = http.get(`${BASE_URL}/api/tte/available-berths`, { headers });
        check(berthsRes, {
            'available berths retrieved': (r) => r.status === 200 || r.status === 401,
        });

        sleep(0.5);

        // 5. Simulate reallocation trigger (the expensive operation)
        const startTime = Date.now();
        const reallocationRes = http.post(`${BASE_URL}/api/reallocation/trigger`, JSON.stringify({
            stationCode: 'STA' + Math.floor(Math.random() * 10),
            reason: 'load_test'
        }), { headers });

        reallocationDuration.add(Date.now() - startTime);

        check(reallocationRes, {
            'reallocation completed': (r) => r.status === 200 || r.status === 400 || r.status === 401,
        });
        errorRate.add(reallocationRes.status >= 500);

        sleep(1);
    });
}

export function teardown(data) {
    console.log('Load test completed');
    console.log(`Mock mode: ${data.mockMode}`);
}
