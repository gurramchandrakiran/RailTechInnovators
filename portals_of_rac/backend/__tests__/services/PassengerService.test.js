const PassengerService = require('../../services/PassengerService');
const UpgradeNotificationService = require('../../services/UpgradeNotificationService');
const db = require('../../config/db');

jest.mock('../../services/UpgradeNotificationService');
jest.mock('../../config/db');

describe('PassengerService', () => {
    let mockTrainState;
    let mockPassengersCollection;
    let mockNotification;

    beforeEach(() => {
        jest.clearAllMocks();

        mockNotification = {
            id: 'NOTIF123',
            pnr: 'P001',
            status: 'PENDING',
            currentBerth: 'RAC 1',
            offeredBerth: 'S1-15',
            offeredBerthType: 'Lower Berth',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
        };

        mockPassengersCollection = {
            findOne: jest.fn()
        };

        db.getPassengersCollection = jest.fn(() => mockPassengersCollection);

        UpgradeNotificationService.getAllNotifications = jest.fn();
        UpgradeNotificationService.acceptUpgrade = jest.fn();
        UpgradeNotificationService.denyUpgrade = jest.fn();

        mockTrainState = {
            trainName: 'Amaravathi Express',
            stations: [
                { code: 'STA', arrival: '10:00' },
                { code: 'STB', arrival: '12:00' },
                { code: 'STC', arrival: '14:00' }
            ],
            findPassengerByPNR: jest.fn(),
            getAllPassengers: jest.fn(() => [])
        };
    });

    describe('acceptUpgrade', () => {
        it('should accept upgrade successfully', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);
            UpgradeNotificationService.acceptUpgrade.mockResolvedValue({
                ...mockNotification,
                status: 'ACCEPTED'
            });
            mockTrainState.findPassengerByPNR.mockReturnValue({
                pnr: 'P001',
                name: 'John Doe'
            });

            const result = await PassengerService.acceptUpgrade('P001', 'NOTIF123', mockTrainState);

            expect(result.success).toBe(true);
            expect(result.notification.status).toBe('ACCEPTED');
            expect(UpgradeNotificationService.acceptUpgrade).toHaveBeenCalledWith('P001', 'NOTIF123');
        });

        it('should throw error if notification not found', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([]);

            await expect(PassengerService.acceptUpgrade('P001', 'NOTIF999', mockTrainState))
                .rejects.toThrow('Notification not found');
        });

        it('should throw error if notification already accepted', async () => {
            mockNotification.status = 'ACCEPTED';
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);

            await expect(PassengerService.acceptUpgrade('P001', 'NOTIF123', mockTrainState))
                .rejects.toThrow('already accepted');
        });

        it('should throw error if notification already denied', async () => {
            mockNotification.status = 'DENIED';
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);

            await expect(PassengerService.acceptUpgrade('P001', 'NOTIF123', mockTrainState))
                .rejects.toThrow('already denied');
        });

        it('should throw error if notification has expired', async () => {
            mockNotification.expiresAt = new Date(Date.now() - 3600000).toISOString();
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);

            await expect(PassengerService.acceptUpgrade('P001', 'NOTIF123', mockTrainState))
                .rejects.toThrow('expired');
        });

        it('should return passenger details if found in train state', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);
            UpgradeNotificationService.acceptUpgrade.mockResolvedValue({
                ...mockNotification,
                status: 'ACCEPTED'
            });
            mockTrainState.findPassengerByPNR.mockReturnValue({
                pnr: 'P001',
                name: 'John Doe'
            });

            const result = await PassengerService.acceptUpgrade('P001', 'NOTIF123', mockTrainState);

            expect(result.passenger).toBeDefined();
            expect(result.passenger.pnr).toBe('P001');
            expect(result.passenger.name).toBe('John Doe');
        });

        it('should handle passenger not found in train state', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);
            UpgradeNotificationService.acceptUpgrade.mockResolvedValue({
                ...mockNotification,
                status: 'ACCEPTED'
            });
            mockTrainState.findPassengerByPNR.mockReturnValue(null);

            const result = await PassengerService.acceptUpgrade('P001', 'NOTIF123', mockTrainState);

            expect(result.success).toBe(true);
            expect(result.passenger).toBeNull();
        });

        it('should include appropriate success message', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);
            UpgradeNotificationService.acceptUpgrade.mockResolvedValue({
                ...mockNotification,
                status: 'ACCEPTED'
            });
            mockTrainState.findPassengerByPNR.mockReturnValue({
                pnr: 'P001',
                name: 'John Doe'
            });

            const result = await PassengerService.acceptUpgrade('P001', 'NOTIF123', mockTrainState);

            expect(result.message).toContain('Pending TTE confirmation');
        });
    });

    describe('denyUpgrade', () => {
        it('should deny upgrade successfully', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);
            UpgradeNotificationService.denyUpgrade.mockResolvedValue({
                ...mockNotification,
                status: 'DENIED'
            });

            const result = await PassengerService.denyUpgrade('P001', 'NOTIF123');

            expect(result.success).toBe(true);
            expect(result.notification.status).toBe('DENIED');
            expect(UpgradeNotificationService.denyUpgrade).toHaveBeenCalledWith('P001', 'NOTIF123');
        });

        it('should throw error if notification not found', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([]);

            await expect(PassengerService.denyUpgrade('P001', 'NOTIF999'))
                .rejects.toThrow('Notification not found');
        });

        it('should throw error if notification not pending', async () => {
            mockNotification.status = 'ACCEPTED';
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);

            await expect(PassengerService.denyUpgrade('P001', 'NOTIF123'))
                .rejects.toThrow('already accepted');
        });

        it('should include appropriate success message', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([mockNotification]);
            UpgradeNotificationService.denyUpgrade.mockResolvedValue({
                ...mockNotification,
                status: 'DENIED'
            });

            const result = await PassengerService.denyUpgrade('P001', 'NOTIF123');

            expect(result.message).toContain('declined successfully');
        });
    });

    describe('getUpgradeNotifications', () => {
        it('should return all notifications for PNR', async () => {
            const notifications = [mockNotification];
            UpgradeNotificationService.getAllNotifications.mockResolvedValue(notifications);

            const result = await PassengerService.getUpgradeNotifications('P001');

            expect(result).toEqual(notifications);
            expect(UpgradeNotificationService.getAllNotifications).toHaveBeenCalledWith('P001');
        });

        it('should return empty array if no notifications', async () => {
            UpgradeNotificationService.getAllNotifications.mockResolvedValue([]);

            const result = await PassengerService.getUpgradeNotifications('P001');

            expect(result).toEqual([]);
        });
    });

    describe('getPassengerDetails', () => {
        const mockDBPassenger = {
            PNR_Number: 'P001',
            IRCTC_ID: 'IR_001',
            Name: 'John Doe',
            Age: 30,
            Gender: 'M',
            Mobile: '1234567890',
            Email: 'john@example.com',
            Train_Number: '17225',
            Train_Name: 'Amaravathi Express',
            Assigned_Coach: 'S1',
            Assigned_berth: 15,
            Berth_Type: 'Lower Berth',
            PNR_Status: 'CNF',
            Rac_status: '-',
            Class: 'SL',
            Quota: 'GN',
            From: 'STA',
            To: 'STC',
            Boarding_Station: 'Station A (STA)',
            Deboarding_Station: 'Station C (STC)',
            Boarded: true,
            Passenger_Status: 'Online',
            NO_show: false
        };

        it('should return passenger details from database', async () => {
            mockPassengersCollection.findOne.mockResolvedValue(mockDBPassenger);

            const result = await PassengerService.getPassengerDetails('P001', mockTrainState);

            expect(result.pnr).toBe('P001');
            expect(result.name).toBe('John Doe');
            expect(result.irctcId).toBe('IR_001');
            expect(result.email).toBe('john@example.com');
        });

        it('should throw error if PNR not found', async () => {
            mockPassengersCollection.findOne.mockResolvedValue(null);

            await expect(PassengerService.getPassengerDetails('P999', mockTrainState))
                .rejects.toThrow('PNR not found');
        });

        it('should extract station code from full station name', async () => {
            mockPassengersCollection.findOne.mockResolvedValue(mockDBPassenger);

            const result = await PassengerService.getPassengerDetails('P001', mockTrainState);

            expect(result.boardingStation).toBe('STA');
            expect(result.destinationStation).toBe('STC');
        });

        it('should get boarding time from train state', async () => {
            mockPassengersCollection.findOne.mockResolvedValue(mockDBPassenger);

            const result = await PassengerService.getPassengerDetails('P001', mockTrainState);

            expect(result.boardingTime).toBe('10:00');
        });

        it('should handle missing train state gracefully', async () => {
            mockPassengersCollection.findOne.mockResolvedValue(mockDBPassenger);

            const result = await PassengerService.getPassengerDetails('P001', null);

            expect(result.trainName).toBe('Amaravathi Express');
            expect(result.boardingTime).toBe('N/A');
        });

        it('should format berth correctly', async () => {
            mockPassengersCollection.findOne.mockResolvedValue(mockDBPassenger);

            const result = await PassengerService.getPassengerDetails('P001', mockTrainState);

            expect(result.berth).toBe('S1-15');
        });

        it('should include all passenger fields', async () => {
            mockPassengersCollection.findOne.mockResolvedValue(mockDBPassenger);

            const result = await PassengerService.getPassengerDetails('P001', mockTrainState);

            expect(result).toHaveProperty('pnr');
            expect(result).toHaveProperty('irctcId');
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('age');
            expect(result).toHaveProperty('gender');
            expect(result).toHaveProperty('mobile');
            expect(result).toHaveProperty('email');
            expect(result).toHaveProperty('trainNo');
            expect(result).toHaveProperty('berth');
            expect(result).toHaveProperty('berthType');
            expect(result).toHaveProperty('pnrStatus');
            expect(result).toHaveProperty('class');
            expect(result).toHaveProperty('boarded');
            expect(result).toHaveProperty('passengerStatus');
        });

        it('should handle missing optional fields', async () => {
            const minimalPassenger = {
                PNR_Number: 'P001',
                Name: 'John Doe',
                Age: 30,
                Gender: 'M',
                Assigned_Coach: 'S1',
                Assigned_berth: 15,
                PNR_Status: 'CNF',
                Class: 'SL'
            };
            mockPassengersCollection.findOne.mockResolvedValue(minimalPassenger);

            const result = await PassengerService.getPassengerDetails('P001', mockTrainState);

            expect(result.irctcId).toBeNull();
            expect(result.racStatus).toBe('-');
            expect(result.quota).toBe('GN');
        });

        it('should use From field if Boarding_Station not available', async () => {
            const passenger = {
                ...mockDBPassenger,
                Boarding_Station: null,
                From: 'STA'
            };
            mockPassengersCollection.findOne.mockResolvedValue(passenger);

            const result = await PassengerService.getPassengerDetails('P001', mockTrainState);

            expect(result.boardingStation).toBe('STA');
        });

        it('should use To field if Deboarding_Station not available', async () => {
            const passenger = {
                ...mockDBPassenger,
                Deboarding_Station: null,
                To: 'STC'
            };
            mockPassengersCollection.findOne.mockResolvedValue(passenger);

            const result = await PassengerService.getPassengerDetails('P001', mockTrainState);

            expect(result.destinationStation).toBe('STC');
        });
    });

    describe('getPassengersByStatus', () => {
        const mockPassengers = [
            { pnr: 'P001', name: 'John', pnrStatus: 'CNF', boarded: true, noShow: false },
            { pnr: 'P002', name: 'Jane', pnrStatus: 'RAC', boarded: true, noShow: false },
            { pnr: 'P003', name: 'Bob', pnrStatus: 'CNF', boarded: false, noShow: false },
            { pnr: 'P004', name: 'Alice', pnrStatus: 'CNF', boarded: true, noShow: true }
        ];

        beforeEach(() => {
            mockTrainState.getAllPassengers.mockReturnValue(mockPassengers);
        });

        it('should throw error if train not initialized', () => {
            expect(() => PassengerService.getPassengersByStatus('boarded', null))
                .toThrow('Train not initialized');
        });

        it('should filter boarded passengers', () => {
            const result = PassengerService.getPassengersByStatus('boarded', mockTrainState);

            expect(result.length).toBe(3);
            expect(result.every(p => p.boarded)).toBe(true);
        });

        it('should filter RAC passengers', () => {
            const result = PassengerService.getPassengersByStatus('rac', mockTrainState);

            expect(result.length).toBe(1);
            expect(result[0].pnrStatus).toBe('RAC');
        });

        it('should filter CNF passengers', () => {
            const result = PassengerService.getPassengersByStatus('cnf', mockTrainState);

            expect(result.length).toBe(3);
            expect(result.every(p => p.pnrStatus === 'CNF')).toBe(true);
        });

        it('should filter no-show passengers', () => {
            const result = PassengerService.getPassengersByStatus('no-show', mockTrainState);

            expect(result.length).toBe(1);
            expect(result[0].noShow).toBe(true);
        });

        it('should return all passengers for unknown status', () => {
            const result = PassengerService.getPassengersByStatus('unknown', mockTrainState);

            expect(result.length).toBe(4);
        });

        it('should return all passengers for null status', () => {
            const result = PassengerService.getPassengersByStatus(null, mockTrainState);

            expect(result.length).toBe(4);
        });

        it('should be case-insensitive', () => {
            const result = PassengerService.getPassengersByStatus('BOARDED', mockTrainState);

            expect(result.length).toBe(3);
        });

        it('should handle empty passenger list', () => {
            mockTrainState.getAllPassengers.mockReturnValue([]);

            const result = PassengerService.getPassengersByStatus('boarded', mockTrainState);

            expect(result).toEqual([]);
        });
    });
});
