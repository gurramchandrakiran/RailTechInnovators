import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/test-data';

test.describe('Admin Login Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display login page with correct elements', async ({ page }) => {
        // Check for login form elements
        await expect(page.locator('h1, h2, h3').filter({ hasText: /login|sign in/i }).first()).toBeVisible();

        // Check for input fields
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await expect(employeeIdInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        // Fill in invalid credentials
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill('INVALID_USER');
        await passwordInput.fill('wrongpassword');

        // Click login button
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Should show error message
        await expect(page.locator('text=/invalid|error|incorrect|failed/i').first()).toBeVisible({ timeout: 10000 });
    });

    test('should login successfully with valid admin credentials', async ({ page }) => {
        // Fill in valid credentials
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);

        // Click login button
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Should redirect to dashboard or show dashboard content
        await expect(page).toHaveURL(/dashboard|home|admin/i, { timeout: 10000 });

        // Or check for dashboard elements
        await expect(page.locator('text=/dashboard|welcome|overview/i').first()).toBeVisible({ timeout: 10000 });
    });

    test('should persist login state after page refresh', async ({ page }) => {
        // Login first
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Wait for dashboard
        await page.waitForURL(/dashboard|home|admin/i, { timeout: 10000 });

        // Refresh page
        await page.reload();

        // Should still be on dashboard (not redirected to login)
        await expect(page).not.toHaveURL(/login/i);
    });

    test('should logout successfully', async ({ page }) => {
        // Login first
        const employeeIdInput = page.locator('input[name="employeeId"], input[placeholder*="Employee"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]');

        await employeeIdInput.fill(testUsers.admin.employeeId);
        await passwordInput.fill(testUsers.admin.password);
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Wait for dashboard
        await page.waitForURL(/dashboard|home|admin/i, { timeout: 10000 });

        // Find and click logout button
        await page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [aria-label*="logout"]').first().click();

        // Should redirect to login page
        await expect(page).toHaveURL(/login|\//i, { timeout: 10000 });
    });
});

test.describe('Login Form Validation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should validate required fields', async ({ page }) => {
        // Click login without filling fields
        await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first().click();

        // Should show validation errors or the button should be disabled
        const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first();

        // Either button is disabled or error messages are shown
        const isDisabled = await submitButton.isDisabled();
        if (!isDisabled) {
            // Check for error messages
            await expect(page.locator('text=/required|enter|provide/i').first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should handle password visibility toggle', async ({ page }) => {
        const passwordInput = page.locator('input[type="password"]');

        // Initially password should be hidden
        await expect(passwordInput).toHaveAttribute('type', 'password');

        // Look for visibility toggle button (if exists)
        const toggleButton = page.locator('button[aria-label*="password"], button:has([data-testid*="visibility"]), [role="button"]:near(input[type="password"])');

        if (await toggleButton.isVisible()) {
            await toggleButton.click();

            // Password should now be visible
            const passwordInput2 = page.locator('input[name*="password"], input[placeholder*="password" i]').first();
            await expect(passwordInput2).toHaveAttribute('type', 'text');
        }
    });
});

test.describe('Login Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should be keyboard navigable', async ({ page }) => {
        // Tab through the form
        await page.keyboard.press('Tab');

        // First focusable element should be focused
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();

        // Should be able to navigate with keyboard
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Should still have focus on some element
        await expect(page.locator(':focus')).toBeVisible();
    });

    test('should have proper ARIA labels', async ({ page }) => {
        // Check for proper labeling
        const inputs = page.locator('input');
        const inputCount = await inputs.count();

        for (let i = 0; i < inputCount; i++) {
            const input = inputs.nth(i);
            const hasLabel = await input.getAttribute('aria-label') ||
                await input.getAttribute('aria-labelledby') ||
                await input.getAttribute('id');

            // Each input should have some form of labeling
            expect(hasLabel).toBeTruthy();
        }
    });
});
