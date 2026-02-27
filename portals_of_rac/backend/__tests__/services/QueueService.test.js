/**
 * QueueService Tests
 */

const QueueService = require('../../services/QueueService');

describe('QueueService', () => {
    beforeEach(() => {
        QueueService.queue = [];
    });

    describe('addToQueue', () => {
        it('should add RAC passengers to queue', () => {
            const passengers = [
                { pnr: 'PNR001', pnr_status: 'RAC1', name: 'Test 1', fromIdx: 0, toIdx: 2 },
                { pnr: 'PNR002', pnr_status: 'RAC2', name: 'Test 2', fromIdx: 0, toIdx: 2 }
            ];

            QueueService.addToQueue(passengers);

            expect(QueueService.getSize()).toBe(2);
        });

        it('should filter non-RAC passengers', () => {
            const passengers = [
                { pnr: 'PNR001', pnr_status: 'CNF', name: 'Test 1', fromIdx: 0, toIdx: 2 },
                { pnr: 'PNR002', pnr_status: 'RAC1', name: 'Test 2', fromIdx: 0, toIdx: 2 }
            ];

            QueueService.addToQueue(passengers);

            expect(QueueService.getSize()).toBe(1);
        });

        it('should sort queue after adding', () => {
            const passengers = [
                { pnr: 'PNR001', pnr_status: 'RAC2', name: 'Test 1', fromIdx: 0, toIdx: 2 },
                { pnr: 'PNR002', pnr_status: 'RAC1', name: 'Test 2', fromIdx: 0, toIdx: 2 }
            ];

            QueueService.addToQueue(passengers);

            const front = QueueService.getFront();
            expect(front.racNumber).toBe(1);
        });
    });

    describe('extractRACNumber', () => {
        it('should extract RAC number from status', () => {
            expect(QueueService.extractRACNumber('RAC1')).toBe(1);
            expect(QueueService.extractRACNumber('RAC 10')).toBe(10);
            expect(QueueService.extractRACNumber('rac5')).toBe(5);
        });

        it('should return 999 for invalid format', () => {
            expect(QueueService.extractRACNumber('INVALID')).toBe(999);
        });
    });

    describe('removeFromQueue', () => {
        it('should remove passenger by PNR', () => {
            QueueService.queue = [
                { pnr: 'PNR001', racNumber: 1 },
                { pnr: 'PNR002', racNumber: 2 }
            ];

            QueueService.removeFromQueue('PNR001');

            expect(QueueService.getSize()).toBe(1);
            expect(QueueService.getFront().pnr).toBe('PNR002');
        });

        it('should handle non-existent PNR', () => {
            QueueService.queue = [{ pnr: 'PNR001', racNumber: 1 }];

            QueueService.removeFromQueue('INVALID');

            expect(QueueService.getSize()).toBe(1);
        });
    });

    describe('getFront', () => {
        it('should return first element', () => {
            QueueService.queue = [
                { pnr: 'PNR001', racNumber: 1 },
                { pnr: 'PNR002', racNumber: 2 }
            ];

            expect(QueueService.getFront().pnr).toBe('PNR001');
        });

        it('should return null for empty queue', () => {
            expect(QueueService.getFront()).toBeNull();
        });
    });

    describe('pop', () => {
        it('should remove and return first element', () => {
            QueueService.queue = [
                { pnr: 'PNR001', racNumber: 1 },
                { pnr: 'PNR002', racNumber: 2 }
            ];

            const popped = QueueService.pop();

            expect(popped.pnr).toBe('PNR001');
            expect(QueueService.getSize()).toBe(1);
        });
    });

    describe('isEmpty', () => {
        it('should return true for empty queue', () => {
            expect(QueueService.isEmpty()).toBe(true);
        });

        it('should return false for non-empty queue', () => {
            QueueService.queue = [{ pnr: 'PNR001' }];
            expect(QueueService.isEmpty()).toBe(false);
        });
    });

    describe('getAll', () => {
        it('should return copy of queue', () => {
            QueueService.queue = [{ pnr: 'PNR001' }];
            const copy = QueueService.getAll();

            copy.push({ pnr: 'PNR002' });

            expect(QueueService.getSize()).toBe(1);
        });
    });
});

// 12 tests for QueueService
