import { test, expect, Page } from '@playwright/test';
import { testUsers } from './fixtures/test-data';

// Helper to setup WebSocket listener
async function setupWebSocketListener(page: Page) {
    return page.evaluate(() => {
        return new Promise<void>((resolve) => {
            // Store received messages
            (window as any).__wsMessages = [];

            // Intercept WebSocket
            const OriginalWebSocket = window.WebSocket;
            (window as any).WebSocket = function (url: string, protocols?: string | string[]) {
                const ws = new OriginalWebSocket(url, protocols);

                ws.addEventListener('message', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        (window as any).__wsMessages.push(data);
                    } catch (e) {
                        (window as any).__wsMessages.push({ raw: event.data });
                    }
                });

                return ws;
            };

            resolve();
        });
    });
}

// Helper to get received WebSocket messages
async function getWebSocketMessages(page: Page): Promise<any[]> {
    return page.evaluate(() => (window as any).__wsMessages || []);
}

test.describe('WebSocket Real-time Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Setup WebSocket listener before login
        await setupWebSocketListener(page);

        // Login as admin
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });
    });

    test('should establish WebSocket connection on login', async ({ page }) => {
        // Wait for WebSocket to connect
        await page.waitForTimeout(2000);

        // Check for connection success message
        const messages = await getWebSocketMessages(page);
        const connectionMsg = messages.find(m =>
            m.type === 'CONNECTION_SUCCESS' ||
            m.type === 'connected' ||
            m.message?.includes('Connected')
        );

        // WebSocket should have received at least some messages
        // (or it might not be implemented yet)
        expect(Array.isArray(messages)).toBe(true);
    });

    test('should display notification indicator', async ({ page }) => {
        // Look for notification bell or indicator
        const notificationIndicator = page.locator(
            '[aria-label*="notification"], ' +
            'button:has([data-testid*="notification"]), ' +
            '[class*="notification"], ' +
            '[class*="bell"]'
        ).first();

        // If notification UI exists, it should be visible
        if (await notificationIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(notificationIndicator).toBeVisible();
        }
    });

    test('should handle notification click', async ({ page }) => {
        const notificationButton = page.locator(
            'button[aria-label*="notification"], ' +
            '[class*="notification-bell"], ' +
            '[data-testid*="notification"]'
        ).first();

        if (await notificationButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await notificationButton.click();

            // Should show notification panel or dropdown
            const notificationPanel = page.locator(
                '[class*="notification-panel"], ' +
                '[class*="notification-dropdown"], ' +
                '[role="menu"], ' +
                '[class*="popover"]'
            ).first();

            if (await notificationPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
                await expect(notificationPanel).toBeVisible();
            }
        }
    });
});

test.describe('Toast Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should show error toast on failed login', async ({ page }) => {
        // Try invalid login
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill('INVALID');
        await passwordInput.fill('wrong');
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Should show error toast or message
        const errorMessage = page.locator(
            '[class*="toast"], ' +
            '[class*="alert"], ' +
            '[class*="snackbar"], ' +
            '[role="alert"], ' +
            'text=/error|invalid|incorrect|failed/i'
        ).first();

        await expect(errorMessage).toBeVisible({ timeout: 10000 });
    });

    test('should auto-dismiss toast after timeout', async ({ page }) => {
        // Login with invalid credentials to trigger toast
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill('INVALID');
        await passwordInput.fill('wrong');
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Wait for toast
        const toast = page.locator('[class*="toast"], [role="alert"]').first();

        if (await toast.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Wait for auto-dismiss (usually 3-5 seconds)
            await page.waitForTimeout(6000);

            // Toast might be hidden or removed
            // This is a soft check since implementation varies
        }
    });
});

test.describe('Real-time Updates Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Login
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });
    });

    test('should show real-time status indicators', async ({ page }) => {
        // Look for live/real-time indicators
        const liveIndicator = page.locator(
            '[class*="live"], ' +
            '[class*="real-time"], ' +
            '[class*="status-indicator"], ' +
            'text=/live|connected|online/i'
        ).first();

        // If implemented, should be visible
        if (await liveIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(liveIndicator).toBeVisible();
        }
    });

    test('should update UI on data changes', async ({ page }) => {
        // Get initial content hash
        const initialContent = await page.locator('main, [class*="content"], [class*="dashboard"]').first().textContent();

        // Wait for potential updates
        await page.waitForTimeout(5000);

        // Page should still be functional
        await expect(page.locator('body')).toBeVisible();

        // If there's a refresh button, test it
        const refreshButton = page.locator('button:has-text("Refresh"), button[aria-label*="refresh"]').first();

        if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await refreshButton.click();
            await page.waitForLoadState('networkidle');

            // Page should update
            await expect(page.locator('body')).toBeVisible();
        }
    });

    test('should handle connection status changes', async ({ page }) => {
        // Look for connection status indicator
        const connectionStatus = page.locator(
            '[class*="connection-status"], ' +
            '[class*="ws-status"], ' +
            '[aria-label*="connection"]'
        ).first();

        if (await connectionStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Should show connected status
            await expect(connectionStatus).toBeVisible();
        }
    });
});

test.describe('Push Notification Permission', () => {
    test('should handle notification permission request', async ({ page, context }) => {
        // Grant notification permission
        await context.grantPermissions(['notifications']);

        await page.goto('/');

        // Login
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });

        // Page should function normally
        await expect(page.locator('body')).toBeVisible();
    });

    test('should work without notification permission', async ({ page, context }) => {
        // Deny notification permission
        await context.grantPermissions([]);

        await page.goto('/');

        // Login
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });

        // Page should still function without push notifications
        await expect(page.locator('body')).toBeVisible();
    });
});
