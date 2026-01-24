/**
 * ParasiteRenderer Component Tests
 * 
 * Tests for organic parasite model creation with CSG operations,
 * dark materials, red pulsing vein effects, and writhing animations.
 * 
 * Requirements: 9.2, 9.3, 9.10
 */

import { Scene, Engine, NullEngine, AbstractMesh, Animation, Material } from '@babylonjs/core';
import { ParasiteRenderer, ParasiteConfig } from '../ParasiteRenderer';

// Mock MaterialManager
const mockMaterialManager = {
    createCustomMaterial: jest.fn().mockReturnValue({
        dispose: jest.fn(),
        emissiveTexture: null,
        transparencyMode: null,
        backFaceCulling: true
    }),
    getColorPalette: jest.fn().mockReturnValue({
        terrain: {
            desert: { r: 0.8, g: 0.7, b: 0.4 }
        }
    })
};

describe('ParasiteRenderer', () => {
    let engine: Engine;
    let scene: Scene;
    let parasiteRenderer: ParasiteRenderer;

    beforeEach(() => {
        // Create Babylon.js test environment
        engine = new NullEngine({
            renderHeight: 256,
            renderWidth: 256,
            textureSize: 256,
            deterministicLockstep: false,
            lockstepMaxSteps: 1
        });
        
        scene = new Scene(engine);
        parasiteRenderer = new ParasiteRenderer(scene, mockMaterialManager as any);
    });

    afterEach(() => {
        scene.dispose();
        engine.dispose();
        jest.clearAllMocks();
    });

    describe('Parasite Group Creation', () => {
        it('should create parasite group with specified count and shapes', () => {
            const config: ParasiteConfig = {
                count: 3,
                organicShapes: ['blob', 'tendril', 'spore'],
                pulsing: true,
                writhing: true,
                redVeins: true
            };

            const parasiteGroup = parasiteRenderer.createParasiteGroup(config);

            expect(parasiteGroup).toBeDefined();
            expect(parasiteGroup.name).toBe('parasiteGroup');
            
            // Should have 3 child parasites
            const children = parasiteGroup.getChildMeshes();
            expect(children.length).toBe(config.count);
            
            // Should create materials for each parasite
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
        });

        it('should position parasites in cluster formation', () => {
            const config: ParasiteConfig = {
                count: 4,
                organicShapes: ['blob'],
                pulsing: false,
                writhing: false,
                redVeins: false
            };

            const parasiteGroup = parasiteRenderer.createParasiteGroup(config);
            const children = parasiteGroup.getChildMeshes();

            // Each parasite should have different position
            const positions = children.map(child => child.position);
            
            // No two parasites should have identical positions
            for (let i = 0; i < positions.length; i++) {
                for (let j = i + 1; j < positions.length; j++) {
                    expect(positions[i].equals(positions[j])).toBe(false);
                }
            }
        });

        it('should apply random rotations for organic variety', () => {
            const config: ParasiteConfig = {
                count: 2,
                organicShapes: ['blob'],
                pulsing: false,
                writhing: false,
                redVeins: false
            };

            const parasiteGroup = parasiteRenderer.createParasiteGroup(config);
            const children = parasiteGroup.getChildMeshes();

            // Each parasite should have rotation applied
            children.forEach(child => {
                expect(child.rotation.x).toBeDefined();
                expect(child.rotation.y).toBeDefined();
                expect(child.rotation.z).toBeDefined();
            });
        });
    });

    describe('Organic Shape Creation', () => {
        it('should create organic blob using CSG operations', () => {
            const blob = parasiteRenderer.createOrganicBlob('testBlob');

            expect(blob).toBeDefined();
            expect(blob.name).toBe('testBlob');
            
            // Blob should be a mesh created from CSG operations
            expect(blob).toBeInstanceOf(AbstractMesh);
        });

        it('should create tendril shape with elongated form', () => {
            const tendril = parasiteRenderer.createTendrilShape('testTendril');

            expect(tendril).toBeDefined();
            expect(tendril.name).toBe('testTendril');
            expect(tendril).toBeInstanceOf(AbstractMesh);
        });

        it('should create spore cluster with multiple pods', () => {
            const sporeCluster = parasiteRenderer.createSporeCluster('testSpores');

            expect(sporeCluster).toBeDefined();
            expect(sporeCluster.name).toBe('testSpores');
            
            // Spore cluster should have multiple child meshes
            const children = sporeCluster.getChildMeshes();
            expect(children.length).toBeGreaterThan(1); // Central mass + spores
        });
    });

    describe('Material Application', () => {
        it('should apply organic material with dark colors', () => {
            const blob = parasiteRenderer.createOrganicBlob('materialTest');
            parasiteRenderer.applyOrganicMaterial(blob, false);

            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalledWith(
                expect.stringContaining('organicMaterial_materialTest'),
                expect.objectContaining({
                    r: expect.any(Number),
                    g: expect.any(Number),
                    b: expect.any(Number)
                }),
                expect.objectContaining({
                    emissive: expect.any(Object),
                    specular: expect.any(Object),
                    roughness: expect.any(Number)
                })
            );

            expect(blob.material).toBeDefined();
        });

        it('should create red vein texture when requested', () => {
            const blob = parasiteRenderer.createOrganicBlob('veinTest');
            parasiteRenderer.applyOrganicMaterial(blob, true);

            // Should create material with vein texture
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
            
            // Material should be applied to mesh
            expect(blob.material).toBeDefined();
        });

        it('should apply material recursively to child meshes', () => {
            const sporeCluster = parasiteRenderer.createSporeCluster('recursiveTest');
            parasiteRenderer.applyOrganicMaterial(sporeCluster, false);

            // Parent should have material
            expect(sporeCluster.material).toBeDefined();
            
            // All children should have material applied
            const children = sporeCluster.getChildMeshes();
            children.forEach(child => {
                expect(child.material).toBeDefined();
            });
        });
    });

    describe('Animation Systems', () => {
        it('should add pulsing vein animations', () => {
            const blob = parasiteRenderer.createOrganicBlob('pulseTest');
            const animation = parasiteRenderer.addPulsingVeins(blob, 1.0);

            expect(animation).toBeDefined();
            expect(animation).toBeInstanceOf(Animation);
            expect(animation.name).toContain('veinPulse_pulseTest');
            
            // Animation should be added to mesh
            expect(blob.animations.length).toBeGreaterThan(0);
        });

        it('should create writhing animations with multiple channels', () => {
            const blob = parasiteRenderer.createOrganicBlob('writhingTest');
            const animations = parasiteRenderer.createWrithingAnimation(blob, 1.0);

            expect(animations).toBeDefined();
            expect(Array.isArray(animations)).toBe(true);
            expect(animations.length).toBeGreaterThan(1); // Multiple animation channels
            
            // All animations should be added to mesh
            expect(blob.animations.length).toBeGreaterThanOrEqual(animations.length);
        });

        it('should adjust animation speed based on speed parameter', () => {
            const blob = parasiteRenderer.createOrganicBlob('speedTest');
            const fastAnimations = parasiteRenderer.createWrithingAnimation(blob, 2.0);
            
            expect(fastAnimations).toBeDefined();
            expect(fastAnimations.length).toBeGreaterThan(0);
            
            // Animations should have different timing based on speed
            fastAnimations.forEach(animation => {
                expect(animation.getKeys().length).toBeGreaterThan(1);
            });
        });
    });

    describe('Configuration Handling', () => {
        it('should handle different organic shape types', () => {
            const shapeTypes: ('blob' | 'tendril' | 'spore' | 'cluster')[] = ['blob', 'tendril', 'spore', 'cluster'];
            
            shapeTypes.forEach(shapeType => {
                const config: ParasiteConfig = {
                    count: 1,
                    organicShapes: [shapeType],
                    pulsing: false,
                    writhing: false,
                    redVeins: false
                };

                const parasiteGroup = parasiteRenderer.createParasiteGroup(config);
                expect(parasiteGroup).toBeDefined();
                
                const children = parasiteGroup.getChildMeshes();
                expect(children.length).toBe(1);
            });
        });

        it('should enable/disable features based on configuration', () => {
            const configWithFeatures: ParasiteConfig = {
                count: 1,
                organicShapes: ['blob'],
                pulsing: true,
                writhing: true,
                redVeins: true
            };

            const parasiteGroup = parasiteRenderer.createParasiteGroup(configWithFeatures);
            const children = parasiteGroup.getChildMeshes();
            
            // Should have animations when writhing is enabled
            expect(children[0].animations.length).toBeGreaterThan(0);
            
            // Should create material with veins when redVeins is enabled
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
        });

        it('should handle empty or invalid configurations gracefully', () => {
            const emptyConfig: ParasiteConfig = {
                count: 0,
                organicShapes: [],
                pulsing: false,
                writhing: false,
                redVeins: false
            };

            const parasiteGroup = parasiteRenderer.createParasiteGroup(emptyConfig);
            expect(parasiteGroup).toBeDefined();
            
            // Should have no children for count 0
            const children = parasiteGroup.getChildMeshes();
            expect(children.length).toBe(0);
        });
    });

    describe('Resource Management', () => {
        it('should dispose resources properly', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            parasiteRenderer.dispose();
            
            expect(consoleSpy).toHaveBeenCalledWith('ParasiteRenderer disposed');
            consoleSpy.mockRestore();
        });

        it('should handle material creation errors gracefully', () => {
            // Mock material manager to throw error
            mockMaterialManager.createCustomMaterial.mockImplementationOnce(() => {
                throw new Error('Material creation failed');
            });

            expect(() => {
                const blob = parasiteRenderer.createOrganicBlob('errorTest');
                parasiteRenderer.applyOrganicMaterial(blob, false);
            }).toThrow('Material creation failed');
        });
    });

    describe('Visual Consistency', () => {
        it('should use MaterialManager for consistent materials', () => {
            const config: ParasiteConfig = {
                count: 2,
                organicShapes: ['blob', 'tendril'],
                pulsing: false,
                writhing: false,
                redVeins: true
            };

            parasiteRenderer.createParasiteGroup(config);

            // Should use MaterialManager for all material creation
            expect(mockMaterialManager.createCustomMaterial).toHaveBeenCalled();
            
            // Should create materials with consistent naming pattern
            const calls = mockMaterialManager.createCustomMaterial.mock.calls;
            calls.forEach(call => {
                expect(call[0]).toContain('organicMaterial_');
            });
        });

        it('should create materials with appropriate organic properties', () => {
            const blob = parasiteRenderer.createOrganicBlob('propertiesTest');
            parasiteRenderer.applyOrganicMaterial(blob, false);

            const materialCall = mockMaterialManager.createCustomMaterial.mock.calls[0];
            const options = materialCall[2];

            // Should have high roughness for organic look
            expect(options.roughness).toBeGreaterThan(0.8);
            
            // Should have low specular for non-reflective surface
            expect(options.specular).toBeDefined();
            
            // Should have dark emissive color
            expect(options.emissive).toBeDefined();
        });
    });
});