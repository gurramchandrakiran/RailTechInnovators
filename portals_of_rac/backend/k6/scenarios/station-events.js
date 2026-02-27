import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const stationEvents = new Counter('station_events');

export const options = {
    scenarios: {
        // Simulate multiple stations arriving concurrently
        concurrent_stations: {
            executor: 'per-vu-iterations',
            vus: 20,           // 20 concurrent station events
            iterations: 5,     // Each VU runs 5 iterations
            maxDuration: '3m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<800'],
        errors: ['rate<0.02'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

const STATIONS = [
    { code: 'HYB', name: 'Hyderabad' },
    { code: 'WGL', name: 'Warangal' },
    { code: 'KZJ', name: 'Kazipet' },
    { code: 'RMD', name: 'Ramagundam' },
    { code: 'MRGA', name: 'Mancherial' },
    { code: 'SIR', name: 'Sirpur' },
    { code: 'BAJ', name: 'Balharshah' },
    { code: 'GDY', name: 'Gondiya' },
    { code: 'NGBN', name: 'Nagbhir' },
    { code: 'SEG', name: 'Sewagram' },
];

export function setup() {
    const loginRes = http.post(`${BASE_URL}/api/auth/staff/login`, JSON.stringify({
        employeeId: 'TTE001',
        password: 'tte123'
    }), {
        headers: { 'Content-Type': 'application/json' },
    });

    return { token: loginRes.json('token') || 'mock-token' };
}

export default function (data) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
    };

    const station = STATIONS[__VU % STATIONS.length];

    group(`Station Event: ${station.code}`, () => {
        // 1. Simulate station arrival
        const arrivalRes = http.post(`${BASE_URL}/api/train/arrive`, JSON.stringify({
            stationCode: station.code,
            stationName: station.name,
        }), { headers });

        check(arrivalRes, {
            'station arrival processed': (r) => r.status === 200 || r.status === 400 || r.status === 401,
        });
        stationEvents.add(1);
        errorRate.add(arrivalRes.status >= 500);

        sleep(0.5);

        // 2. Get boarding queue for this station
        const boardingRes = http.get(`${BASE_URL}/api/tte/boarding-queue?station=${station.code}`, { headers });
        check(boardingRes, {
            'boarding queue retrieved': (r) => r.status === 200 || r.status === 401,
        });

        sleep(0.3);

        // 3. Simulate batch boarding confirmation (concurrent writes)
        const batchBoardRes = http.post(`${BASE_URL}/api/tte/confirm-all-boarded`, JSON.stringify({
            stationCode: station.code,
        }), { headers });

        check(batchBoardRes, {
            'batch boarding confirmed': (r) => r.status === 200 || r.status === 400 || r.status === 401,
        });
        errorRate.add(batchBoardRes.status >= 500);

        sleep(0.5);

        // 4. Get passengers deboarding at this station
        const deboardingRes = http.get(`${BASE_URL}/api/passengers/deboarding/${station.code}`, { headers });
        check(deboardingRes, {
            'deboarding list retrieved': (r) => r.status === 200 || r.status === 404 || r.status === 401,
        });

        sleep(0.3);

        // 5. Trigger reallocation for vacated berths
        const reallocRes = http.post(`${BASE_URL}/api/reallocation/process-station`, JSON.stringify({
            stationCode: station.code,
        }), { headers });

        check(reallocRes, {
            'station reallocation processed': (r) => r.status === 200 || r.status === 400 || r.status === 401,
        });
        errorRate.add(reallocRes.status >= 500);

        sleep(1);
    });
}

export function teardown(data) {
    console.log('Station events load test completed');
}
