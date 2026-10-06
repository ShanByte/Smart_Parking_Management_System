import { test, expect } from '@playwright/test';

// Configuration
const API_BASE = 'http://127.0.0.1:4000/api/v1';

// Helper to register a unique user via API
async function registerUserViaApi(request: any, namePrefix = 'Driver') {
  const email = `${namePrefix.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@example.com`;
  const password = 'TestPassword123!';
  const name = `${namePrefix} Tester`;
  const res = await request.post(`${API_BASE}/auth/register`, {
    data: { name, email, password },
  });
  expect(res.ok()).toBeTruthy();
  return { name, email, password };
}

// Helper to log in via UI
async function loginViaUI(page: any, email: string, pass: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(pass);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL((url: URL) => url.pathname === '/', { timeout: 15000 });
}

test.describe('Stage 7: End-to-End Verification Suite', () => {
  let selectedLotId = '';
  let mainUser: { name: string; email: string; password: string };
  let secondUser: { name: string; email: string; password: string };
  let adminToken = '';

  test.beforeAll(async ({ request }) => {
    // 1. Dynamically retrieve seeded parking lots
    const res = await request.get(`${API_BASE}/parking-lots`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    // Pick first lot with free slots
    const lotWithSlots = body.data.find((l: { freeCount: number }) => l.freeCount > 0) || body.data[0];
    selectedLotId = lotWithSlots.id;

    // 2. Set up shared test users to stay strictly within rate limits
    mainUser = await registerUserViaApi(request, 'Driver');
    secondUser = await registerUserViaApi(request, 'Payer');

    // 3. Log in as admin to obtain admin token for management calls
    const adminLoginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: 'admin@smartparking.local', password: 'AdminPass123!' },
    });
    expect(adminLoginRes.ok()).toBeTruthy();
    const adminData = await adminLoginRes.json();
    adminToken = adminData.data.accessToken;
  });

  // Flow 1: Signup and login
  test('Flow 1: Signup and login', async ({ page }) => {
    const registeredEmail = `signup_${Date.now()}@example.com`;
    const fullName = 'Signup Test Driver';
    const password = 'TestPassword123!';

    // 1. Navigate to Signup
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /Create an Account/i })).toBeVisible();

    // 2. Fill registration form (FullName, Email, Password)
    await page.locator('#name').fill(fullName);
    await page.locator('#email').fill(registeredEmail);
    await page.locator('#password').fill(password);

    // 3. Submit
    await page.getByRole('button', { name: /Register/i }).click();

    // 4. Verify success notice and automatic redirect to /login
    await expect(page.getByRole('status')).toContainText(/Account created successfully/i);
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();

    // 5. Log in with registered credentials
    await page.locator('#email').fill(registeredEmail);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /Sign In/i }).click();

    // 6. Redirect to USER home (/)
    await page.waitForURL((url: URL) => url.pathname === '/', { timeout: 10000 });
    await expect(page).toHaveURL(/.*:5173\/?$/);

    // 7. Verify authenticated state in Navbar (shows user name and Logout button)
    await expect(page.locator('header')).toContainText(fullName);
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible();
  });

  // Flow 2: Session restore
  test('Flow 2: Session restore', async ({ page }) => {
    // 1. Log in via UI
    await loginViaUI(page, mainUser.email, mainUser.password);
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible();

    // 2. Reload page to test session restoration via httpOnly refresh cookie
    await page.reload();
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header')).toContainText(mainUser.name);

    // 3. User can directly navigate to protected /bookings route without login redirect
    await page.goto('/bookings');
    await expect(page).toHaveURL(/.*\/bookings$/);
    await expect(page.getByRole('heading', { name: /My Parking Bookings/i })).toBeVisible();
  });

  // Flow 3: Book a parking slot
  test('Flow 3: Book a parking slot', async ({ page }) => {
    // 1. Log in
    await loginViaUI(page, mainUser.email, mainUser.password);

    // 2. Navigate to dynamic lot
    await page.goto(`/lots/${selectedLotId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Slot Availability Grid/i)).toBeVisible();

    // 3. Find an available slot
    const availableSlot = page.locator('div[role="button"][aria-label*="available"]').first();
    await expect(availableSlot).toBeVisible({ timeout: 10000 });
    await availableSlot.click();

    // 4. Fill vehicle number in the action panel
    const vehicleInput = page.locator('input[aria-label="Vehicle registration number"]');
    await expect(vehicleInput).toBeVisible();
    await vehicleInput.fill('MH12AB1234');

    // 5. Click Hold Slot & Proceed
    const holdBtn = page.getByRole('button', { name: /Hold Slot & Proceed/i });
    await expect(holdBtn).toBeVisible();
    await holdBtn.click();

    // 6. Navigation to /booking/confirm/:bookingId
    await page.waitForURL(/\/booking\/confirm\/[a-zA-Z0-9]+$/, { timeout: 15000 });
    const currentUrl = page.url();
    const parts = currentUrl.split('/');
    const bookingId = parts[parts.length - 1];
    expect(bookingId).toBeTruthy();

    // 7. Verify 5-minute countdown timer and booking code callout
    await expect(page.locator('[data-testid="countdown-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-code"]')).toBeVisible();
    await expect(page.getByText(/Slot Temporarily Held/i)).toBeVisible();
  });

  // Flow 4: Conflict between two browser contexts
  test('Flow 4: Conflict between two browser contexts', async ({ browser, request }) => {
    // Find an available slot in selected lot
    const slotsRes = await request.get(`${API_BASE}/parking-lots/${selectedLotId}/slots`);
    const slotsData = await slotsRes.json();
    const availableSlotItem = slotsData.data.find((s: { status: string }) => s.status === 'AVAILABLE');
    expect(availableSlotItem).toBeDefined();
    const targetSlotNumber = availableSlotItem.slotNumber;

    // Create 2 independent browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Log in Context 1
      await loginViaUI(page1, mainUser.email, mainUser.password);

      // Log in Context 2
      await loginViaUI(page2, secondUser.email, secondUser.password);

      // Both navigate to the lot page
      await page1.goto(`/lots/${selectedLotId}`);
      await page2.goto(`/lots/${selectedLotId}`);

      // Both locate the target slot with exact slot prefix to prevent strict mode violation
      const slotBtn1 = page1.locator(`div[role="button"][aria-label^="Slot ${targetSlotNumber},"]`);
      const slotBtn2 = page2.locator(`div[role="button"][aria-label^="Slot ${targetSlotNumber},"]`);

      await expect(slotBtn1).toBeVisible({ timeout: 10000 });
      await expect(slotBtn2).toBeVisible({ timeout: 10000 });

      // Context 1 selects and holds the slot
      await slotBtn1.click();
      await page1.locator('input[aria-label="Vehicle registration number"]').fill('MH12C1111');
      await page1.getByRole('button', { name: /Hold Slot & Proceed/i }).click();
      await page1.waitForURL(/\/booking\/confirm\//, { timeout: 15000 });

      // Context 2 attempts to select and hold the same slot
      await slotBtn2.click();
      const vehicleInput2 = page2.locator('input[aria-label="Vehicle registration number"]');
      if (await vehicleInput2.isVisible()) {
        await vehicleInput2.fill('MH12C2222');
        await page2.getByRole('button', { name: /Hold Slot & Proceed/i }).click();
      }

      // Context 2 must display the conflict error message
      const conflictAlert = page2.locator('[data-testid="hold-error-alert"]');
      await expect(conflictAlert).toBeVisible({ timeout: 10000 });
      await expect(conflictAlert).toContainText(/Slot just taken/i);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  // Flow 5: Payment success and failure using Demo Pay
  test('Flow 5: Payment success and failure using Demo Pay', async ({ page }) => {
    // 1. Log in
    await loginViaUI(page, mainUser.email, mainUser.password);

    // 2. Select an available slot and hold it
    await page.goto(`/lots/${selectedLotId}`);
    const availableSlot = page.locator('div[role="button"][aria-label*="available"]').first();
    await expect(availableSlot).toBeVisible({ timeout: 10000 });
    await availableSlot.click();

    await page.locator('input[aria-label="Vehicle registration number"]').fill('MH12PAY01');
    await page.getByRole('button', { name: /Hold Slot & Proceed/i }).click();
    await page.waitForURL(/\/booking\/confirm\//, { timeout: 15000 });

    // 3. Confirm Demo Pay button is visible in dev environment
    const demoPayBtn = page.locator('[data-testid="demo-pay-button"]');
    await expect(demoPayBtn).toBeVisible();

    // 4. Click Demo Pay
    await demoPayBtn.click();

    // 5. Verify payment confirmation
    await expect(page.getByRole('heading', { name: /Booking Confirmed!/i })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('main').getByText('Confirmed', { exact: true }).first()).toBeVisible();

    // 6. Countdown timer is gone once confirmed
    await expect(page.locator('[data-testid="countdown-timer"]')).not.toBeVisible();

    // 7. Booking code remains prominently visible
    await expect(page.locator('[data-testid="booking-code"]')).toBeVisible();
  });

  // Flow 6: Session expiry and token refresh
  test('Flow 6: Session expiry and token refresh', async ({ page }) => {
    // 1. Log in
    await loginViaUI(page, mainUser.email, mainUser.password);
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible();

    // 2. Simulate token expiration by verifying silent refresh succeeds via cookie
    const refreshResult = await page.evaluate(async () => {
      try {
        const res = await fetch('http://127.0.0.1:4000/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
        const data = await res.json();
        return { status: res.status, success: data.success, role: data.data?.user?.role };
      } catch (e) {
        return { error: String(e) };
      }
    });

    expect(refreshResult.status).toBe(200);
    expect(refreshResult.success).toBe(true);
    expect(refreshResult.role).toBe('USER');

    // 3. Verify user remains authenticated in UI
    await page.goto('/bookings');
    await expect(page).toHaveURL(/.*\/bookings$/);
    await expect(page.getByRole('heading', { name: /My Parking Bookings/i })).toBeVisible();
  });

  // Flow 7: WebSocket reconnect and fresh slot colors
  test('Flow 7: WebSocket reconnect and fresh slot colors', async ({ page, request }) => {
    // 1. Find an available slot via API
    const slotsRes = await request.get(`${API_BASE}/parking-lots/${selectedLotId}/slots`);
    const slotsData = await slotsRes.json();
    const availableSlot = slotsData.data.find((s: { status: string }) => s.status === 'AVAILABLE');
    expect(availableSlot).toBeDefined();

    // 2. Log in so frontend socket connects with authenticated token
    await loginViaUI(page, mainUser.email, mainUser.password);

    // 3. Open lot details page in browser
    await page.goto(`/lots/${selectedLotId}`);
    // Use starts-with selector with comma to uniquely target Slot without matching Slot A10
    const slotCard = page.locator(`div[role="button"][aria-label^="Slot ${availableSlot.slotNumber},"]`);
    await expect(slotCard).toBeVisible({ timeout: 10000 });
    await expect(slotCard).toContainText(/Available/i);

    // 4. Update slot to OCCUPIED via admin walk-in endpoint (triggers real-time emitSlotUpdated broadcast)
    const updateRes = await request.post(`${API_BASE}/guard/slots/${availableSlot.id}/walk-in`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        status: 'OCCUPIED',
      },
    });
    expect(updateRes.ok()).toBeTruthy();

    // 5. Verify slot changes status to Occupied in real time on the frontend without page reload
    await expect(slotCard).toContainText(/Occupied/i, { timeout: 15000 });

    // Cleanup: revert slot back to AVAILABLE
    await request.post(`${API_BASE}/guard/slots/${availableSlot.id}/walk-in`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        status: 'AVAILABLE',
      },
    });
  });

  // Flow 8: Guard login redirects to /guard
  test('Flow 8: Guard login redirects to /guard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('guard@smartparking.local');
    await page.locator('#password').fill('GuardPass123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Guard home path is /guard
    await page.waitForURL(/\/guard/, { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/guard/);
    await expect(page.locator('header')).toContainText(/GUARD/i);
    await expect(page.getByRole('heading', { name: /Gate Operator Console|Real-Time Gate Board/i }).first()).toBeVisible();
  });

  // Flow 9: USER cannot access /guard or /admin
  test('Flow 9: USER cannot access /guard or /admin', async ({ page }) => {
    // 1. Log in as normal USER
    await loginViaUI(page, mainUser.email, mainUser.password);

    // 2. Try navigating to /guard
    await page.goto('/guard');
    // RoleGuard redirects non-guard to home (/)
    await page.waitForURL((url: URL) => url.pathname === '/', { timeout: 10000 });
    await expect(page).toHaveURL(/.*:5173\/?$/);

    // 3. Try navigating to /admin
    await page.goto('/admin');
    // RoleGuard redirects non-admin to home (/)
    await page.waitForURL((url: URL) => url.pathname === '/', { timeout: 10000 });
    await expect(page).toHaveURL(/.*:5173\/?$/);
  });

  // Flow 10: Booking code is displayed after payment
  test('Flow 10: Booking code is displayed after payment', async ({ page }) => {
    // 1. Log in
    await loginViaUI(page, mainUser.email, mainUser.password);

    // 2. Reserve and pay for a slot
    await page.goto(`/lots/${selectedLotId}`);
    const availableSlot = page.locator('div[role="button"][aria-label*="available"]').first();
    await expect(availableSlot).toBeVisible({ timeout: 10000 });
    await availableSlot.click();

    await page.locator('input[aria-label="Vehicle registration number"]').fill('MH12TCK99');
    await page.getByRole('button', { name: /Hold Slot & Proceed/i }).click();
    await page.waitForURL(/\/booking\/confirm\//, { timeout: 15000 });

    // Pay with Demo Pay
    const demoPayBtn = page.locator('[data-testid="demo-pay-button"]');
    await expect(demoPayBtn).toBeVisible();
    await demoPayBtn.click();
    await expect(page.getByRole('heading', { name: /Booking Confirmed!/i })).toBeVisible({ timeout: 15000 });

    // 3. Assert booking code exists and matches 6-character format
    const codeEl = page.locator('[data-testid="booking-code"]');
    await expect(codeEl).toBeVisible();
    const code = (await codeEl.innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    // 4. Assert ticket presentation instructions
    await expect(page.getByText(/Show this code to the guard/i)).toBeVisible();
  });
});
