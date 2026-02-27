/**
 * DataService Tests - Comprehensive Coverage
 * Tests for train data loading, passenger allocation, and station management
 */

const DataService = require('../../services/DataService');
const db = require('../../config/db');
const TrainState = require('../../models/TrainState');

jest.mock('../../config/db');
jest.mock('../../models/TrainState');

describe('DataService - Comprehensive Tests', () => {
    let mockStationsCollection;
    let mockPassengersCollection;
    let mockTrainDetailsCollection;
    let mockTrainState;

    beforeEach(() => {
        jest.clearAllMocks();

        mockStationsCollection = {
            find: jest.fn(() => ({
                sort: jest.fn(() => ({
                    toArray: jest.fn()
                }))
            })),
            findOne: jest.fn()
        };

        mockPassengersCollection = {
            find: jest.fn(() => ({
                toArray: jest.fn()
            })),
            findOne: jest.fn()
        };

        mockTrainDetailsCollection = {
            findOne: jest.fn()
        };

        db.getStationsCollection = jest.fn(() => mockStationsCollection);
        db.getPassengersCollection = jest.fn(() => mockPassengersCollection);
        db.getTrainDetailsCollection = jest.fn(() => mockTrainDetailsCollection);
        db.switchTrain = jest.fn();
        db.switchTrainByDetails = jest.fn();

        mockTrainState = {
            trainNo: '17225',
            trainName: 'Test Express',
            journeyDate: '2024-12-19',
            stations: [],
            coaches: [],
            racQueue: [],
            stats: {
                totalPassengers: 0,
                cnfPassengers: 0,
                racPassengers: 0,
                vacantBerths: 0
            },
            initializeCoaches: jest.fn(),
            updateStats: jest.fn(),
            findBerth: jest.fn(),
            allocationErrors: [],
            allocationStats: {}
        };

        TrainState.mockImplementation(() => mockTrainState);
    });

    describe('loadStations', () => {
        it('should load stations successfully', async () => {
            const mockStations = [
                { SNO: 1, Station_Code: 'STA', Station_Name: 'Station A', Arrival_Time: '10:00', Departure_Time: '10:05', Distance: 0, Day: 1, Halt_Duration: 5, Railway_Zone: 'SCR', Division: 'GNT', Platform_Number: '1', Remarks: '' },
                { SNO: 2, Station_Code: 'STB', Station_Name: 'Station B', Arrival_Time: '11:00', Departure_Time: '11:05', Distance: 50, Day: 1, Halt_Duration: 5, Railway_Zone: 'SCR', Division: 'GNT', Platform_Number: '2', Remarks: '' }
            ];

            const toArrayMock = jest.fn().mockResolvedValue(mockStations);
            const sortMock = jest.fn(() => ({ toArray: toArrayMock }));
            mockStationsCollection.find = jest.fn(() => ({ sort: sortMock }));

            const stations = await DataService.loadStations();

            expect(stations).toHaveLength(2);
            expect(stations[0].code).toBe('STA');
            expect(stations[0].idx).toBe(0);
            expect(stations[1].code).toBe('STB');
            expect(mockStationsCollection.find).toHaveBeenCalledWith({});
        });

        it('should throw error if no stations found', async () => {
            const toArrayMock = jest.fn().mockResolvedValue([]);
            const sortMock = jest.fn(() => ({ toArray: toArrayMock }));
            mockStationsCollection.find = jest.fn(() => ({ sort: sortMock }));

            await expect(DataService.loadStations()).rejects.toThrow('No stations found');
        });

        it('should throw error if stations collection fails', async () => {
            const toArrayMock = jest.fn().mockRejectedValue(new Error('DB error'));
            const sortMock = jest.fn(() => ({ toArray: toArrayMock }));
            mockStationsCollection.find = jest.fn(() => ({ sort: sortMock }));

            await expect(DataService.loadStations()).rejects.toThrow('Failed to load stations');
        });
    });

    describe('loadPassengers', () => {
        it('should load passengers successfully', async () => {
            const mockPassengers = [
                { PNR_Number: 'P001', Train_Number: '17225', Journey_Date: '19-12-2024', Name: 'John' },
                { PNR_Number: 'P002', Train_Number: '17225', Journey_Date: '19-12-2024', Name: 'Jane' }
            ];

            const toArrayMock = jest.fn().mockResolvedValue(mockPassengers);
            mockPassengersCollection.find = jest.fn(() => ({ toArray: toArrayMock }));

            const passengers = await DataService.loadPassengers('17225', '2024-12-19');

            expect(passengers).toHaveLength(2);
            expect(passengers[0].PNR_Number).toBe('P001');
            expect(mockPassengersCollection.find).toHaveBeenCalledWith({
                Train_Number: '17225',
                Journey_Date: '19-12-2024'
            });
        });

        it('should return empty array if no passengers found', async () => {
            const toArrayMock = jest.fn().mockResolvedValue([]);
            mockPassengersCollection.find = jest.fn(() => ({ toArray: toArrayMock }));
            global.RAC_CONFIG = { passengersCollection: 'test_passengers', passengersDb: 'test_db' };

            const passengers = await DataService.loadPassengers('17225', '2024-12-19');

            expect(passengers).toEqual([]);
        });

        it('should handle date format correctly', async () => {
            const toArrayMock = jest.fn().mockResolvedValue([]);
            mockPassengersCollection.find = jest.fn(() => ({ toArray: toArrayMock }));
            global.RAC_CONFIG = { passengersCollection: 'test', passengersDb: 'test' };

            await DataService.loadPassengers('17225', '2024-12-19');

            expect(mockPassengersCollection.find).toHaveBeenCalledWith({
                Train_Number: '17225',
                Journey_Date: '19-12-2024'
            });
        });

        it('should throw error on database failure', async () => {
            const toArrayMock = jest.fn().mockRejectedValue(new Error('DB error'));
            mockPassengersCollection.find = jest.fn(() => ({ toArray: toArrayMock }));

            await expect(DataService.loadPassengers('17225', '2024-12-19')).rejects.toThrow('Failed to load passengers');
        });
    });

    describe('findStation', () => {
        const mockStations = [
            { idx: 0, code: 'STA', name: 'Station A' },
            { idx: 1, code: 'STB', name: 'Station B Junction' },
            { idx: 2, code: 'STC', name: 'Station C (NR)' }
        ];

        it('should find station by exact code match', () => {
            const station = DataService.findStation(mockStations, 'STA');
            expect(station).toEqual(mockStations[0]);
        });

        it('should find station by exact name match', () => {
            const station = DataService.findStation(mockStations, 'Station A');
            expect(station).toEqual(mockStations[0]);
        });

        it('should find station with partial match', () => {
            const station = DataService.findStation(mockStations, 'Station B');
            expect(station).not.toBeNull();
        });

        it('should handle normalized matching for junction', () => {
            const station = DataService.findStation(mockStations, 'Station B Jn');
            expect(station).toBeTruthy();
        });

        it('should return null for invalid station', () => {
            const station = DataService.findStation(mockStations, 'INVALID');
            expect(station).toBeNull();
        });

        it('should return null for empty stations array', () => {
            const station = DataService.findStation([], 'STA');
            expect(station).toBeNull();
        });

        it('should return null for null input', () => {
            const station = DataService.findStation(mockStations, null);
            expect(station).toBeNull();
        });

        it('should return null for invalid stations parameter', () => {
            const station = DataService.findStation(null, 'STA');
            expect(station).toBeNull();
        });
    });

    describe('allocatePassengers', () => {
        const mockStations = [
            { idx: 0, code: 'STA', name: 'Station A' },
            { idx: 1, code: 'STB', name: 'Station B' },
            { idx: 2, code: 'STC', name: 'Station C' }
        ];

        beforeEach(() => {
            mockTrainState.stations = mockStations;
        });

        it('should allocate passengers successfully', () => {
            const mockBerth = {
                isAvailableForSegment: jest.fn(() => true),
                addPassenger: jest.fn(),
                type: 'Lower'
            };

            mockTrainState.findBerth = jest.fn(() => mockBerth);

            const passengers = [{
                PNR_Number: 'P001',
                IRCTC_ID: 'IR123',
                Name: 'John',
                Age: 30,
                Gender: 'M',
                Boarding_Station: 'STA',
                Deboarding_Station: 'STC',
                Assigned_Coach: 'S1',
                Assigned_berth: '15',
                PNR_Status: 'CNF',
                Class: 'SL',
                Berth_Type: 'LB',
                Passenger_Status: 'Online'
            }];

            const result = DataService.allocatePassengers(mockTrainState, passengers);

            expect(result.success).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockBerth.addPassenger).toHaveBeenCalled();
        });

        it('should fail if station not found', () => {
            const passengers = [{
                PNR_Number: 'P001',
                Name: 'John',
                Boarding_Station: 'INVALID',
                Deboarding_Station: 'STC',
                Assigned_Coach: 'S1',
                Assigned_berth: '15'
            }];

            const result = DataService.allocatePassengers(mockTrainState, passengers);

            expect(result.success).toBe(0);
            expect(result.failed).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toContain('Station not found');
        });

        it('should fail if berth not found', () => {
            mockTrainState.findBerth = jest.fn(() => null);

            const passengers = [{
                PNR_Number: 'P001',
                Name: 'John',
                Boarding_Station: 'STA',
                Deboarding_Station: 'STC',
                Assigned_Coach: 'S1',
                Assigned_berth: '99'
            }];

            const result = DataService.allocatePassengers(mockTrainState, passengers);

            expect(result.success).toBe(0);
            expect(result.failed).toBe(1);
            expect(result.errors[0].error).toContain('Berth not found');
        });

        it('should fail if berth not available', () => {
            const mockBerth = {
                isAvailableForSegment: jest.fn(() => false),
                type: 'Lower'
            };

            mockTrainState.findBerth = jest.fn(() => mockBerth);

            const passengers = [{
                PNR_Number: 'P001',
                Name: 'John',
                PNR_Status: 'CNF',
                Boarding_Station: 'STA',
                Deboarding_Station: 'STC',
                Assigned_Coach: 'S1',
                Assigned_berth: '15',
                Berth_Type: 'LB'
            }];

            const result = DataService.allocatePassengers(mockTrainState, passengers);

            expect(result.success).toBe(0);
            expect(result.failed).toBe(1);
            expect(result.errors[0].error).toContain('Berth full');
        });
    });

    describe('buildRACQueue', () => {
        const mockStations = [
            { idx: 0, code: 'STA', name: 'Station A' },
            { idx: 1, code: 'STB', name: 'Station B' },
            { idx: 2, code: 'STC', name: 'Station C' }
        ];

        beforeEach(() => {
            mockTrainState.stations = mockStations;
        });

        it('should build RAC queue successfully', () => {
            const passengers = [
                {
                    PNR_Number: 'P001',
                    IRCTC_ID: 'IR001',
                    Name: 'John',
                    Age: 30,
                    Gender: 'M',
                    PNR_Status: 'RAC',
                    Rac_status: '1',
                    Boarding_Station: 'STA',
                    Deboarding_Station: 'STC',
                    Assigned_Coach: 'S1',
                    Assigned_berth: '72',
                    Class: 'SL',
                    Berth_Type: 'SL',
                    Passenger_Status: 'Online'
                },
                {
                    PNR_Number: 'P002',
                    Name: 'Jane',
                    Age: 28,
                    Gender: 'F',
                    PNR_Status: 'RAC',
                    Rac_status: '2',
                    Boarding_Station: 'STA',
                    Deboarding_Station: 'STB',
                    Assigned_Coach: 'S1',
                    Assigned_berth: '72',
                    Class: 'SL',
                    Berth_Type: 'SL'
                }
            ];

            DataService.buildRACQueue(mockTrainState, passengers);

            expect(mockTrainState.racQueue).toHaveLength(2);
            expect(mockTrainState.racQueue[0].pnr).toBe('P001');
            expect(mockTrainState.racQueue[0].racNumber).toBe(1);
            expect(mockTrainState.racQueue[1].racNumber).toBe(2);
        });

        it('should sort RAC queue by RAC number', () => {
            const passengers = [
                { PNR_Number: 'P002', PNR_Status: 'RAC', Rac_status: '3', Name: 'Jane', Age: 28, Gender: 'F', Boarding_Station: 'STA', Deboarding_Station: 'STC', Assigned_Coach: 'S1', Assigned_berth: '72', Class: 'SL', Berth_Type: 'SL' },
                { PNR_Number: 'P001', PNR_Status: 'RAC', Rac_status: '1', Name: 'John', Age: 30, Gender: 'M', Boarding_Station: 'STA', Deboarding_Station: 'STC', Assigned_Coach: 'S1', Assigned_berth: '72', Class: 'SL', Berth_Type: 'SL' },
                { PNR_Number: 'P003', PNR_Status: 'RAC', Rac_status: '2', Name: 'Bob', Age: 25, Gender: 'M', Boarding_Station: 'STA', Deboarding_Station: 'STC', Assigned_Coach: 'S1', Assigned_berth: '72', Class: 'SL', Berth_Type: 'SL' }
            ];

            DataService.buildRACQueue(mockTrainState, passengers);

            expect(mockTrainState.racQueue[0].racNumber).toBe(1);
            expect(mockTrainState.racQueue[1].racNumber).toBe(2);
            expect(mockTrainState.racQueue[2].racNumber).toBe(3);
        });

        it('should filter only RAC passengers', () => {
            const passengers = [
                { PNR_Number: 'P001', PNR_Status: 'RAC', Rac_status: '1', Name: 'John', Age: 30, Gender: 'M', Boarding_Station: 'STA', Deboarding_Station: 'STC', Assigned_Coach: 'S1', Assigned_berth: '72', Class: 'SL', Berth_Type: 'SL' },
                { PNR_Number: 'P002', PNR_Status: 'CNF', Name: 'Jane', Age: 28, Gender: 'F', Boarding_Station: 'STA', Deboarding_Station: 'STC', Assigned_Coach: 'S1', Assigned_berth: '15', Class: 'SL', Berth_Type: 'LB' }
            ];

            DataService.buildRACQueue(mockTrainState, passengers);

            expect(mockTrainState.racQueue).toHaveLength(1);
            expect(mockTrainState.racQueue[0].pnrStatus).toBe('RAC');
        });
    });

    describe('getTrainName', () => {
        it('should get train name from Train_Details collection', async () => {
            mockTrainDetailsCollection.findOne.mockResolvedValue({
                Train_No: 17225,
                Train_Name: 'Amaravathi Express'
            });

            const name = await DataService.getTrainName('17225');

            expect(name).toBe('Amaravathi Express');
            expect(mockTrainDetailsCollection.findOne).toHaveBeenCalledWith({ Train_No: 17225 });
        });

        it('should fallback to stations collection', async () => {
            mockTrainDetailsCollection.findOne.mockResolvedValue(null);
            mockStationsCollection.findOne.mockResolvedValue({
                Train_Name: 'Test Express'
            });

            const name = await DataService.getTrainName('17225');

            expect(name).toBe('Test Express');
        });

        it('should use default mapping if database fails', async () => {
            mockTrainDetailsCollection.findOne.mockRejectedValue(new Error('DB error'));
            mockStationsCollection.findOne.mockRejectedValue(new Error('DB error'));

            const name = await DataService.getTrainName('17225');

            expect(name).toBe('Amaravathi Express');
        });

        it('should return generic name for unknown train', async () => {
            mockTrainDetailsCollection.findOne.mockResolvedValue(null);
            mockStationsCollection.findOne.mockResolvedValue(null);

            const name = await DataService.getTrainName('99999');

            expect(name).toBe('Train 99999');
        });
    });

    describe('getTrainDetails', () => {
        it('should get train details successfully', async () => {
            const mockDetails = {
                Train_No: 17225,
                Train_Name: 'Amaravathi Express',
                Sleeper_Coaches_Count: 9,
                Three_TierAC_Coaches_Count: 2
            };

            mockTrainDetailsCollection.findOne.mockResolvedValue(mockDetails);

            const details = await DataService.getTrainDetails('17225');

            expect(details).toEqual(mockDetails);
            expect(mockTrainDetailsCollection.findOne).toHaveBeenCalledWith({ Train_No: 17225 });
        });

        it('should return null if train details not found', async () => {
            mockTrainDetailsCollection.findOne.mockResolvedValue(null);

            const details = await DataService.getTrainDetails('99999');

            expect(details).toBeNull();
        });

        it('should return null on database error', async () => {
            mockTrainDetailsCollection.findOne.mockRejectedValue(new Error('DB error'));

            const details = await DataService.getTrainDetails('17225');

            expect(details).toBeNull();
        });
    });

    describe('loadTrainData', () => {
        it('should load complete train data successfully', async () => {
            global.RAC_CONFIG = {
                stationsCollection: 'test_stations',
                passengersCollection: 'test_passengers'
            };

            const mockStations = [
                { SNO: 1, Station_Code: 'STA', Station_Name: 'Station A', Arrival_Time: '10:00', Departure_Time: '10:05', Distance: 0, Day: 1, Halt_Duration: 5, Railway_Zone: 'SCR', Division: 'GNT', Platform_Number: '1', Remarks: '' }
            ];

            const mockPassengers = [
                { PNR_Number: 'P001', Train_Number: '17225', Journey_Date: '19-12-2024', Name: 'John', Age: 30, Gender: 'M', Boarding_Station: 'STA', Deboarding_Station: 'STA', Assigned_Coach: 'S1', Assigned_berth: '15', PNR_Status: 'CNF', Class: 'SL', Berth_Type: 'LB' }
            ];

            const stationsToArrayMock = jest.fn().mockResolvedValue(mockStations);
            const stationsSortMock = jest.fn(() => ({ toArray: stationsToArrayMock }));
            mockStationsCollection.find = jest.fn(() => ({ sort: stationsSortMock }));
            
            const passengersToArrayMock = jest.fn().mockResolvedValue(mockPassengers);
            mockPassengersCollection.find = jest.fn(() => ({ toArray: passengersToArrayMock }));
            
            mockTrainDetailsCollection.findOne.mockResolvedValue({
                Train_No: 17225,
                Train_Name: 'Test Express',
                Sleeper_Coaches_Count: 9
            });

            const mockBerth = {
                isAvailableForSegment: jest.fn(() => true),
                addPassenger: jest.fn(),
                type: 'Lower'
            };
            mockTrainState.findBerth = jest.fn(() => mockBerth);

            const trainState = await DataService.loadTrainData('17225', '2024-12-19');

            expect(trainState).toBeDefined();
            expect(db.switchTrain).toHaveBeenCalled();
            expect(mockTrainState.initializeCoaches).toHaveBeenCalled();
        });

        it('should throw error if collections not configured', async () => {
            global.RAC_CONFIG = {};
            mockTrainDetailsCollection.findOne.mockResolvedValue(null);

            await expect(DataService.loadTrainData('17225', '2024-12-19')).rejects.toThrow('Collections not configured');
        });
    });
});
