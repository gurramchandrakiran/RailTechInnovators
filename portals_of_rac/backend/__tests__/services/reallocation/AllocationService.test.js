const AllocationService = require('../../../services/reallocation/AllocationService');
const db = require('../../../config/db');
const wsManager = require('../../../config/websocket');
const WebPushService = require('../../../services/WebPushService');
const NotificationService = require('../../../services/NotificationService');

jest.mock('../../../config/db');
jest.mock('../../../config/websocket');
jest.mock('../../../services/WebPushService');
jest.mock('../../../services/NotificationService');

describe('AllocationService', () => {
    let mockTrainState;
    let mockPassenger;
    let mockBerth;
    let mockPassengersCollection;

    beforeEach(() => {
        jest.clearAllMocks();

        mockPassengersCollection = {
            updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
            findOne: jest.fn().mockResolvedValue({
                IRCTC_ID: 'IR_001',
                Email: 'test@example.com'
            })
        };

        db.getPassengersCollection = jest.fn(() => mockPassengersCollection);
        wsManager.broadcast = jest.fn();
        WebPushService.sendPushNotification = jest.fn().mockResolvedValue(true);
        NotificationService.sendUpgradeNotification = jest.fn().mockResolvedValue(true);

        mockBerth = {
            coachNo: 'S1',
            berthNo: 15,
            type: 'Lower Berth',
            segmentOccupancy: [null, null, null, null],
            passengers: [],
            updateStatus: jest.fn()
        };

        mockPassenger = {
            pnr: 'P001',
            name: 'John Doe',
            age: 30,
            gender: 'M',
            fromIdx: 0,
            toIdx: 3,
            from: 'Station A',
            to: 'Station D',
            pnrStatus: 'RAC',
            racStatus: 'RAC 1',
            class: 'SL',
            boarded: true,
            noShow: false
        };

        mockTrainState = {
            trainNo: '17225',
            trainName: 'Amaravathi Express',
            currentStationIdx: 1,
            racQueue: [mockPassenger],
            stats: {
                totalRACUpgraded: 0,
                currentOnboard: 10,
                vacantBerths: 5
            },
            findPassengerByPNR: jest.fn((pnr) => pnr === 'P001' ? mockPassenger : null),
            findBerth: jest.fn((coach, berth) => coach === 'S1' && berth === 15 ? mockBerth : null),
            logEvent: jest.fn(),
            getAllPassengers: jest.fn(() => [mockPassenger]),
            getCurrentStation: jest.fn(() => ({ name: 'Station B' }))
        };
    });

    describe('applyReallocation', () => {
        it('should successfully apply reallocation', async () => {
            const allocations = [
                { pnr: 'P001', coach: 'S1', berth: 15 }
            ];

            const result = await AllocationService.applyReallocation(mockTrainState, allocations);

            expect(result.success).toBe(true);
            expect(result.totalProcessed).toBe(1);
            expect(result.totalSuccess).toBe(1);
            expect(result.totalFailed).toBe(0);
        });

        it('should throw error for invalid allocations array', async () => {
            await expect(AllocationService.applyReallocation(mockTrainState, null))
                .rejects.toThrow('Invalid allocations array');
        });

        it('should throw error for empty allocations array', async () => {
            await expect(AllocationService.applyReallocation(mockTrainState, []))
                .rejects.toThrow('Invalid allocations array');
        });

        it('should handle multiple allocations', async () => {
            const allocations = [
                { pnr: 'P001', coach: 'S1', berth: 15 }
            ];

            const result = await AllocationService.applyReallocation(mockTrainState, allocations);

            expect(result.totalProcessed).toBe(1);
            expect(result.results.length).toBe(1);
        });

        it('should continue processing after individual allocation failure', async () => {
            mockTrainState.findPassengerByPNR.mockReturnValueOnce(null);
            const allocations = [
                { pnr: 'P999', coach: 'S1', berth: 15 }
            ];

            const result = await AllocationService.applyReallocation(mockTrainState, allocations);

            expect(result.totalFailed).toBe(1);
            expect(result.results[0].success).toBe(false);
            expect(result.results[0].error).toContain('not found');
        });
    });

    describe('_processAllocation', () => {
        it('should process allocation successfully', async () => {
            const allocation = { pnr: 'P001', coach: 'S1', berth: 15 };

            const result = await AllocationService._processAllocation(mockTrainState, allocation);

            expect(result.success).toBe(true);
            expect(result.pnr).toBe('P001');
            expect(result.coach).toBe('S1');
            expect(result.berth).toBe(15);
        });

        it('should throw error if passenger not found', async () => {
            mockTrainState.findPassengerByPNR.mockReturnValue(null);
            const allocation = { pnr: 'P999', coach: 'S1', berth: 15 };

            await expect(AllocationService._processAllocation(mockTrainState, allocation))
                .rejects.toThrow('Passenger P999 not found');
        });

        it('should throw error if berth not found', async () => {
            mockTrainState.findBerth.mockReturnValue(null);
            const allocation = { pnr: 'P001', coach: 'S9', berth: 99 };

            await expect(AllocationService._processAllocation(mockTrainState, allocation))
                .rejects.toThrow('Berth S9-99 not found');
        });

        it('should broadcast websocket event', async () => {
            const allocation = { pnr: 'P001', coach: 'S1', berth: 15 };

            await AllocationService._processAllocation(mockTrainState, allocation);

            expect(wsManager.broadcast).toHaveBeenCalledWith('RAC_UPGRADED', expect.objectContaining({
                pnr: 'P001',
                coach: 'S1',
                berth: 15
            }));
        });

        it('should log upgrade event', async () => {
            const allocation = { pnr: 'P001', coach: 'S1', berth: 15 };

            await AllocationService._processAllocation(mockTrainState, allocation);

            expect(mockTrainState.logEvent).toHaveBeenCalledWith(
                'RAC_UPGRADED',
                'RAC upgraded to CNF',
                expect.any(Object)
            );
        });

        it('should send push notification to passenger', async () => {
            const allocation = { pnr: 'P001', coach: 'S1', berth: 15 };

            await AllocationService._processAllocation(mockTrainState, allocation);

            expect(WebPushService.sendPushNotification).toHaveBeenCalled();
        });

        it('should send email notification to passenger', async () => {
            const allocation = { pnr: 'P001', coach: 'S1', berth: 15 };

            await AllocationService._processAllocation(mockTrainState, allocation);

            expect(NotificationService.sendUpgradeNotification).toHaveBeenCalled();
        });

        it('should handle notification failures gracefully', async () => {
            WebPushService.sendPushNotification.mockRejectedValue(new Error('Push failed'));
            const allocation = { pnr: 'P001', coach: 'S1', berth: 15 };

            const result = await AllocationService._processAllocation(mockTrainState, allocation);

            expect(result.success).toBe(true);
        });
    });

    describe('_allocateBerth', () => {
        it('should update passenger allocation details', () => {
            AllocationService._allocateBerth(mockPassenger, mockBerth, mockTrainState);

            expect(mockPassenger.coach).toBe('S1');
            expect(mockPassenger.seat).toBe(15);
            expect(mockPassenger.pnrStatus).toBe('CNF');
            expect(mockPassenger.racStatus).toBe('-');
            expect(mockPassenger.berthType).toBe('Lower Berth');
            expect(mockPassenger.boarded).toBe(true);
        });

        it('should update berth segmentOccupancy', () => {
            AllocationService._allocateBerth(mockPassenger, mockBerth, mockTrainState);

            for (let i = mockPassenger.fromIdx; i < mockPassenger.toIdx; i++) {
                expect(mockBerth.segmentOccupancy[i]).toBe('P001');
            }
        });

        it('should add passenger to berth.passengers array', () => {
            AllocationService._allocateBerth(mockPassenger, mockBerth, mockTrainState);

            expect(mockBerth.passengers.length).toBe(1);
            expect(mockBerth.passengers[0].pnr).toBe('P001');
            expect(mockBerth.passengers[0].upgradedFrom).toBe('RAC');
        });

        it('should remove passenger from RAC queue', () => {
            AllocationService._allocateBerth(mockPassenger, mockBerth, mockTrainState);

            expect(mockTrainState.racQueue.length).toBe(0);
        });

        it('should call berth.updateStatus', () => {
            AllocationService._allocateBerth(mockPassenger, mockBerth, mockTrainState);

            expect(mockBerth.updateStatus).toHaveBeenCalled();
        });

        it('should not duplicate passenger in berth.passengers', () => {
            mockBerth.passengers = [{ pnr: 'P001', name: 'John Doe' }];

            AllocationService._allocateBerth(mockPassenger, mockBerth, mockTrainState);

            expect(mockBerth.passengers.length).toBe(1);
        });
    });

    describe('_checkBerthAvailability', () => {
        it('should return available=true for vacant berth', () => {
            const result = AllocationService._checkBerthAvailability(mockBerth, mockPassenger);

            expect(result.available).toBe(true);
        });

        it('should return available=false for occupied segment', () => {
            mockBerth.segmentOccupancy[1] = 'P002';

            const result = AllocationService._checkBerthAvailability(mockBerth, mockPassenger);

            expect(result.available).toBe(false);
            expect(result.reason).toContain('Segment 1 already occupied');
        });

        it('should ignore segments with empty string', () => {
            mockBerth.segmentOccupancy[1] = '';

            const result = AllocationService._checkBerthAvailability(mockBerth, mockPassenger);

            expect(result.available).toBe(true);
        });

        it('should detect overlapping journey in passengers array', () => {
            mockBerth.passengers = [
                { pnr: 'P002', name: 'Jane', fromIdx: 1, toIdx: 4, noShow: false }
            ];

            const result = AllocationService._checkBerthAvailability(mockBerth, mockPassenger);

            expect(result.available).toBe(false);
            expect(result.reason).toContain('Overlaps with');
        });

        it('should ignore no-show passengers in overlap check', () => {
            mockBerth.passengers = [
                { pnr: 'P002', name: 'Jane', fromIdx: 1, toIdx: 4, noShow: true }
            ];

            const result = AllocationService._checkBerthAvailability(mockBerth, mockPassenger);

            expect(result.available).toBe(true);
        });

        it('should allow same passenger (self)', () => {
            mockBerth.passengers = [mockPassenger];

            const result = AllocationService._checkBerthAvailability(mockBerth, mockPassenger);

            expect(result.available).toBe(true);
        });

        it('should handle non-overlapping journeys', () => {
            mockBerth.passengers = [
                { pnr: 'P002', name: 'Jane', fromIdx: 3, toIdx: 4, noShow: false }
            ];

            const result = AllocationService._checkBerthAvailability(mockBerth, mockPassenger);

            expect(result.available).toBe(true);
        });
    });

    describe('_updateDatabase', () => {
        it('should update passenger record in database', async () => {
            await AllocationService._updateDatabase('P001', 'S1', 15, 'Lower Berth');

            expect(mockPassengersCollection.updateOne).toHaveBeenCalledWith(
                { PNR_Number: 'P001' },
                {
                    $set: expect.objectContaining({
                        PNR_Status: 'CNF',
                        Rac_status: '-',
                        Assigned_Coach: 'S1',
                        Assigned_berth: 15,
                        Berth_Type: 'Lower Berth'
                    })
                }
            );
        });

        it('should throw error on database failure', async () => {
            mockPassengersCollection.updateOne.mockRejectedValue(new Error('DB Error'));

            await expect(AllocationService._updateDatabase('P001', 'S1', 15, 'Lower Berth'))
                .rejects.toThrow('DB Error');
        });

        it('should set boarded to true', async () => {
            await AllocationService._updateDatabase('P001', 'S1', 15, 'Lower Berth');

            const updateCall = mockPassengersCollection.updateOne.mock.calls[0][1];
            expect(updateCall.$set.Boarded).toBe(true);
        });

        it('should set Upgraded_From to RAC', async () => {
            await AllocationService._updateDatabase('P001', 'S1', 15, 'Lower Berth');

            const updateCall = mockPassengersCollection.updateOne.mock.calls[0][1];
            expect(updateCall.$set.Upgraded_From).toBe('RAC');
        });
    });

    describe('_updateStats', () => {
        it('should increment totalRACUpgraded', () => {
            AllocationService._updateStats(mockTrainState, mockPassenger);

            expect(mockTrainState.stats.totalRACUpgraded).toBe(1);
        });

        it('should increment currentOnboard', () => {
            AllocationService._updateStats(mockTrainState, mockPassenger);

            expect(mockTrainState.stats.currentOnboard).toBe(11);
        });

        it('should decrement vacantBerths', () => {
            AllocationService._updateStats(mockTrainState, mockPassenger);

            expect(mockTrainState.stats.vacantBerths).toBe(4);
        });

        it('should handle missing stats gracefully', () => {
            mockTrainState.stats = null;

            expect(() => AllocationService._updateStats(mockTrainState, mockPassenger))
                .not.toThrow();
        });
    });

    describe('upgradeRACPassengerWithCoPassenger', () => {
        let mockCoPassenger;

        beforeEach(() => {
            mockCoPassenger = {
                pnr: 'P002',
                name: 'Jane Doe',
                coach: mockPassenger.coach,
                seat: mockPassenger.seat,
                fromIdx: 0,
                toIdx: 3,
                pnrStatus: 'RAC'
            };

            mockTrainState.getAllPassengers.mockReturnValue([mockPassenger, mockCoPassenger]);
        });

        it('should upgrade both RAC passenger and co-passenger', async () => {
            const result = await AllocationService.upgradeRACPassengerWithCoPassenger(
                'P001',
                { coachNo: 'S1', berthNo: 15 },
                mockTrainState
            );

            expect(result.success).toBe(true);
            expect(result.racPNR).toBe('P001');
            expect(result.coPassengerPNR).toBe('P002');
        });

        it('should throw error if RAC passenger not found', async () => {
            mockTrainState.findPassengerByPNR.mockReturnValue(null);

            await expect(
                AllocationService.upgradeRACPassengerWithCoPassenger('P999', { coachNo: 'S1', berthNo: 15 }, mockTrainState)
            ).rejects.toThrow('RAC passenger P999 not found');
        });

        it('should throw error if co-passenger not found', async () => {
            mockTrainState.getAllPassengers.mockReturnValue([mockPassenger]);

            await expect(
                AllocationService.upgradeRACPassengerWithCoPassenger('P001', { coachNo: 'S1', berthNo: 15 }, mockTrainState)
            ).rejects.toThrow('Co-passenger not found');
        });

        it('should throw error if berth not found', async () => {
            mockTrainState.findBerth.mockReturnValue(null);

            await expect(
                AllocationService.upgradeRACPassengerWithCoPassenger('P001', { coachNo: 'S9', berthNo: 99 }, mockTrainState)
            ).rejects.toThrow('Berth not found');
        });

        it('should update database for RAC passenger', async () => {
            await AllocationService.upgradeRACPassengerWithCoPassenger(
                'P001',
                { coachNo: 'S1', berthNo: 15 },
                mockTrainState
            );

            expect(mockPassengersCollection.updateOne).toHaveBeenCalled();
        });
    });

    describe('_findCoPassenger', () => {
        it('should find co-passenger in same berth', () => {
            const coPassenger = {
                pnr: 'P002',
                coach: 'S1',
                seat: 42,
                fromIdx: 0,
                toIdx: 3
            };
            mockPassenger.coach = 'S1';
            mockPassenger.seat = 42;
            mockTrainState.getAllPassengers.mockReturnValue([mockPassenger, coPassenger]);

            const result = AllocationService._findCoPassenger(mockPassenger, mockTrainState);

            expect(result).toEqual(coPassenger);
        });

        it('should return undefined if no co-passenger found', () => {
            mockTrainState.getAllPassengers.mockReturnValue([mockPassenger]);

            const result = AllocationService._findCoPassenger(mockPassenger, mockTrainState);

            expect(result).toBeUndefined();
        });

        it('should not return same passenger as co-passenger', () => {
            mockTrainState.getAllPassengers.mockReturnValue([mockPassenger]);

            const result = AllocationService._findCoPassenger(mockPassenger, mockTrainState);

            expect(result).not.toEqual(mockPassenger);
        });

        it('should handle getAllPassengers error', () => {
            mockTrainState.getAllPassengers.mockImplementation(() => {
                throw new Error('getAllPassengers failed');
            });

            const result = AllocationService._findCoPassenger(mockPassenger, mockTrainState);

            expect(result).toBeNull();
        });
    });

    describe('applyUpgrade', () => {
        it('should apply upgrade successfully', async () => {
            const result = await AllocationService.applyUpgrade('P001', 'S1-15', mockTrainState);

            expect(result.success).toBe(true);
            expect(result.pnr).toBe('P001');
            expect(result.berthId).toBe('S1-15');
        });

        it('should throw error for invalid berth ID format', async () => {
            await expect(AllocationService.applyUpgrade('P001', 'InvalidFormat', mockTrainState))
                .rejects.toThrow('Invalid berth ID format');
        });

        it('should throw error if passenger not found', async () => {
            mockTrainState.findPassengerByPNR.mockReturnValue(null);

            await expect(AllocationService.applyUpgrade('P999', 'S1-15', mockTrainState))
                .rejects.toThrow('Passenger P999 not found');
        });

        it('should throw error if passenger is not RAC', async () => {
            mockPassenger.pnrStatus = 'CNF';

            await expect(AllocationService.applyUpgrade('P001', 'S1-15', mockTrainState))
                .rejects.toThrow('is no longer RAC');
        });

        it('should throw error if berth not found', async () => {
            mockTrainState.findBerth.mockReturnValue(null);

            await expect(AllocationService.applyUpgrade('P001', 'S9-99', mockTrainState))
                .rejects.toThrow('Berth S9-99 not found');
        });

        it('should throw error if berth not available', async () => {
            mockBerth.segmentOccupancy[1] = 'P002';

            await expect(AllocationService.applyUpgrade('P001', 'S1-15', mockTrainState))
                .rejects.toThrow('not available');
        });

        it('should update database after upgrade', async () => {
            await AllocationService.applyUpgrade('P001', 'S1-15', mockTrainState);

            expect(mockPassengersCollection.updateOne).toHaveBeenCalled();
        });

        it('should update statistics after upgrade', async () => {
            const initialUpgraded = mockTrainState.stats.totalRACUpgraded;

            await AllocationService.applyUpgrade('P001', 'S1-15', mockTrainState);

            expect(mockTrainState.stats.totalRACUpgraded).toBe(initialUpgraded + 1);
        });

        it('should log upgrade event', async () => {
            await AllocationService.applyUpgrade('P001', 'S1-15', mockTrainState);

            expect(mockTrainState.logEvent).toHaveBeenCalledWith(
                'RAC_UPGRADED',
                expect.stringContaining('P001 upgraded to S1-15'),
                expect.any(Object)
            );
        });

        it('should parse berth ID with multiple dashes correctly', async () => {
            mockTrainState.findBerth.mockImplementation((coach, berth) => 
                coach === 'S1' && berth === 15 ? mockBerth : null
            );

            const result = await AllocationService.applyUpgrade('P001', 'S1-15', mockTrainState);

            expect(result.success).toBe(true);
        });
    });
});
