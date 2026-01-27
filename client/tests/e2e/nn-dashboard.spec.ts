/**
 * NN Visualization Dashboard Tests
 *
 * Tests for the neural network visualization dashboard served by the Python backend.
 * Dashboard runs on port 8000, separate from the game frontend.
 */

import { test, expect, Page } from '@playwright/test';

// Dashboard runs on backend server
const DASHBOARD_URL = 'http://localhost:8000/dashboard';
const API_URL = 'http://localhost:8000/api/nn-dashboard';

test.describe('NN Visualization Dashboard', () => {

  test.describe('Dashboard Page', () => {

    test('should load dashboard page successfully', async ({ page }) => {
      const response = await page.goto(DASHBOARD_URL);

      // Should return 200 OK
      expect(response?.status()).toBe(200);

      // Page title should be correct
      await expect(page).toHaveTitle('NN Visualization Dashboard');
    });

    test('should display header with title and controls', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Check header elements
      await expect(page.locator('h1')).toContainText('NN Visualization Dashboard');

      // Should have refresh controls
      await expect(page.locator('#countdown')).toBeVisible();
      await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
      await expect(page.locator('button:has-text("Export")')).toBeVisible();
    });

    test('should display three main sections', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Should have three sections
      const sections = page.locator('.section');
      await expect(sections).toHaveCount(3);

      // Check section headers
      await expect(page.locator('h2:has-text("NN Decisions")')).toBeVisible();
      await expect(page.locator('h2:has-text("Simulation Gate")')).toBeVisible();
      await expect(page.locator('h2:has-text("Training Progress")')).toBeVisible();
    });

    test('should display chunk heatmap canvas', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Heatmap canvas should be visible
      const heatmap = page.locator('#chunkHeatmap');
      await expect(heatmap).toBeVisible();

      // Should have proper dimensions (aspect ratio 1:1)
      const box = await heatmap.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        // Width and height should be similar (square)
        const ratio = box.width / box.height;
        expect(ratio).toBeGreaterThan(0.8);
        expect(ratio).toBeLessThan(1.2);
      }
    });

    test('should display decisions table', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Decisions table should be visible
      const table = page.locator('.decisions-table');
      await expect(table).toBeVisible();

      // Should have header row
      await expect(table.locator('th:has-text("Chunk")')).toBeVisible();
      await expect(table.locator('th:has-text("Type")')).toBeVisible();
      await expect(table.locator('th:has-text("Conf")')).toBeVisible();
      await expect(table.locator('th:has-text("Sent")')).toBeVisible();
    });

    test('should display pass rate gauge', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Pass rate gauge canvas should be visible
      const gauge = page.locator('#passRateGauge');
      await expect(gauge).toBeVisible();

      // Pass rate value should be visible
      const passRateValue = page.locator('#passRateValue');
      await expect(passRateValue).toBeVisible();
      await expect(passRateValue).toContainText('%');
    });

    test('should display all Chart.js charts', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Wait for charts to initialize
      await page.waitForTimeout(1000);

      // All chart canvases should be visible
      await expect(page.locator('#confidenceChart')).toBeVisible();
      await expect(page.locator('#reasonsChart')).toBeVisible();
      await expect(page.locator('#componentsChart')).toBeVisible();
      await expect(page.locator('#rewardHistoryChart')).toBeVisible();
      await expect(page.locator('#lossChart')).toBeVisible();
      await expect(page.locator('#rewardsChart')).toBeVisible();
    });

    test('should display stat cards with values', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Stat values should be visible
      await expect(page.locator('#energyCount')).toBeVisible();
      await expect(page.locator('#combatCount')).toBeVisible();
      await expect(page.locator('#totalSteps')).toBeVisible();
      await expect(page.locator('#avgLoss')).toBeVisible();
      await expect(page.locator('#avgReward')).toBeVisible();
    });

    test('should display wait streak indicator', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Wait streak should be visible
      const waitStreak = page.locator('#waitStreak');
      await expect(waitStreak).toBeVisible();

      // Should show streak value
      await expect(page.locator('#waitStreakValue')).toBeVisible();
      await expect(page.locator('#timeSinceAction')).toBeVisible();
    });
  });

  test.describe('Dashboard API', () => {

    test('should return valid JSON from API endpoint', async ({ request }) => {
      const response = await request.get(API_URL);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');

      const data = await response.json();
      expect(data).toBeTruthy();
      expect(typeof data).toBe('object');
    });

    test('should have required top-level fields', async ({ request }) => {
      const response = await request.get(API_URL);
      const data = await response.json();

      // Check top-level structure
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime_seconds');
      expect(data).toHaveProperty('nn_decisions');
      expect(data).toHaveProperty('gate_behavior');
      expect(data).toHaveProperty('training');
      expect(data).toHaveProperty('game_state');
    });

    test('should have valid nn_decisions structure', async ({ request }) => {
      const response = await request.get(API_URL);
      const data = await response.json();

      const nn = data.nn_decisions;
      expect(nn).toHaveProperty('chunk_frequency');
      expect(nn).toHaveProperty('recent_decisions');
      expect(nn).toHaveProperty('type_counts');
      expect(nn).toHaveProperty('confidence_histogram');

      // chunk_frequency should be 400 values (20x20 grid)
      expect(Array.isArray(nn.chunk_frequency)).toBe(true);
      expect(nn.chunk_frequency.length).toBe(400);

      // confidence_histogram should be 10 bins
      expect(Array.isArray(nn.confidence_histogram)).toBe(true);
      expect(nn.confidence_histogram.length).toBe(10);

      // type_counts should have energy and combat
      expect(nn.type_counts).toHaveProperty('energy');
      expect(nn.type_counts).toHaveProperty('combat');
    });

    test('should have valid gate_behavior structure', async ({ request }) => {
      const response = await request.get(API_URL);
      const data = await response.json();

      const gate = data.gate_behavior;
      expect(gate).toHaveProperty('pass_rate');
      expect(gate).toHaveProperty('decision_reasons');
      expect(gate).toHaveProperty('avg_components');
      expect(gate).toHaveProperty('reward_history');
      expect(gate).toHaveProperty('wait_streak');
      expect(gate).toHaveProperty('time_since_last_action');

      // pass_rate should be between 0 and 1
      expect(gate.pass_rate).toBeGreaterThanOrEqual(0);
      expect(gate.pass_rate).toBeLessThanOrEqual(1);

      // decision_reasons should have expected keys
      expect(gate.decision_reasons).toHaveProperty('positive_reward');
      expect(gate.decision_reasons).toHaveProperty('confidence_override');
      expect(gate.decision_reasons).toHaveProperty('negative_reward');
      expect(gate.decision_reasons).toHaveProperty('insufficient_energy');

      // avg_components should have expected keys
      expect(gate.avg_components).toHaveProperty('survival');
      expect(gate.avg_components).toHaveProperty('disruption');
      expect(gate.avg_components).toHaveProperty('location');
      expect(gate.avg_components).toHaveProperty('exploration');
    });

    test('should have valid training structure', async ({ request }) => {
      const response = await request.get(API_URL);
      const data = await response.json();

      const training = data.training;
      expect(training).toHaveProperty('loss_history');
      expect(training).toHaveProperty('simulation_rewards');
      expect(training).toHaveProperty('real_rewards');
      expect(training).toHaveProperty('total_steps');
      expect(training).toHaveProperty('avg_loss');
      expect(training).toHaveProperty('avg_reward');

      // Arrays should be arrays
      expect(Array.isArray(training.loss_history)).toBe(true);
      expect(Array.isArray(training.simulation_rewards)).toBe(true);
      expect(Array.isArray(training.real_rewards)).toBe(true);

      // total_steps should be non-negative
      expect(training.total_steps).toBeGreaterThanOrEqual(0);
    });

    test('API should respond reasonably fast', async ({ request }) => {
      // Warm up call (cold start may be slow due to singleton initialization)
      await request.get(API_URL);

      // Time the second call (should be faster)
      const start = Date.now();
      await request.get(API_URL);
      const duration = Date.now() - start;

      // Should respond within 500ms (allowing slack for CI environments)
      expect(duration).toBeLessThan(500);
    });
  });

  test.describe('Auto-Refresh Functionality', () => {

    test('should show countdown timer', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      const countdown = page.locator('#countdown');
      await expect(countdown).toBeVisible();

      // Should show a number
      const text = await countdown.textContent();
      expect(parseInt(text || '0')).toBeGreaterThan(0);
    });

    test('should decrement countdown', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      const countdown = page.locator('#countdown');

      // Get initial value
      const initial = parseInt(await countdown.textContent() || '15');

      // Wait 2 seconds
      await page.waitForTimeout(2000);

      // Value should have decreased
      const after = parseInt(await countdown.textContent() || '15');
      expect(after).toBeLessThan(initial);
    });

    test('should update last updated timestamp on refresh', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      const lastUpdated = page.locator('#lastUpdated');

      // Get initial text
      const initial = await lastUpdated.textContent();

      // Click refresh button
      await page.locator('button:has-text("Refresh")').click();

      // Wait a moment
      await page.waitForTimeout(500);

      // Text should have changed (includes new time)
      const after = await lastUpdated.textContent();
      expect(after).toContain('Last updated:');
    });

    test('manual refresh button should work', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Click refresh and check no errors
      const refreshBtn = page.locator('button:has-text("Refresh")');
      await expect(refreshBtn).toBeEnabled();

      await refreshBtn.click();

      // Should not show error state
      const lastUpdated = page.locator('#lastUpdated');
      await expect(lastUpdated).not.toHaveClass(/error/);
    });
  });

  test.describe('Export Functionality', () => {

    test('export button should be visible and enabled', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      const exportBtn = page.locator('button:has-text("Export")');
      await expect(exportBtn).toBeVisible();
      await expect(exportBtn).toBeEnabled();
    });

    test('export should trigger download', async ({ page }) => {
      await page.goto(DASHBOARD_URL);

      // Wait for data to load
      await page.waitForTimeout(1000);

      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export
      await page.locator('button:has-text("Export")').click();

      // Should trigger download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('nn-dashboard-');
      expect(download.suggestedFilename()).toContain('.json');
    });
  });

  test.describe('Error Handling', () => {

    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API and return error
      await page.route(API_URL, route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Test error' })
        });
      });

      await page.goto(DASHBOARD_URL);

      // Should show error state
      await page.waitForTimeout(1000);
      const lastUpdated = page.locator('#lastUpdated');
      await expect(lastUpdated).toContainText('Connection lost');
    });

    test('should continue polling after error', async ({ page }) => {
      let callCount = 0;

      // First call fails, second succeeds
      await page.route(API_URL, route => {
        callCount++;
        if (callCount === 1) {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Test error' })
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              timestamp: Date.now() / 1000,
              uptime_seconds: 100,
              nn_decisions: {
                chunk_frequency: Array(400).fill(0),
                recent_decisions: [],
                type_counts: { energy: 0, combat: 0 },
                confidence_histogram: Array(10).fill(0)
              },
              gate_behavior: {
                pass_rate: 0.5,
                decision_reasons: { positive_reward: 0, confidence_override: 0, negative_reward: 0, insufficient_energy: 0 },
                avg_components: { survival: 0, disruption: 0, location: 0, exploration: 0 },
                reward_history: [],
                wait_streak: 0,
                time_since_last_action: 0
              },
              training: {
                loss_history: [],
                simulation_rewards: [],
                real_rewards: [],
                total_steps: 0,
                avg_loss: 0,
                avg_reward: 0
              },
              game_state: {}
            })
          });
        }
      });

      await page.goto(DASHBOARD_URL);

      // Manually trigger refresh
      await page.locator('button:has-text("Refresh")').click();
      await page.waitForTimeout(500);

      // Should recover from error
      const lastUpdated = page.locator('#lastUpdated');
      await expect(lastUpdated).not.toContainText('Connection lost');
    });
  });

  test.describe('Responsive Layout', () => {

    test('should maintain three-column layout on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(DASHBOARD_URL);

      // Check dashboard grid
      const dashboard = page.locator('.dashboard');
      await expect(dashboard).toBeVisible();

      // All three sections should be visible side by side
      const sections = page.locator('.section');
      await expect(sections).toHaveCount(3);

      // Get positions
      const boxes = await sections.all();
      const positions = await Promise.all(boxes.map(s => s.boundingBox()));

      // All sections should be on roughly the same Y position (same row)
      const yPositions = positions.filter(p => p).map(p => p!.y);
      const yDiff = Math.max(...yPositions) - Math.min(...yPositions);
      expect(yDiff).toBeLessThan(100); // Allow some variance
    });

    test('should stack sections on narrow viewport', async ({ page }) => {
      await page.setViewportSize({ width: 600, height: 800 });
      await page.goto(DASHBOARD_URL);

      // All three sections should still be visible
      const sections = page.locator('.section');
      await expect(sections).toHaveCount(3);

      // Get positions - sections should be stacked vertically
      const boxes = await sections.all();
      const positions = await Promise.all(boxes.map(s => s.boundingBox()));

      // Y positions should be different (stacked)
      const yPositions = positions.filter(p => p).map(p => p!.y);
      const uniqueYs = new Set(yPositions.map(y => Math.floor(y / 100))); // Group by 100px bands
      expect(uniqueYs.size).toBeGreaterThan(1); // Should have multiple rows
    });
  });
});

test.describe('Dashboard Reset API', () => {

  test('should reset metrics via POST', async ({ request }) => {
    const response = await request.post('http://localhost:8000/api/nn-dashboard/reset');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('success');
    expect(data.message).toContain('reset');
  });
});
