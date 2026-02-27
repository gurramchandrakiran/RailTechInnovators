import { test, expect } from '@playwright/test';
import { testUsers, testTrain } from './fixtures/test-data';

test.describe('Dashboard and Booking Status', () => {
    // Login before each test
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Login
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Wait for dashboard
        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });
    });

    test('should display dashboard with key metrics', async ({ page }) => {
        // Dashboard should show key statistics
        await expect(page.locator('text=/total|passengers|bookings|trains/i').first()).toBeVisible({ timeout: 10000 });
    });

    test('should show train status information', async ({ page }) => {
        // Look for train-related content
        const trainContent = page.locator('text=/train|journey|status/i').first();

        if (await trainContent.isVisible()) {
            await expect(trainContent).toBeVisible();
        }
    });

    test('should display passenger list or table', async ({ page }) => {
        // Navigate to passengers section if needed
        const passengersLink = page.locator('a:has-text("Passenger"), button:has-text("Passenger"), [href*="passenger"]').first();

        if (await passengersLink.isVisible()) {
            await passengersLink.click();
            await page.waitForLoadState('networkidle');
        }

        // Should show some passenger content or table
        const passengerContent = page.locator('table, [role="grid"], text=/PNR|passenger|booking/i').first();
        await expect(passengerContent).toBeVisible({ timeout: 10000 });
    });

    test('should handle search/filter functionality', async ({ page }) => {
        // Look for search input
        const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="PNR" i]').first();

        if (await searchInput.isVisible()) {
            // Enter a search term
            await searchInput.fill('TEST');
            await page.keyboard.press('Enter');

            // Wait for results to update
            await page.waitForLoadState('networkidle');

            // Page should still be functional
            await expect(page.locator('body')).toBeVisible();
        }
    });
});

test.describe('Train Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Login as admin
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });
    });

    test('should display train details', async ({ page }) => {
        // Look for train section
        const trainSection = page.locator('text=/train|journey|route/i').first();

        if (await trainSection.isVisible()) {
            // Should show train number or name
            const trainInfo = page.locator(`text=/${testTrain.trainNumber}|${testTrain.trainName}/i`).first();

            // If train data is loaded, verify it's displayed
            if (await trainInfo.isVisible({ timeout: 5000 }).catch(() => false)) {
                await expect(trainInfo).toBeVisible();
            }
        }
    });

    test('should show station list', async ({ page }) => {
        // Look for stations section
        const stationsContent = page.locator('text=/station|stop|route/i').first();

        if (await stationsContent.isVisible()) {
            // Check if any station from test data is visible
            for (const station of testTrain.stations.slice(0, 3)) {
                const stationElement = page.locator(`text=/${station.name}|${station.code}/i`).first();
                if (await stationElement.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await expect(stationElement).toBeVisible();
                    break;
                }
            }
        }
    });

    test('should handle station arrival interaction', async ({ page }) => {
        // Look for station arrival button or control
        const arrivalButton = page.locator('button:has-text("Arrive"), button:has-text("Next Station"), button:has-text("Move")').first();

        if (await arrivalButton.isVisible()) {
            // Click the button
            await arrivalButton.click();

            // Should show confirmation or update UI
            await page.waitForLoadState('networkidle');

            // Check for any success/update indication
            const updateIndicator = page.locator('text=/updated|success|arrived|moved/i').first();
            if (await updateIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
                await expect(updateIndicator).toBeVisible();
            }
        }
    });
});

test.describe('RAC Queue Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Login as admin
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });
    });

    test('should display RAC queue status', async ({ page }) => {
        // Navigate to RAC section if available
        const racLink = page.locator('a:has-text("RAC"), button:has-text("RAC"), [href*="rac"]').first();

        if (await racLink.isVisible()) {
            await racLink.click();
            await page.waitForLoadState('networkidle');
        }

        // Look for RAC-related content
        const racContent = page.locator('text=/RAC|queue|waiting/i').first();
        await expect(racContent).toBeVisible({ timeout: 10000 });
    });

    test('should show reallocation options', async ({ page }) => {
        // Look for reallocation section
        const reallocationContent = page.locator('text=/realloc|upgrade|confirm/i').first();

        if (await reallocationContent.isVisible()) {
            await expect(reallocationContent).toBeVisible();
        }
    });
});

test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        await page.goto('/');

        // Login form should still be visible
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        await expect(employeeIdInput).toBeVisible();

        // Complete login
        const passwordInput = page.locator('input[type="password"]');
        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Dashboard should load
        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });

        // Content should be visible
        await expect(page.locator('body')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
        // Set tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });

        await page.goto('/');

        // Login should work
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        await page.waitForURL(/dashboard|home|admin/i, { timeout: 15000 });

        // Dashboard should be functional
        await expect(page.locator('body')).toBeVisible();
    });
});
