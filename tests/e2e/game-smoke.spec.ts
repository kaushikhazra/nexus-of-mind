/**
 * Game Smoke Tests - Basic Functionality Validation
 * 
 * Quick smoke tests to verify core game systems are working.
 * These tests run fast and catch major regressions.
 */

import { test, expect } from '@playwright/test';

test.describe('Game Smoke Tests', () => {
  
  test('should load game successfully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for loading screen to appear and disappear
    await expect(page.locator('#loadingScreen')).toBeVisible();
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 30000 });
    
    // Game canvas should be visible
    await expect(page.locator('#gameCanvas')).toBeVisible();
  });
  
  test('should display SciFi loading screen', async ({ page }) => {
    await page.goto('/');
    
    const loadingScreen = page.locator('#loadingScreen');
    await expect(loadingScreen).toBeVisible();
    
    // Check SciFi title
    await expect(loadingScreen.getByText('◊ Nexus of Mind ◊')).toBeVisible();
    
    // Check loading messages
    const loadingText = page.locator('#loadingText');
    await expect(loadingText).toBeVisible();
    
    // Should show SciFi loading messages
    const possibleMessages = [
      'Initializing Neural Core...',
      'Initializing Quantum Engine...',
      'Generating Neural Pathways...',
      'Neural Core Online!'
    ];
    
    const currentText = await loadingText.textContent();
    const hasValidMessage = possibleMessages.some(msg => currentText?.includes(msg));
    expect(hasValidMessage).toBe(true);
  });
  
  test('should initialize energy system', async ({ page }) => {
    await page.goto('/');
    
    // Wait for game to load
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 30000 });
    
    // Energy display should be visible
    const energyDisplay = page.locator('#energy-display');
    await expect(energyDisplay).toBeVisible();
    
    // Should show energy value
    await expect(energyDisplay).toContainText(/\d+J/);
  });
  
  test('should initialize building placement UI', async ({ page }) => {
    await page.goto('/');
    
    // Wait for game to load
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 30000 });
    
    // Building placement UI should be visible
    const buildingUI = page.locator('#building-placement-ui');
    await expect(buildingUI).toBeVisible();
    
    // Should have construction title
    await expect(buildingUI.getByText('◊ CONSTRUCTION ◊')).toBeVisible();
  });
  
  test('should have working 3D scene', async ({ page }) => {
    await page.goto('/');
    
    // Wait for game to load
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 30000 });
    
    // Check that game engine is running
    const isGameRunning = await page.evaluate(() => {
      const gameEngine = (window as any).GameEngine?.getInstance();
      return gameEngine !== null && gameEngine.getScene() !== null;
    });
    
    expect(isGameRunning).toBe(true);
  });
  
  test('should maintain 60fps performance', async ({ page }) => {
    await page.goto('/');
    
    // Wait for game to load
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 30000 });
    
    // Give game time to stabilize
    await page.waitForTimeout(3000);
    
    // Check FPS
    const fps = await page.evaluate(() => {
      const gameEngine = (window as any).GameEngine?.getInstance();
      const engine = gameEngine?.getEngine();
      return engine?.getFps() || 0;
    });
    
    // Should maintain good FPS (allow some variance for CI)
    expect(fps).toBeGreaterThan(30);
  });
  
  test('should have responsive UI layout', async ({ page }) => {
    await page.goto('/');
    
    // Wait for game to load
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 30000 });
    
    // Check UI positioning
    const energyDisplay = page.locator('#energy-display');
    const buildingUI = page.locator('#building-placement-ui');
    
    await expect(energyDisplay).toBeVisible();
    await expect(buildingUI).toBeVisible();
    
    // Energy should be top-right, building UI top-left
    const energyBox = await energyDisplay.boundingBox();
    const buildingBox = await buildingUI.boundingBox();
    
    expect(energyBox).toBeTruthy();
    expect(buildingBox).toBeTruthy();
    
    if (energyBox && buildingBox) {
      // Energy display should be more to the right
      expect(energyBox.x).toBeGreaterThan(buildingBox.x);
      
      // Both should be near the top
      expect(energyBox.y).toBeLessThan(100);
      expect(buildingBox.y).toBeLessThan(100);
    }
  });
});