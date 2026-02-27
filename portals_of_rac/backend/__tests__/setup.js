// Test setup file
// Mock common dependencies and provide cleanup

// Increase default timeout
jest.setTimeout(10000);

// Suppress console output during tests (less noise)
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Cleanup after all tests
afterAll(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Clear all timers (prevents ReferenceError from pending setTimeout)
    jest.clearAllTimers();
    jest.useRealTimers();

    // Reset modules to clear any cached state
    jest.resetModules();

    // Small delay to allow any pending async operations to complete
    await new Promise(resolve => setImmediate(resolve));
});

// Mock trainState for testing
global.mockTrainState = {
    trainNumber: '17225',
    trainName: 'Test Express',
    currentStationIdx: 2,
    journeyStarted: true,
    stations: [
        { code: 'STA1', name: 'Station 1', idx: 0 },
        { code: 'STA2', name: 'Station 2', idx: 1 },
        { code: 'STA3', name: 'Station 3', idx: 2 },
        { code: 'STA4', name: 'Station 4', idx: 3 },
        { code: 'STA5', name: 'Station 5', idx: 4 },
    ],
    coaches: [
        {
            coachNo: 'S1',
            class: 'SL',
            berths: [
                { berthNo: 1, type: 'LB', segments: [] },
                { berthNo: 2, type: 'MB', segments: [] },
                { berthNo: 3, type: 'UB', segments: [] },
            ]
        }
    ],
    racQueue: [],
    stats: {
        totalPassengers: 0,
        confirmed: 0,
        rac: 0,
        noShow: 0
    },
    getAllPassengers: jest.fn().mockReturnValue([]),
    findPassengerByPNR: jest.fn().mockReturnValue(null),
    findBerth: jest.fn().mockReturnValue(null),
    isJourneyComplete: jest.fn().mockReturnValue(false)
};

// Mock passenger data
global.mockPassenger = {
    pnr: '1234567890',
    name: 'Test Passenger',
    age: 30,
    gender: 'M',
    status: 'CNF',
    coach: 'S1',
    berth: 1,
    berthType: 'LB',
    fromStation: 'STA1',
    toStation: 'STA5',
    fromIdx: 0,
    toIdx: 4,
    boarded: false,
    irctcId: 'test@irctc.com'
};

// Mock RAC passenger
global.mockRACPassenger = {
    pnr: '9876543210',
    name: 'RAC Passenger',
    age: 25,
    gender: 'F',
    status: 'RAC',
    racStatus: 'RAC-1',
    fromStation: 'STA2',
    toStation: 'STA5',
    fromIdx: 1,
    toIdx: 4,
    boarded: true,
    passengerStatus: 'Online',
    irctcId: 'rac@irctc.com'
};
