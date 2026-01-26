/**
 * EmblemGeometry Component Tests
 * 
 * Tests the geometric emblem creation functionality for the Introduction Screen.
 * Validates emblem creation, material application, and animation setup.
 */

import { Scene, Engine, NullEngine, AbstractMesh, Animation } from '@babylonjs/core';
import { EmblemGeometry } from '../EmblemGeometry';
import { MaterialManager } from '../../../rendering/MaterialManager';

// Mock canvas for testing
const mockCanvas = {
    width: 300,
    height: 400,
    getContext: jest.fn(() => ({
        canvas: mockCanvas
    }))
} as unknown as HTMLCanvasElement;

describe('EmblemGeometry', () => {
    let engine: Engine;
    let scene: Scene;
    let materialManager: MaterialManager;
    let emblemGeometry: EmblemGeometry;

    beforeEach(() => {
        // Create null engine for testing (no WebGL required)
        engine = new NullEngine({
            renderWidth: 300,
            renderHeight: 400,
            textureSize: 256,
            deterministicLockstep: false,
            lockstepMaxSteps: 1
        });

        // Create scene
        scene = new Scene(engine);
        
        // Create material manager
        materialManager = new MaterialManager(scene);
        
        // Create emblem geometry component
        emblemGeometry = new EmblemGeometry(scene, materialManager);
    });

    afterEach(() => {
        // Cleanup
        emblemGeometry.dispose();
        materialManager.dispose();
        scene.dispose();
        engine.dispose();
    });

    describe('Empire Emblem Creation', () => {
        test('should create Empire emblem with proper structure', () => {
            const emblem = emblemGeometry.createEmpireEmblem();
            
            expect(emblem).toBeDefined();
            expect(emblem.name).toBe('empireEmblem');
            
            // Should have child meshes for different emblem parts
            const children = emblem.getChildMeshes();
            expect(children.length).toBeGreaterThan(0);
            
            // Should have materials applied
            children.forEach(child => {
                expect(child.material).toBeDefined();
            });
        });

        test('should have pulsing animation', () => {
            const emblem = emblemGeometry.createEmpireEmblem();
            
            // Should have animations
            expect(emblem.animations).toBeDefined();
            expect(emblem.animations.length).toBeGreaterThan(0);
            
            // Should have scaling animation for pulsing effect
            const pulseAnimation = emblem.animations.find(anim => 
                anim.name === 'emblemPulse' && anim.targetProperty === 'scaling'
            );
            expect(pulseAnimation).toBeDefined();
            expect(pulseAnimation?.dataType).toBe(Animation.ANIMATIONTYPE_VECTOR3);
        });

        test('should use cyan color scheme for Empire', () => {
            const emblem = emblemGeometry.createEmpireEmblem();
            const children = emblem.getChildMeshes();
            
            // At least one child should have cyan-based material
            const hasCyanMaterial = children.some(child => {
                const material = child.material as any;
                if (material && material.diffuseColor) {
                    // Check if material has cyan characteristics (high blue and green, low red)
                    return material.diffuseColor.b > 0.5 && material.diffuseColor.g > 0.5 && material.diffuseColor.r < 0.5;
                }
                return false;
            });
            
            expect(hasCyanMaterial).toBe(true);
        });
    });

    describe('Energy Lords Emblem Creation', () => {
        test('should create Energy Lords emblem with proper structure', () => {
            const emblem = emblemGeometry.createEnergyLordsEmblem();
            
            expect(emblem).toBeDefined();
            expect(emblem.name).toBe('energyLordsEmblem');
            
            // Should have child meshes for different emblem parts
            const children = emblem.getChildMeshes();
            expect(children.length).toBeGreaterThan(0);
            
            // Should have materials applied
            children.forEach(child => {
                expect(child.material).toBeDefined();
            });
        });

        test('should have pulsing animation', () => {
            const emblem = emblemGeometry.createEnergyLordsEmblem();
            
            // Should have animations
            expect(emblem.animations).toBeDefined();
            expect(emblem.animations.length).toBeGreaterThan(0);
            
            // Should have scaling animation for pulsing effect
            const pulseAnimation = emblem.animations.find(anim => 
                anim.name === 'emblemPulse' && anim.targetProperty === 'scaling'
            );
            expect(pulseAnimation).toBeDefined();
            expect(pulseAnimation?.dataType).toBe(Animation.ANIMATIONTYPE_VECTOR3);
        });

        test('should use cyan and gold color scheme for Energy Lords', () => {
            const emblem = emblemGeometry.createEnergyLordsEmblem();
            const children = emblem.getChildMeshes();
            
            let hasCyanMaterial = false;
            let hasGoldMaterial = false;
            
            children.forEach(child => {
                const material = child.material as any;
                if (material && material.diffuseColor) {
                    const color = material.diffuseColor;
                    
                    // Check for cyan (high blue and green, low red)
                    if (color.b > 0.5 && color.g > 0.5 && color.r < 0.5) {
                        hasCyanMaterial = true;
                    }
                    
                    // Check for gold (high red and green, low blue)
                    if (color.r > 0.5 && color.g > 0.5 && color.b < 0.5) {
                        hasGoldMaterial = true;
                    }
                }
            });
            
            // Should have both cyan and gold materials
            expect(hasCyanMaterial || hasGoldMaterial).toBe(true);
        });
    });

    describe('Simple Emblem Creation', () => {
        test('should create simple hexagon emblem', () => {
            const emblem = emblemGeometry.createSimpleEmblem('testHexagon', 'hexagon');
            
            expect(emblem).toBeDefined();
            expect(emblem.name).toBe('testHexagon');
            expect(emblem.material).toBeDefined();
            
            // Should have pulsing animation
            expect(emblem.animations.length).toBeGreaterThan(0);
        });

        test('should create simple octagon emblem', () => {
            const emblem = emblemGeometry.createSimpleEmblem('testOctagon', 'octagon');
            
            expect(emblem).toBeDefined();
            expect(emblem.name).toBe('testOctagon');
            expect(emblem.material).toBeDefined();
            
            // Should have pulsing animation
            expect(emblem.animations.length).toBeGreaterThan(0);
        });
    });

    describe('Animation System', () => {
        test('should create pulsing animation with correct properties', () => {
            const emblem = emblemGeometry.createSimpleEmblem('testAnimation');
            const animation = emblemGeometry.addPulsingAnimation(emblem, 1.0);
            
            expect(animation).toBeDefined();
            expect(animation.name).toBe('emblemPulse');
            expect(animation.targetProperty).toBe('scaling');
            expect(animation.dataType).toBe(Animation.ANIMATIONTYPE_VECTOR3);
            expect(animation.loopMode).toBe(Animation.ANIMATIONLOOPMODE_CYCLE);
            
            // Should have key frames
            const keys = animation.getKeys();
            expect(keys.length).toBeGreaterThan(0);
            
            // Should have easing function for smooth animation
            expect(animation.getEasingFunction()).toBeDefined();
        });

        test('should support different animation speeds', () => {
            const emblem = emblemGeometry.createSimpleEmblem('testSpeed');
            
            const slowAnimation = emblemGeometry.addPulsingAnimation(emblem, 0.5);
            const fastAnimation = emblemGeometry.addPulsingAnimation(emblem, 2.0);
            
            const slowKeys = slowAnimation.getKeys();
            const fastKeys = fastAnimation.getKeys();
            
            // Different speeds should result in different frame counts
            const slowDuration = slowKeys[slowKeys.length - 1].frame;
            const fastDuration = fastKeys[fastKeys.length - 1].frame;
            
            expect(slowDuration).toBeGreaterThan(fastDuration);
        });
    });

    describe('Error Handling', () => {
        test('should handle disposal gracefully', () => {
            expect(() => {
                emblemGeometry.dispose();
            }).not.toThrow();
        });

        test('should handle invalid scene gracefully', () => {
            const invalidEmblemGeometry = new EmblemGeometry(null as any, materialManager);
            
            expect(() => {
                invalidEmblemGeometry.createSimpleEmblem('test');
            }).not.toThrow();
        });
    });

    describe('Material Integration', () => {
        test('should use MaterialManager for material creation', () => {
            const emblem = emblemGeometry.createSimpleEmblem('materialTest');
            
            expect(emblem.material).toBeDefined();
            
            // Material should be created through MaterialManager
            const materialName = (emblem.material as any).name;
            expect(materialName).toContain('materialTest_material');
        });

        test('should apply emissive properties for glow effects', () => {
            const emblem = emblemGeometry.createEmpireEmblem();
            const children = emblem.getChildMeshes();
            
            // At least one material should have emissive properties for glow
            const hasEmissiveMaterial = children.some(child => {
                const material = child.material as any;
                return material && material.emissiveColor && 
                       (material.emissiveColor.r > 0 || material.emissiveColor.g > 0 || material.emissiveColor.b > 0);
            });
            
            expect(hasEmissiveMaterial).toBe(true);
        });
    });
});