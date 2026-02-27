/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
    admin: {
        employeeId: 'ADM001',
        password: 'admin123',
        name: 'Test Admin',
        role: 'Admin',
    },
    tte: {
        employeeId: 'TTE001',
        password: 'tte123',
        name: 'Test TTE',
        role: 'TTE',
    },
};

export const testPassenger = {
    pnr: '1234567890',
    phone: '9876543210',
    name: 'Test Passenger',
    coach: 'S1',
    berth: 'RAC',
    berthNumber: 1,
    boardingStation: 'HYB',
    destinationStation: 'NGP',
};

export const testTrain = {
    trainNumber: '17225',
    trainName: 'Amaravati Express',
    source: 'HYB',
    destination: 'NGP',
    stations: [
        { code: 'HYB', name: 'Hyderabad', idx: 0 },
        { code: 'WGL', name: 'Warangal', idx: 1 },
        { code: 'KZJ', name: 'Kazipet', idx: 2 },
        { code: 'RMD', name: 'Ramagundam', idx: 3 },
        { code: 'BAJ', name: 'Balharshah', idx: 4 },
        { code: 'NGP', name: 'Nagpur', idx: 5 },
    ],
};

export const testUrls = {
    adminPortal: 'http://localhost:5173',
    passengerPortal: 'http://localhost:5174',
    ttePortal: 'http://localhost:5175',
    api: 'http://localhost:5000',
};

/**
 * Helper to generate unique PNR for tests
 */
export function generateTestPNR(): string {
    return `TEST${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

/**
 * Helper to wait for API response
 */
export async function waitForApiReady(baseUrl: string, timeout = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const response = await fetch(`${baseUrl}/api/health`);
            if (response.ok) return true;
        } catch (e) {
            // API not ready yet
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}
