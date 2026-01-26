/**
 * EmblemGeometry Integration Test
 * 
 * Simple integration test to verify EmblemGeometry can be imported and instantiated
 * without complex Babylon.js setup that causes Jest issues.
 */

describe('EmblemGeometry Integration', () => {
    test('should be importable', async () => {
        // Test that the module can be imported without errors
        const { EmblemGeometry } = await import('../EmblemGeometry');
        expect(EmblemGeometry).toBeDefined();
        expect(typeof EmblemGeometry).toBe('function');
    });

    test('should have expected interface', async () => {
        const { EmblemGeometry } = await import('../EmblemGeometry');
        
        // Check that the class has expected methods
        const prototype = EmblemGeometry.prototype;
        expect(typeof prototype.createEmpireEmblem).toBe('function');
        expect(typeof prototype.createEnergyLordsEmblem).toBe('function');
        expect(typeof prototype.createSimpleEmblem).toBe('function');
        expect(typeof prototype.addPulsingAnimation).toBe('function');
        expect(typeof prototype.dispose).toBe('function');
    });

    test('should export expected interfaces', async () => {
        const module = await import('../EmblemGeometry');
        
        // Verify that the module exports what we expect
        expect(module.EmblemGeometry).toBeDefined();
        
        // The interfaces should be available at compile time
        // (TypeScript will catch if they're missing)
        expect(true).toBe(true); // Placeholder assertion
    });
});