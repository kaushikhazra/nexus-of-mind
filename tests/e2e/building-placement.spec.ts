/**
 * Building Placement UI Tests - US-006 Validation
 * 
 * Comprehensive end-to-end tests for interactive building placement system.
 * Tests cover UI functionality, 3D interaction, energy validation, and user experience.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const GAME_LOAD_TIMEOUT = 30000; // 30 seconds for game to fully load
const UI_INTERACTION_TIMEOUT = 5000; // 5 seconds for UI interactions

/**
 * Helper function to wait for game to fully load
 */
async function waitForGameLoad(page: Page) {
  // Wait for loading screen to disappear
  await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: GAME_LOAD_TIMEOUT });
  
  // Wait for game canvas to be visible
  await expect(page.locator('#gameCanvas')).toBeVisible();
  
  // Wait for energy display to appear (indicates game systems are loaded)
  await expect(page.locator('#energy-display')).toBeVisible();
  
  // Wait for building placement UI to appear
  await expect(page.locator('#building-placement-ui')).toBeVisible();
  
  // Give additional time for 3D scene to stabilize
  await page.waitForTimeout(2000);
}

/**
 * Helper function to get current energy value
 */
async function getCurrentEnergy(page: Page): Promise<number> {
  const energyText = await page.locator('#energy-display').textContent();
  const match = energyText?.match(/(\d+)J/);
  return match ? parseInt(match[1]) : 0;
}

test.describe('Building Placement UI - US-006', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to game and wait for full load
    await page.goto('/');
    await waitForGameLoad(page);
  });

  test.describe('Phase 1: Building Selection UI', () => {
    
    test('should display building placement panel', async ({ page }) => {
      // Verify building placement UI is visible
      const buildingUI = page.locator('#building-placement-ui');
      await expect(buildingUI).toBeVisible();
      
      // Check panel has correct styling (SciFi theme)
      const panel = buildingUI.locator('.building-panel');
      await expect(panel).toBeVisible();
      await expect(panel).toHaveCSS('font-family', /Orbitron/);
    });
    
    test('should display construction title', async ({ page }) => {
      const title = page.locator('#building-placement-ui').getByText('◊ CONSTRUCTION ◊');
      await expect(title).toBeVisible();
      await expect(title).toHaveCSS('color', 'rgb(0, 255, 255)'); // Cyan color
    });
    
    test('should display build base button with correct cost', async ({ page }) => {
      const baseButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD BASE/ });
      await expect(baseButton).toBeVisible();
      await expect(baseButton).toContainText('50J');
      await expect(baseButton).toHaveCSS('color', 'rgb(255, 255, 0)'); // Yellow color
    });
    
    test('should display build power plant button with correct cost', async ({ page }) => {
      const powerPlantButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD POWER PLANT/ });
      await expect(powerPlantButton).toBeVisible();
      await expect(powerPlantButton).toContainText('75J');
      await expect(powerPlantButton).toHaveCSS('color', 'rgb(255, 136, 0)'); // Orange color
    });
    
    test('should show initial status message', async ({ page }) => {
      const statusText = page.locator('#building-placement-ui').locator('div').filter({ hasText: 'Select a building to construct' });
      await expect(statusText).toBeVisible();
    });
    
    test('should have hover effects on building buttons', async ({ page }) => {
      const baseButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD BASE/ });
      
      // Hover over button
      await baseButton.hover();
      
      // Check for hover effect (background change)
      await expect(baseButton).toHaveCSS('background-color', 'rgba(0, 40, 80, 0.6)');
    });
  });

  test.describe('Phase 1: Energy Integration', () => {
    
    test('should display current energy in energy HUD', async ({ page }) => {
      const energyDisplay = page.locator('#energy-display');
      await expect(energyDisplay).toBeVisible();
      
      // Should show initial energy (typically 100J)
      await expect(energyDisplay).toContainText(/\d+J/);
    });
    
    test('should prevent building placement with insufficient energy', async ({ page }) => {
      // First, we need to drain energy below building costs
      // This test assumes we can manipulate energy through console
      await page.evaluate(() => {
        const gameEngine = (window as any).GameEngine?.getInstance();
        const energyManager = gameEngine?.getEnergyManager();
        if (energyManager) {
          // Drain energy to below 50J
          energyManager.consumeEnergy('test', 60, 'test_drain');
        }
      });
      
      // Wait for energy display to update
      await page.waitForTimeout(500);
      
      // Try to build base (requires 50J)
      const baseButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD BASE/ });
      await baseButton.click();
      
      // Should show insufficient energy message
      const statusText = page.locator('#building-placement-ui').locator('div').filter({ hasText: /Insufficient energy/ });
      await expect(statusText).toBeVisible({ timeout: UI_INTERACTION_TIMEOUT });
    });
  });

  test.describe('Phase 1: UI State Management', () => {
    
    test('should enter placement mode when build base is clicked', async ({ page }) => {
      const baseButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD BASE/ });
      await baseButton.click();
      
      // Building buttons should be hidden
      await expect(baseButton).toBeHidden({ timeout: UI_INTERACTION_TIMEOUT });
      
      // Cancel button should appear
      const cancelButton = page.locator('#building-placement-ui').getByRole('button', { name: /CANCEL PLACEMENT/ });
      await expect(cancelButton).toBeVisible({ timeout: UI_INTERACTION_TIMEOUT });
      
      // Status should change
      const statusText = page.locator('#building-placement-ui').locator('div').filter({ hasText: /Move mouse to position/ });
      await expect(statusText).toBeVisible({ timeout: UI_INTERACTION_TIMEOUT });
    });
    
    test('should exit placement mode when cancel is clicked', async ({ page }) => {
      // Enter placement mode
      const baseButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD BASE/ });
      await baseButton.click();
      
      // Click cancel
      const cancelButton = page.locator('#building-placement-ui').getByRole('button', { name: /CANCEL PLACEMENT/ });
      await cancelButton.click();
      
      // Building buttons should reappear
      await expect(baseButton).toBeVisible({ timeout: UI_INTERACTION_TIMEOUT });
      
      // Cancel button should be hidden
      await expect(cancelButton).toBeHidden({ timeout: UI_INTERACTION_TIMEOUT });
      
      // Status should reset
      const statusText = page.locator('#building-placement-ui').locator('div').filter({ hasText: 'Select a building to construct' });
      await expect(statusText).toBeVisible({ timeout: UI_INTERACTION_TIMEOUT });
    });
    
    test('should handle power plant placement mode', async ({ page }) => {
      const powerPlantButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD POWER PLANT/ });
      await powerPlantButton.click();
      
      // Should enter placement mode
      await expect(powerPlantButton).toBeHidden({ timeout: UI_INTERACTION_TIMEOUT });
      
      const cancelButton = page.locator('#building-placement-ui').getByRole('button', { name: /CANCEL PLACEMENT/ });
      await expect(cancelButton).toBeVisible({ timeout: UI_INTERACTION_TIMEOUT });
    });
  });

  test.describe('Phase 1: Visual Design Validation', () => {
    
    test('should match SciFi design theme', async ({ page }) => {
      const buildingPanel = page.locator('#building-placement-ui .building-panel');
      
      // Check SciFi styling
      await expect(buildingPanel).toHaveCSS('font-family', /Orbitron/);
      await expect(buildingPanel).toHaveCSS('border-color', 'rgba(0, 255, 255, 0.4)');
      await expect(buildingPanel).toHaveCSS('backdrop-filter', 'blur(8px)');
    });
    
    test('should be positioned correctly', async ({ page }) => {
      const buildingUI = page.locator('#building-placement-ui');
      
      // Should be in top-left corner
      await expect(buildingUI).toHaveCSS('position', 'fixed');
      await expect(buildingUI).toHaveCSS('top', '20px');
      await expect(buildingUI).toHaveCSS('left', '20px');
      await expect(buildingUI).toHaveCSS('z-index', '1000');
    });
    
    test('should not obstruct energy HUD', async ({ page }) => {
      const buildingUI = page.locator('#building-placement-ui');
      const energyDisplay = page.locator('#energy-display');
      
      // Both should be visible simultaneously
      await expect(buildingUI).toBeVisible();
      await expect(energyDisplay).toBeVisible();
      
      // Get bounding boxes to ensure no overlap
      const buildingBox = await buildingUI.boundingBox();
      const energyBox = await energyDisplay.boundingBox();
      
      expect(buildingBox).toBeTruthy();
      expect(energyBox).toBeTruthy();
      
      // Building UI should be on left, energy on right
      if (buildingBox && energyBox) {
        expect(buildingBox.x + buildingBox.width).toBeLessThan(energyBox.x);
      }
    });
  });

  test.describe('Phase 1: Performance Validation', () => {
    
    test('should maintain 60fps during UI interactions', async ({ page }) => {
      // Start performance monitoring
      await page.evaluate(() => {
        (window as any).performanceStart = performance.now();
        (window as any).frameCount = 0;
        
        function countFrames() {
          (window as any).frameCount++;
          requestAnimationFrame(countFrames);
        }
        countFrames();
      });
      
      // Interact with UI for 2 seconds
      const baseButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD BASE/ });
      await baseButton.click();
      
      await page.waitForTimeout(2000);
      
      const cancelButton = page.locator('#building-placement-ui').getByRole('button', { name: /CANCEL PLACEMENT/ });
      await cancelButton.click();
      
      // Check frame rate
      const fps = await page.evaluate(() => {
        const elapsed = performance.now() - (window as any).performanceStart;
        return ((window as any).frameCount / elapsed) * 1000;
      });
      
      // Should maintain close to 60fps (allow some variance)
      expect(fps).toBeGreaterThan(50);
    });
    
    test('should load UI within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      
      // Navigate and wait for UI
      await page.goto('/');
      await waitForGameLoad(page);
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 30 seconds
      expect(loadTime).toBeLessThan(30000);
    });
  });

  test.describe('Phase 1: Cross-Browser Compatibility', () => {
    
    test('should work in different browsers', async ({ page, browserName }) => {
      // This test runs across all configured browsers
      const buildingUI = page.locator('#building-placement-ui');
      await expect(buildingUI).toBeVisible();
      
      const baseButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD BASE/ });
      await expect(baseButton).toBeVisible();
      
      // Test basic interaction
      await baseButton.click();
      const cancelButton = page.locator('#building-placement-ui').getByRole('button', { name: /CANCEL PLACEMENT/ });
      await expect(cancelButton).toBeVisible({ timeout: UI_INTERACTION_TIMEOUT });
      
      console.log(`✅ Building placement UI works in ${browserName}`);
    });
  });
});

test.describe('Game Integration Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameLoad(page);
  });
  
  test('should have all core game systems loaded', async ({ page }) => {
    // Check 3D canvas
    await expect(page.locator('#gameCanvas')).toBeVisible();
    
    // Check energy system
    await expect(page.locator('#energy-display')).toBeVisible();
    
    // Check building placement system
    await expect(page.locator('#building-placement-ui')).toBeVisible();
    
    // Verify game engine is running
    const isGameRunning = await page.evaluate(() => {
      const gameEngine = (window as any).GameEngine?.getInstance();
      return gameEngine !== null;
    });
    
    expect(isGameRunning).toBe(true);
  });
  
  test('should maintain game performance with UI interactions', async ({ page }) => {
    // Test that UI doesn't impact 3D rendering performance
    const initialFPS = await page.evaluate(() => {
      const gameEngine = (window as any).GameEngine?.getInstance();
      const engine = gameEngine?.getEngine();
      return engine?.getFps() || 0;
    });
    
    // Interact with building UI
    const baseButton = page.locator('#building-placement-ui').getByRole('button', { name: /BUILD BASE/ });
    await baseButton.click();
    
    await page.waitForTimeout(1000);
    
    const cancelButton = page.locator('#building-placement-ui').getByRole('button', { name: /CANCEL PLACEMENT/ });
    await cancelButton.click();
    
    // Check FPS is still good
    const finalFPS = await page.evaluate(() => {
      const gameEngine = (window as any).GameEngine?.getInstance();
      const engine = gameEngine?.getEngine();
      return engine?.getFps() || 0;
    });
    
    // FPS should remain stable (within 10% of initial)
    expect(finalFPS).toBeGreaterThan(initialFPS * 0.9);
  });
});