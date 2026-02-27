/**
 * ReallocationService Tests - Comprehensive Coverage
 * Tests for RAC reallocation orchestration and vacancy processing
 */

const ReallocationService = require('../../services/ReallocationService');
const NoShowService = require('../../services/reallocation/NoShowService');
const VacancyService = require('../../services/reallocation/VacancyService');
const EligibilityService = require('../../services/reallocation/EligibilityService');
const RACQueueService = require('../../services/reallocation/RACQueueService');
const AllocationService = require('../../services/reallocation/AllocationService');
const UpgradeNotificationService = require('../../services/UpgradeNotificationService');
const InAppNotificationService = require('../../services/InAppNotificationService');
const WebPushService = require('../../services/WebPushService');
const wsManager = require('../../config/websocket');

jest.mock('../../services/reallocation/NoShowService');
jest.mock('../../services/reallocation/VacancyService');
jest.mock('../../services/reallocation/EligibilityService');
jest.mock('../../services/reallocation/RACQueueService');
jest.mock('../../services/reallocation/AllocationService');
jest.mock('../../services/UpgradeNotificationService');
jest.mock('../../services/InAppNotificationService');
jest.mock('../../services/WebPushService');
jest.mock('../../config/websocket');

describe('ReallocationService - Comprehensive Tests', () => {
    let mockTrainState;

    beforeEach(() => {
        jest.clearAllMocks();

        mockTrainState = {
            trainNo: '17225',
            racQueue: [],
            currentStationIdx: 1
        };
    });

    describe('markNoShow', () => {
        it('should delegate to NoShowService', async () => {
            NoShowService.markNoShow.mockResolvedValue({ success: true });

            const result = await ReallocationService.markNoShow(mockTrainState, 'P001');

            expect(NoShowService.markNoShow).toHaveBeenCalledWith(mockTrainState, 'P001');
            expect(result.success).toBe(true);
        });

        it('should handle errors from NoShowService', async () => {
            NoShowService.markNoShow.mockRejectedValue(new Error('Service error'));

            await expect(ReallocationService.markNoShow(mockTrainState, 'P001'))
                .rejects.toThrow('Service error');
        });
    });

    describe('getRACQueue', () => {
        it('should delegate to RACQueueService', () => {
            const mockQueue = [{ pnr: 'R001', name: 'RAC1' }];
            RACQueueService.getRACQueue.mockReturnValue(mockQueue);

            const result = ReallocationService.getRACQueue(mockTrainState);

            expect(RACQueueService.getRACQueue).toHaveBeenCalledWith(mockTrainState);
            expect(result).toEqual(mockQueue);
        });
    });

    describe('getVacantBerths', () => {
        it('should delegate to VacancyService', () => {
            const mockVacant = [{ berth: 'S1-15', coach: 'S1' }];
            VacancyService.getVacantBerths.mockReturnValue(mockVacant);

            const result = ReallocationService.getVacantBerths(mockTrainState);

            expect(VacancyService.getVacantBerths).toHaveBeenCalledWith(mockTrainState);
            expect(result).toEqual(mockVacant);
        });
    });

    describe('searchPassenger', () => {
        it('should delegate to RACQueueService', () => {
            const mockPassenger = { pnr: 'P001', name: 'John' };
            RACQueueService.searchPassenger.mockReturnValue(mockPassenger);

            const result = ReallocationService.searchPassenger(mockTrainState, 'P001');

            expect(RACQueueService.searchPassenger).toHaveBeenCalledWith(mockTrainState, 'P001');
            expect(result).toEqual(mockPassenger);
        });
    });


    describe('calculateJourneyDistance', () => {
        it('should delegate to EligibilityService', () => {
            EligibilityService.calculateJourneyDistance.mockReturnValue(500);

            const result = ReallocationService.calculateJourneyDistance('STA', 'STC', mockTrainState);

            expect(EligibilityService.calculateJourneyDistance).toHaveBeenCalledWith('STA', 'STC', mockTrainState);
            expect(result).toBe(500);
        });
    });

    describe('checkConflictingCNFPassenger', () => {
        it('should delegate to EligibilityService', () => {
            const vacantSegment = { fromIdx: 0, toIdx: 2 };
            EligibilityService.checkConflictingCNFPassenger.mockReturnValue(null);

            const result = ReallocationService.checkConflictingCNFPassenger(vacantSegment, mockTrainState);

            expect(EligibilityService.checkConflictingCNFPassenger).toHaveBeenCalledWith(vacantSegment, mockTrainState);
            expect(result).toBeNull();
        });
    });

    describe('findCoPassenger', () => {
        it('should delegate to EligibilityService', () => {
            const racPassenger = { pnr: 'R001' };
            const coPassenger = { pnr: 'R002' };
            EligibilityService.findCoPassenger.mockReturnValue(coPassenger);

            const result = ReallocationService.findCoPassenger(racPassenger, mockTrainState);

            expect(EligibilityService.findCoPassenger).toHaveBeenCalledWith(racPassenger, mockTrainState);
            expect(result).toEqual(coPassenger);
        });
    });


    describe('applyReallocation', () => {
        it('should delegate to AllocationService', async () => {
            const allocations = [{ pnr: 'R001', coach: 'S1', berth: '15' }];
            AllocationService.applyReallocation.mockResolvedValue({ success: true });

            const result = await ReallocationService.applyReallocation(mockTrainState, allocations);

            expect(AllocationService.applyReallocation).toHaveBeenCalledWith(mockTrainState, allocations);
            expect(result.success).toBe(true);
        });
    });

    describe('upgradeRACPassengerWithCoPassenger', () => {
        it('should delegate to AllocationService', async () => {
            const newBerthDetails = { coachNo: 'S1', berthNo: '15' };
            AllocationService.upgradeRACPassengerWithCoPassenger.mockResolvedValue({ success: true });

            const result = await ReallocationService.upgradeRACPassengerWithCoPassenger(
                'R001',
                newBerthDetails,
                mockTrainState
            );

            expect(AllocationService.upgradeRACPassengerWithCoPassenger).toHaveBeenCalledWith(
                'R001',
                newBerthDetails,
                mockTrainState
            );
            expect(result.success).toBe(true);
        });
    });

    describe('processVacancyForUpgrade', () => {
        it('should process vacancy and create upgrade offers', async () => {
            const vacantBerthInfo = {
                fullBerthNo: 'S1-15',
                coachNo: 'S1',
                type: 'Lower'
            };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: true, passengerStatus: 'Online', irctcId: 'IR001' },
                { pnr: 'R002', name: 'RAC2', boarded: true, passengerStatus: 'Online', irctcId: 'IR002' }
            ];

            UpgradeNotificationService.hasDeniedBerth.mockResolvedValue(false);
            UpgradeNotificationService.createUpgradeNotification.mockResolvedValue({ id: 'N001' });
            InAppNotificationService.createNotification.mockResolvedValue({ success: true });
            WebPushService.sendPushNotification.mockResolvedValue({ success: true });

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(2);
            expect(UpgradeNotificationService.createUpgradeNotification).toHaveBeenCalledTimes(2);
            expect(InAppNotificationService.createNotification).toHaveBeenCalledTimes(2);
        });

        it('should return error if trainState is null', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15' };
            const currentStation = { name: 'Station B', code: 'STB' };

            const result = await ReallocationService.processVacancyForUpgrade(
                null,
                vacantBerthInfo,
                currentStation
            );

            expect(result.error).toBe('Train state not initialized');
            expect(result.offersCreated).toBe(0);
        });

        it('should return error if vacantBerthInfo is invalid', async () => {
            const currentStation = { name: 'Station B', code: 'STB' };

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                null,
                currentStation
            );

            expect(result.error).toBe('Invalid vacant berth information');
            expect(result.offersCreated).toBe(0);
        });

        it('should return error if currentStation is null', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15' };

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                null
            );

            expect(result.error).toBe('Current station not provided');
            expect(result.offersCreated).toBe(0);
        });

        it('should skip non-boarded passengers', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15', coachNo: 'S1', type: 'Lower' };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: false, passengerStatus: 'Online' }
            ];

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(0);
        });

        it('should skip offline passengers', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15', coachNo: 'S1', type: 'Lower' };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: true, passengerStatus: 'Offline' }
            ];

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(0);
        });

        it('should skip passengers who denied this berth', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15', coachNo: 'S1', type: 'Lower' };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: true, passengerStatus: 'Online', irctcId: 'IR001' }
            ];

            UpgradeNotificationService.hasDeniedBerth.mockResolvedValue(true);

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(0);
        });

        it('should handle notification creation failure gracefully', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15', coachNo: 'S1', type: 'Lower' };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: true, passengerStatus: 'Online', irctcId: 'IR001' }
            ];

            UpgradeNotificationService.hasDeniedBerth.mockResolvedValue(false);
            UpgradeNotificationService.createUpgradeNotification.mockRejectedValue(
                new Error('Notification failed')
            );

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(0);
        });

        it('should handle in-app notification failure gracefully', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15', coachNo: 'S1', type: 'Lower' };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: true, passengerStatus: 'Online', irctcId: 'IR001' }
            ];

            UpgradeNotificationService.hasDeniedBerth.mockResolvedValue(false);
            UpgradeNotificationService.createUpgradeNotification.mockResolvedValue({ id: 'N001' });
            InAppNotificationService.createNotification.mockRejectedValue(
                new Error('In-app failed')
            );

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(1);
        });

        it('should handle push notification failure gracefully', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15', coachNo: 'S1', type: 'Lower' };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: true, passengerStatus: 'Online', irctcId: 'IR001' }
            ];

            UpgradeNotificationService.hasDeniedBerth.mockResolvedValue(false);
            UpgradeNotificationService.createUpgradeNotification.mockResolvedValue({ id: 'N001' });
            InAppNotificationService.createNotification.mockResolvedValue({ success: true });
            WebPushService.sendPushNotification.mockRejectedValue(new Error('Push failed'));

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(1);
        });

        it('should not send push to passenger without irctcId', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15', coachNo: 'S1', type: 'Lower' };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: true, passengerStatus: 'Online' }
            ];

            UpgradeNotificationService.hasDeniedBerth.mockResolvedValue(false);
            UpgradeNotificationService.createUpgradeNotification.mockResolvedValue({ id: 'N001' });

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(1);
            expect(InAppNotificationService.createNotification).not.toHaveBeenCalled();
        });

        it('should return success with offers created', async () => {
            const vacantBerthInfo = { fullBerthNo: 'S1-15', coachNo: 'S1', type: 'Lower' };
            const currentStation = { name: 'Station B', code: 'STB' };

            mockTrainState.racQueue = [
                { pnr: 'R001', name: 'RAC1', boarded: true, passengerStatus: 'Online', irctcId: 'IR001' }
            ];

            UpgradeNotificationService.hasDeniedBerth.mockResolvedValue(false);
            UpgradeNotificationService.createUpgradeNotification.mockResolvedValue({ id: 'N001' });
            InAppNotificationService.createNotification.mockResolvedValue({ success: true });
            WebPushService.sendPushNotification.mockResolvedValue({ success: true });

            const result = await ReallocationService.processVacancyForUpgrade(
                mockTrainState,
                vacantBerthInfo,
                currentStation
            );

            expect(result.offersCreated).toBe(1);
            expect(result.error).toBeNull();
        });
    });
});
