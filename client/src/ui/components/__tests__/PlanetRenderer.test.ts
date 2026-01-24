/**
 * PlanetRenderer Unit Tests
 * 
 * Tests the PlanetRenderer component for creating desert planets with UV texture mapping,
 * atmosphere glow effects, and cloud layers for the Introduction Screen.
 */

import { PlanetRenderer, PlanetConfig, OrbitingShip } from '../PlanetRenderer';

// Mock Babylon.js
jest.mock('@babylonjs/core', () => ({
    Scene: jest.fn(),
    AbstractMesh: jest.fn(),
    Mesh: jest.fn(),
    Vector3: jest.fn().mockImplementation((x, y, z) => ({ x, y, z })),
    Color3: jest.fn().mockImplementation((r, g, b) => ({ r, g, b })),
    Color4: jest.fn().mockImplementation((r, g, b, a) => ({ r, g, b, a })),
    Animation: jest.fn(),
    StandardMaterial: jest.fn(),
    Material: {
        MATERIAL_ALPHABLEND: 1
    },
    MeshBuilder: {
        CreateSphere: jest.fn().mockReturnValue({
            getBoundingInfo: () => ({
                boundingBox: {
                    extendSize: { x: 1, y: 1, z: 1 }
                }
            }),
            position: { clone: () => ({ x: 0, y: 0, z: 0 }) },
            material: null,
            parent: null,
            animations: []
        }),
        CreateBox: jest.fn().mockReturnValue({
            position: { x: 0, y: 0, z: 0 },
            material: null,
            parent: null,
            animations: []
        }),
        CreateCylinder: jest.fn().mockReturnValue({
            position: { x: 0, y: 0, z: 0 },
            material: null,
            parent: null,
            animations: []
        })
    },
    DynamicTexture: jest.fn().mockImplementation(() => ({
        getContext: () => ({
            putImageData: jest.fn()
        }),
        update: jest.fn(),
        wrapU: 0,
        wrapV: 0
    })),
    Texture: {
        WRAP_ADDRESSMODE: 1
    },
    Tools: {
        ToRadians: (degrees: number) => degrees * Math.PI / 180
    },
    SineEase: jest.fn(),
    EasingFunction: {
        EASINGMODE_EASEINOUT: 1
    }
}));

// Mock MaterialManager
const mockMaterialManager = {
    createCustomMaterial: jest.fn().mockReturnValue({
        dispose: jest.fn(),
        diffuseTexture: null,
        transparencyMode: 0,
        alpha: 1
    }),
    getColorPalette: jest.fn().mockReturnValue({
        terrain: {
            desert: { r: 0.8, g: 0.7, b: 0.4 }
        }
    })
};

// Mock Scene
const mockScene = {
    registerBeforeRender: jest.fn()
};

describe('PlanetRenderer', () => {
    let planetRenderer: PlanetRenderer;

    beforeEach(() => {
        jest.clearAllMocks();
        planetRenderer = new PlanetRenderer(mockScene as any, mockMaterialManager as any);
    });

    describe('Desert Planet Creation', () => {
        it('should create desert planet with basic configuration', () => {
            const config: PlanetConfig = {
                radius: 2.5,
                textureType: 'desert',
                atmosphereGlow: false,
                cloudLayer: false,
                rotationSpeed: 0.5
            };

            const planet = planetRenderer.createDesertPlanet(config);

            expect(planet).toBeDefined();
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
        });

        it('should create desert planet with atmosphere glow', () => {
            const config: PlanetConfig = {
                radius: 2.5,
                textureType: 'desert',
                atmosphereGlow: true,
                cloudLayer: false,
                rotationSpeed: 0.5
            };

            const planet = planetRenderer.createDesertPlanet(config);

            expect(planet).toBeDefined();
            // Should create additional material for atmosphere
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalledTimes(2);
        });

        it('should create desert planet with cloud layer', () => {
            const config: PlanetConfig = {
                radius: 2.5,
                textureType: 'desert',
                atmosphereGlow: false,
                cloudLayer: true,
                rotationSpeed: 0.5
            };

            const planet = planetRenderer.createDesertPlanet(config);

            expect(planet).toBeDefined();
            // Should create additional material for clouds
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalledTimes(2);
        });

        it('should create desert planet with both atmosphere and clouds', () => {
            const config: PlanetConfig = {
                radius: 2.5,
                textureType: 'desert',
                atmosphereGlow: true,
                cloudLayer: true,
                rotationSpeed: 0.5
            };

            const planet = planetRenderer.createDesertPlanet(config);

            expect(planet).toBeDefined();
            // Should create materials for planet, atmosphere, and clouds
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalledTimes(3);
        });
    });

    describe('Orbital System Creation', () => {
        it('should create orbital system with mining ship', () => {
            // Create a mock planet first
            const mockPlanet = {
                getBoundingInfo: () => ({
                    boundingBox: {
                        extendSize: { x: 2, y: 2, z: 2 }
                    }
                }),
                position: { clone: () => ({ x: 0, y: 0, z: 0 }) },
                parent: null
            };

            const orbitingShip = planetRenderer.createOrbitalSystem(mockPlanet as any);

            expect(orbitingShip).toBeDefined();
            expect(orbitingShip.shipModel).toBeDefined();
            expect(orbitingShip.orbitRadius).toBeGreaterThan(0);
            expect(orbitingShip.orbitSpeed).toBeGreaterThan(0);
            expect(orbitingShip.miningBeam).toBe(true);
        });

        it('should create mining ship with energy cores', () => {
            const mockPlanet = {
                getBoundingInfo: () => ({
                    boundingBox: {
                        extendSize: { x: 2, y: 2, z: 2 }
                    }
                }),
                position: { clone: () => ({ x: 0, y: 0, z: 0 }) },
                parent: null
            };

            const orbitingShip = planetRenderer.createOrbitalSystem(mockPlanet as any);

            // Should create materials for ship hull, energy cores, and mining beam
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
            expect(orbitingShip.shipModel).toBeDefined();
        });
    });

    describe('Component Integration', () => {
        it('should dispose properly', () => {
            expect(() => {
                planetRenderer.dispose();
            }).not.toThrow();
        });

        it('should handle material manager integration', () => {
            const config: PlanetConfig = {
                radius: 2.0,
                textureType: 'desert',
                atmosphereGlow: true,
                cloudLayer: true,
                rotationSpeed: 0.5
            };

            planetRenderer.createDesertPlanet(config);

            // Should use MaterialManager for consistent materials
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
            expect(mockMaterialManager.getColorPalette).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle material creation errors gracefully', () => {
            // Mock material manager to throw error
            mockMaterialManager.createCustomMaterial.mockImplementationOnce(() => {
                throw new Error('Material creation failed');
            });

            const config: PlanetConfig = {
                radius: 2.5,
                textureType: 'desert',
                atmosphereGlow: false,
                cloudLayer: false,
                rotationSpeed: 0.5
            };

            // Should not throw error, should handle gracefully
            expect(() => {
                planetRenderer.createDesertPlanet(config);
            }).not.toThrow();
        });
    });
});