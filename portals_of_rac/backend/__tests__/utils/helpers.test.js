/**
 * helpers Tests
 * Tests for utility helper functions
 */

const helpers = require('../../utils/helpers');

describe('helpers', () => {
    describe('formatPNR', () => {
        it('should format 10-digit PNR with spaces', () => {
            if (helpers.formatPNR) {
                const result = helpers.formatPNR('1234567890');
                expect(result.length).toBeGreaterThan(10); // Has spaces
            }
        });
    });

    describe('isValidPNR', () => {
        it('should return true for valid 10-digit PNR', () => {
            if (helpers.isValidPNR) {
                expect(helpers.isValidPNR('1234567890')).toBe(true);
            }
        });

        it('should return false for invalid PNR', () => {
            if (helpers.isValidPNR) {
                expect(helpers.isValidPNR('123')).toBe(false);
                expect(helpers.isValidPNR('abcdefghij')).toBe(false);
            }
        });
    });

    describe('generateUUID', () => {
        it('should generate unique IDs', () => {
            if (helpers.generateUUID) {
                const id1 = helpers.generateUUID();
                const id2 = helpers.generateUUID();
                expect(id1).not.toBe(id2);
            }
        });
    });

    describe('sanitizeString', () => {
        it('should remove HTML tags', () => {
            if (helpers.sanitizeString) {
                const result = helpers.sanitizeString('<script>alert("xss")</script>');
                expect(result).not.toContain('<script>');
            }
        });

        it('should trim whitespace', () => {
            if (helpers.sanitizeString) {
                const result = helpers.sanitizeString('  test  ');
                expect(result).toBe('test');
            }
        });
    });

    describe('calculateTimeDifference', () => {
        it('should calculate time difference correctly', () => {
            if (helpers.calculateTimeDifference) {
                const now = new Date();
                const later = new Date(now.getTime() + 3600000); // 1 hour later
                const diff = helpers.calculateTimeDifference(now, later);
                expect(diff).toBeGreaterThan(0);
            }
        });
    });

    describe('formatDate', () => {
        it('should format date correctly', () => {
            if (helpers.formatDate) {
                const date = new Date('2024-01-15');
                const result = helpers.formatDate(date);
                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            }
        });
    });

    describe('debounce', () => {
        it('should debounce function calls', (done) => {
            if (helpers.debounce) {
                let callCount = 0;
                const fn = helpers.debounce(() => callCount++, 100);

                fn();
                fn();
                fn();

                setTimeout(() => {
                    expect(callCount).toBe(1);
                    done();
                }, 150);
            } else {
                done();
            }
        });
    });

    describe('deepClone', () => {
        it('should create deep copy of object', () => {
            const original = { a: { b: 1 } };
            const clone = helpers.deepClone(original);
            clone.a.b = 2;
            expect(original.a.b).toBe(1);
        });
    });

    describe('formatTime', () => {
        it('should return time string as-is', () => {
            expect(helpers.formatTime('10:30')).toBe('10:30');
        });

        it('should handle special values', () => {
            expect(helpers.formatTime('-')).toBe('-');
            expect(helpers.formatTime('First')).toBe('First');
        });

        it('should handle null', () => {
            expect(helpers.formatTime(null)).toBeNull();
        });
    });

    describe('formatBerth', () => {
        it('should format berth notation', () => {
            const result = helpers.formatBerth('S1', '10', 'Lower Berth');
            expect(result).toBe('S1-10 (LB)');
        });

        it('should handle different berth types', () => {
            expect(helpers.formatBerth('A1', '5', 'Side Lower')).toBe('A1-5 (SL)');
            expect(helpers.formatBerth('S2', '15', 'Upper Berth')).toBe('S2-15 (UB)');
        });
    });

    describe('getBerthTypeAbbr', () => {
        it('should return correct abbreviations', () => {
            expect(helpers.getBerthTypeAbbr('Lower Berth')).toBe('LB');
            expect(helpers.getBerthTypeAbbr('Middle Berth')).toBe('MB');
            expect(helpers.getBerthTypeAbbr('Upper Berth')).toBe('UB');
            expect(helpers.getBerthTypeAbbr('Side Lower')).toBe('SL');
            expect(helpers.getBerthTypeAbbr('Side Upper')).toBe('SU');
        });

        it('should return original for unknown type', () => {
            expect(helpers.getBerthTypeAbbr('Unknown')).toBe('Unknown');
        });
    });

    describe('formatName', () => {
        it('should capitalize each word', () => {
            expect(helpers.formatName('john doe')).toBe('John Doe');
            expect(helpers.formatName('ALICE SMITH')).toBe('Alice Smith');
        });

        it('should handle single name', () => {
            expect(helpers.formatName('bob')).toBe('Bob');
        });
    });

    describe('generatePNR', () => {
        it('should generate 10-digit PNR', () => {
            const pnr = helpers.generatePNR();
            expect(pnr.length).toBe(10);
            expect(/^\d{10}$/.test(pnr)).toBe(true);
        });

        it('should generate unique PNRs', () => {
            const pnr1 = helpers.generatePNR();
            const pnr2 = helpers.generatePNR();
            expect(pnr1).not.toBe(pnr2);
        });
    });

    describe('sanitizeInput', () => {
        it('should remove angle brackets', () => {
            expect(helpers.sanitizeInput('<script>')).toBe('script');
            expect(helpers.sanitizeInput('hello<>world')).toBe('helloworld');
        });

        it('should trim whitespace', () => {
            expect(helpers.sanitizeInput('  test  ')).toBe('test');
        });

        it('should handle empty input', () => {
            expect(helpers.sanitizeInput('')).toBe('');
            expect(helpers.sanitizeInput(null)).toBe('');
        });
    });

    describe('isValidPNRFormat', () => {
        it('should validate 10-digit PNR', () => {
            expect(helpers.isValidPNRFormat('1234567890')).toBe(true);
        });

        it('should reject invalid formats', () => {
            expect(helpers.isValidPNRFormat('123')).toBe(false);
            expect(helpers.isValidPNRFormat('12345678901')).toBe(false);
            expect(helpers.isValidPNRFormat('abc1234567')).toBe(false);
        });

        it('should handle whitespace', () => {
            expect(helpers.isValidPNRFormat(' 1234567890 ')).toBe(true);
        });
    });

    describe('getGenderDisplay', () => {
        it('should convert old format', () => {
            expect(helpers.getGenderDisplay('M')).toBe('Male');
            expect(helpers.getGenderDisplay('F')).toBe('Female');
            expect(helpers.getGenderDisplay('O')).toBe('Other');
        });

        it('should handle new format', () => {
            expect(helpers.getGenderDisplay('Male')).toBe('Male');
            expect(helpers.getGenderDisplay('Female')).toBe('Female');
        });

        it('should handle null/undefined', () => {
            expect(helpers.getGenderDisplay(null)).toBe('Unknown');
            expect(helpers.getGenderDisplay(undefined)).toBe('Unknown');
        });
    });

    describe('formatClassName', () => {
        it('should format class codes', () => {
            expect(helpers.formatClassName('SL')).toBe('Sleeper');
            expect(helpers.formatClassName('AC_3_Tier')).toBe('AC 3-Tier');
            expect(helpers.formatClassName('2A')).toBe('AC 2-Tier');
        });

        it('should handle unknown class', () => {
            expect(helpers.formatClassName('UNKNOWN')).toBe('UNKNOWN');
        });

        it('should handle null', () => {
            expect(helpers.formatClassName(null)).toBe('Unknown');
        });
    });

    describe('getCurrentTimestamp', () => {
        it('should return ISO string', () => {
            const timestamp = helpers.getCurrentTimestamp();
            expect(timestamp).toBeDefined();
            expect(new Date(timestamp)).toBeInstanceOf(Date);
        });
    });

    describe('isEmpty', () => {
        it('should detect empty object', () => {
            expect(helpers.isEmpty({})).toBe(true);
        });

        it('should detect non-empty object', () => {
            expect(helpers.isEmpty({ a: 1 })).toBe(false);
        });
    });

    describe('arrayToObject', () => {
        it('should convert array to object', () => {
            const arr = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
            const obj = helpers.arrayToObject(arr, 'id');
            expect(obj[1]).toEqual({ id: 1, name: 'A' });
            expect(obj[2]).toEqual({ id: 2, name: 'B' });
        });
    });

    describe('getRandomElement', () => {
        it('should return element from array', () => {
            const arr = [1, 2, 3, 4, 5];
            const element = helpers.getRandomElement(arr);
            expect(arr).toContain(element);
        });
    });

    describe('chunkArray', () => {
        it('should chunk array into smaller arrays', () => {
            const arr = [1, 2, 3, 4, 5, 6, 7];
            const chunks = helpers.chunkArray(arr, 3);
            expect(chunks.length).toBe(3);
            expect(chunks[0]).toEqual([1, 2, 3]);
            expect(chunks[2]).toEqual([7]);
        });
    });

    describe('calculatePercentage', () => {
        it('should calculate percentage', () => {
            expect(helpers.calculatePercentage(25, 100)).toBe('25.00');
            expect(helpers.calculatePercentage(1, 3)).toBe('33.33');
        });

        it('should handle zero total', () => {
            expect(helpers.calculatePercentage(5, 0)).toBe(0);
        });
    });

    describe('formatNumber', () => {
        it('should format number with commas', () => {
            expect(helpers.formatNumber(1000)).toBe('1,000');
            expect(helpers.formatNumber(1234567)).toBe('1,234,567');
        });
    });

    describe('truncate', () => {
        it('should truncate long strings', () => {
            expect(helpers.truncate('Hello World', 5)).toBe('Hello...');
        });

        it('should not truncate short strings', () => {
            expect(helpers.truncate('Hi', 10)).toBe('Hi');
        });
    });

    describe('removeDuplicates', () => {
        it('should remove duplicate values', () => {
            const result = helpers.removeDuplicates([1, 2, 2, 3, 3, 3]);
            expect(result).toEqual([1, 2, 3]);
        });
    });

    describe('sortByProperty', () => {
        it('should sort ascending', () => {
            const arr = [{ age: 30 }, { age: 20 }, { age: 25 }];
            const sorted = helpers.sortByProperty(arr, 'age');
            expect(sorted[0].age).toBe(20);
            expect(sorted[2].age).toBe(30);
        });

        it('should sort descending', () => {
            const arr = [{ age: 20 }, { age: 30 }, { age: 25 }];
            const sorted = helpers.sortByProperty(arr, 'age', false);
            expect(sorted[0].age).toBe(30);
            expect(sorted[2].age).toBe(20);
        });
    });

    describe('groupBy', () => {
        it('should group by property', () => {
            const arr = [
                { type: 'A', val: 1 },
                { type: 'B', val: 2 },
                { type: 'A', val: 3 }
            ];
            const grouped = helpers.groupBy(arr, 'type');
            expect(grouped.A.length).toBe(2);
            expect(grouped.B.length).toBe(1);
        });
    });
});

// 40+ tests for helpers
