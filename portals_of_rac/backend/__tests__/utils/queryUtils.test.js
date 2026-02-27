/**
 * QueryUtils Tests
 */

const { withTimeout, withRetry, paginate, QueryTimeouts } = require('../../utils/queryUtils');

describe('QueryUtils', () => {
    describe('withTimeout', () => {
        it('should execute query successfully', async () => {
            const queryFn = jest.fn().mockResolvedValue('result');
            
            const result = await withTimeout(queryFn, { timeout: 1000 });
            
            expect(result).toBe('result');
            expect(queryFn).toHaveBeenCalled();
        });

        it('should timeout slow query', async () => {
            const queryFn = jest.fn(() => new Promise(resolve => setTimeout(() => resolve('result'), 200)));
            
            await expect(withTimeout(queryFn, { timeout: 50, name: 'test' }))
                .rejects.toThrow('timed out');
        });

        it('should return fallback on timeout', async () => {
            const queryFn = jest.fn(() => new Promise(resolve => setTimeout(() => resolve('result'), 200)));
            
            const result = await withTimeout(queryFn, { timeout: 50, fallback: 'fallback' });
            
            expect(result).toBe('fallback');
        });

        it('should log slow queries', async () => {
            const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
            const queryFn = jest.fn(() => new Promise(resolve => setTimeout(() => resolve('result'), 600)));
            
            await withTimeout(queryFn, { timeout: 1000, name: 'slow-query' });
            
            expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Slow query'));
            consoleWarn.mockRestore();
        });
    });

    describe('QueryTimeouts', () => {
        it('should have predefined timeouts', () => {
            expect(QueryTimeouts.FAST).toBe(100);
            expect(QueryTimeouts.MEDIUM).toBe(500);
            expect(QueryTimeouts.SLOW).toBe(2000);
            expect(QueryTimeouts.BULK).toBe(10000);
            expect(QueryTimeouts.DEFAULT).toBe(5000);
        });
    });

    describe('withRetry', () => {
        it('should execute successfully on first try', async () => {
            const queryFn = jest.fn().mockResolvedValue('success');
            
            const result = await withRetry(queryFn);
            
            expect(result).toBe('success');
            expect(queryFn).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure', async () => {
            const queryFn = jest.fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'))
                .mockResolvedValue('success');
            
            const result = await withRetry(queryFn, { maxRetries: 3, initialDelay: 10 });
            
            expect(result).toBe('success');
            expect(queryFn).toHaveBeenCalledTimes(3);
        });

        it('should throw after max retries', async () => {
            const queryFn = jest.fn().mockRejectedValue(new Error('permanent failure'));
            
            await expect(withRetry(queryFn, { maxRetries: 2, initialDelay: 10 }))
                .rejects.toThrow('permanent failure');
            
            expect(queryFn).toHaveBeenCalledTimes(2);
        });

        it('should use exponential backoff', async () => {
            const queryFn = jest.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValue('success');
            
            const start = Date.now();
            await withRetry(queryFn, { maxRetries: 2, initialDelay: 50 });
            const duration = Date.now() - start;
            
            expect(duration).toBeGreaterThanOrEqual(50);
        });
    });

    describe('paginate', () => {
        it('should paginate results', async () => {
            const mockCollection = {
                find: jest.fn().mockReturnValue({
                    project: jest.fn().mockReturnThis(),
                    sort: jest.fn().mockReturnThis(),
                    skip: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
                }),
                countDocuments: jest.fn().mockResolvedValue(100)
            };

            const result = await paginate(mockCollection, {}, { page: 1, limit: 50 });
            
            expect(result.data.length).toBe(2);
            expect(result.pagination.total).toBe(100);
            expect(result.pagination.totalPages).toBe(2);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(false);
        });

        it('should calculate correct pagination for page 2', async () => {
            const mockCollection = {
                find: jest.fn().mockReturnValue({
                    project: jest.fn().mockReturnThis(),
                    sort: jest.fn().mockReturnThis(),
                    skip: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([])
                }),
                countDocuments: jest.fn().mockResolvedValue(100)
            };

            const result = await paginate(mockCollection, {}, { page: 2, limit: 50 });
            
            expect(result.pagination.page).toBe(2);
            expect(result.pagination.hasNext).toBe(false);
            expect(result.pagination.hasPrev).toBe(true);
        });

        it('should use default pagination values', async () => {
            const mockCollection = {
                find: jest.fn().mockReturnValue({
                    project: jest.fn().mockReturnThis(),
                    sort: jest.fn().mockReturnThis(),
                    skip: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    toArray: jest.fn().mockResolvedValue([])
                }),
                countDocuments: jest.fn().mockResolvedValue(10)
            };

            const result = await paginate(mockCollection, {});
            
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(50);
        });
    });
});

// 15 tests for queryUtils
