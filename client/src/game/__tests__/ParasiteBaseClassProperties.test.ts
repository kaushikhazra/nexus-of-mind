/**
 * Parasite Base Class - Property Tests
 *
 * Property-based tests validating the Parasite base class refactor.
 * These tests ensure correctness properties hold across all parasite types.
 *
 * Feature: parasite-base-class-refactor
 */

import { Vector3, Color3 } from '@babylonjs/core';
import { Parasite, ParasiteState, TargetType } from '../entities/Parasite';
import { EnergyParasite } from '../entities/EnergyParasite';
import { CombatParasite } from '../entities/CombatParasite';
import { Queen, QueenPhase } from '../entities/Queen';
import { AdaptiveQueen } from '../entities/AdaptiveQueen';

// Mock dependencies
jest.mock('@babylonjs/core', () => {
    const actualBabylon = jest.requireActual('@babylonjs/core');
    return {
        ...actualBabylon,
        Vector3: class Vector3 {
            x: number;
            y: number;
            z: number;
            constructor(x = 0, y = 0, z = 0) {
                this.x = x;
                this.y = y;
                this.z = z;
            }
            clone() { return new Vector3(this.x, this.y, this.z); }
            add(v: Vector3) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
            subtract(v: Vector3) { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
            scale(s: number) { return new Vector3(this.x * s, this.y * s, this.z * s); }
            normalize() {
                const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
                if (len === 0) return new Vector3(0, 0, 0);
                return new Vector3(this.x / len, this.y / len, this.z / len);
            }
            addInPlace(v: Vector3) {
                this.x += v.x;
                this.y += v.y;
                this.z += v.z;
                return this;
            }
            length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
            static Distance(a: Vector3, b: Vector3) {
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dz = a.z - b.z;
                return Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            static Zero() { return new Vector3(0, 0, 0); }
        },
        Color3: class Color3 {
            r: number;
            g: number;
            b: number;
            constructor(r = 0, g = 0, b = 0) {
                this.r = r;
                this.g = g;
                this.b = b;
            }
            equals(other: Color3) {
                return this.r === other.r && this.g === other.g && this.b === other.b;
            }
        },
        Scene: jest.fn(),
        MeshBuilder: {
            CreateTorus: jest.fn(() => ({
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                parent: null,
                material: null,
                dispose: jest.fn(),
                setEnabled: jest.fn()
            })),
            CreateLines: jest.fn(() => ({
                dispose: jest.fn(),
                material: null,
                alpha: 1
            }))
        },
        TransformNode: jest.fn().mockImplementation(() => ({
            position: { x: 0, y: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }) },
            rotation: { x: 0, y: 0, z: 0 },
            dispose: jest.fn(),
            setEnabled: jest.fn()
        })),
        StandardMaterial: jest.fn().mockImplementation(() => ({
            diffuseColor: null,
            emissiveColor: null,
            disableLighting: false
        })),
        Mesh: jest.fn()
    };
});

// Mock GameEngine
jest.mock('../GameEngine', () => ({
    GameEngine: {
        getInstance: jest.fn(() => ({
            getScene: jest.fn(() => ({})),
            getTerrainGenerator: jest.fn(() => ({
                getHeightAtPosition: jest.fn(() => 10)
            }))
        }))
    }
}));

// Mock MaterialManager
const mockMaterialManager = {
    getParasiteMaterial: jest.fn(() => ({})),
    getCombatParasiteMaterial: jest.fn(() => ({})),
    getCombatParasiteAltMaterial: jest.fn(() => ({}))
};

// Mock MineralDeposit
const mockMineralDeposit = {
    id: 'deposit_1',
    position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0)
};

// Mock Territory
const mockTerritory = {
    id: 'territory_1',
    centerPosition: new (jest.requireMock('@babylonjs/core').Vector3)(50, 0, 50),
    controlStatus: 'contested',
    parasiteCount: 0,
    queen: null,
    hive: null,
    liberationTimer: 0
};

// Mock WebSocketClient
const mockWebSocketClient = {
    sendQueenDeath: jest.fn(),
    on: jest.fn()
};

// Mock GameState
const mockGameState = {
    getEnergyLevel: jest.fn(() => 100)
};

describe('Property-Based Tests: Parasite Base Class Refactor', () => {

    describe('Property 1: Movement Consistency', () => {
        /**
         * For any two parasites of different types moving toward the same target,
         * the movement interpolation and facing direction calculation should
         * produce identical results (given the same speed).
         * Validates: Requirements 2.1, 2.3, 2.5
         */

        test('should produce consistent movement across parasite types with same speed', () => {
            const Vector3 = jest.requireMock('@babylonjs/core').Vector3;
            const startPosition = new Vector3(0, 0, 0);
            const targetPosition = new Vector3(10, 0, 10);

            // Create parasites at same position
            const energyParasite = new EnergyParasite({
                position: startPosition.clone(),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const combatParasite = new CombatParasite({
                position: startPosition.clone(),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            // Set same speed for fair comparison
            (energyParasite as any).speed = 2.0;
            (combatParasite as any).speed = 2.0;

            // Simulate movement for multiple iterations
            const deltaTime = 0.016; // ~60fps
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                // Access protected moveTowards via update or direct call
                (energyParasite as any).moveTowards(targetPosition, deltaTime);
                (combatParasite as any).moveTowards(targetPosition, deltaTime);
            }

            // Positions should be equal (or very close due to floating point)
            const energyPos = energyParasite.getPosition();
            const combatPos = combatParasite.getPosition();

            expect(Math.abs(energyPos.x - combatPos.x)).toBeLessThan(0.001);
            expect(Math.abs(energyPos.z - combatPos.z)).toBeLessThan(0.001);
        });

        test.each([
            { speed: 1.0, expectedDistance: 1.6 },
            { speed: 2.0, expectedDistance: 3.2 },
            { speed: 5.0, expectedDistance: 8.0 }
        ])('should move correct distance with speed $speed', ({ speed, expectedDistance }) => {
            const Vector3 = jest.requireMock('@babylonjs/core').Vector3;
            const startPosition = new Vector3(0, 0, 0);
            const targetPosition = new Vector3(100, 0, 0);

            const parasite = new EnergyParasite({
                position: startPosition.clone(),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            (parasite as any).speed = speed;

            // Move for 1 second (100 frames at 60fps)
            const deltaTime = 0.016;
            const frames = 100;

            for (let i = 0; i < frames; i++) {
                (parasite as any).moveTowards(targetPosition, deltaTime);
            }

            const movedDistance = parasite.getPosition().x;
            expect(movedDistance).toBeCloseTo(expectedDistance, 1);
        });
    });

    describe('Property 2: Animation Uniformity', () => {
        /**
         * For any parasite type, the segment wave animation should use the same
         * mathematical formula, differing only by configurable parameters.
         * Validates: Requirements 3.1, 3.2, 3.4
         */

        test('should have consistent animation formula across types', () => {
            const energyParasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const combatParasite = new CombatParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            // Both should have updateSegmentAnimation method from base class
            expect(typeof (energyParasite as any).updateSegmentAnimation).toBe('function');
            expect(typeof (combatParasite as any).updateSegmentAnimation).toBe('function');

            // Animation should run without errors
            expect(() => (energyParasite as any).updateSegmentAnimation()).not.toThrow();
            expect(() => (combatParasite as any).updateSegmentAnimation()).not.toThrow();
        });

        test('should respect configurable segment parameters', () => {
            const energyParasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const combatParasite = new CombatParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            // Energy Parasite: 4 segments
            expect((energyParasite as any).getSegmentCount()).toBe(4);

            // Combat Parasite: 6 segments
            expect((combatParasite as any).getSegmentCount()).toBe(6);

            // Different spacing
            expect((energyParasite as any).getSegmentSpacing()).toBe(0.3);
            expect((combatParasite as any).getSegmentSpacing()).toBe(0.36);
        });
    });

    describe('Property 3: Patrol Territory Bounds', () => {
        /**
         * For any parasite patrolling its territory, the generated patrol targets
         * should never exceed the configured patrol radius from the territory center.
         * Validates: Requirements 4.2, 4.3, 4.5
         */

        test('should generate patrol targets within territory radius', () => {
            const Vector3 = jest.requireMock('@babylonjs/core').Vector3;
            const territoryCenter = new Vector3(50, 0, 50);

            const parasite = new EnergyParasite({
                position: territoryCenter.clone(),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const territoryRadius = (parasite as any).territoryRadius;

            // Generate 100 patrol targets and verify all are within bounds
            for (let i = 0; i < 100; i++) {
                const patrolTarget = (parasite as any).generatePatrolTarget();
                const distance = Vector3.Distance(patrolTarget, territoryCenter);

                expect(distance).toBeLessThanOrEqual(territoryRadius);
            }
        });

        test.each([
            { radius: 10 },
            { radius: 25 },
            { radius: 50 },
            { radius: 100 }
        ])('should respect custom territory radius of $radius', ({ radius }) => {
            const Vector3 = jest.requireMock('@babylonjs/core').Vector3;
            const territoryCenter = new Vector3(0, 0, 0);

            const parasite = new EnergyParasite({
                position: territoryCenter.clone(),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            (parasite as any).territoryRadius = radius;
            (parasite as any).territoryCenter = territoryCenter;

            // Generate patrol targets
            for (let i = 0; i < 50; i++) {
                const patrolTarget = (parasite as any).generatePatrolTarget();
                const distance = Vector3.Distance(patrolTarget, territoryCenter);

                expect(distance).toBeLessThanOrEqual(radius);
            }
        });
    });

    describe('Property 4: Color Uniqueness', () => {
        /**
         * For any two parasites of different types, calling getColor() should
         * return distinct Color3 values that are visually distinguishable.
         * Validates: Requirements 5.1, 5.2, 5.3, 5.4
         */

        test('should have unique colors for each parasite type', () => {
            const energyParasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const combatParasite = new CombatParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const energyColor = energyParasite.getColor();
            const combatColor = combatParasite.getColor();

            // Colors should be different
            expect(energyColor.r).not.toBe(combatColor.r);
            expect(energyColor.g).not.toBe(combatColor.g);

            // Energy Parasite: Yellow/Gold (high R, high G, low B)
            expect(energyColor.r).toBeGreaterThan(0.8);
            expect(energyColor.g).toBeGreaterThan(0.7);
            expect(energyColor.b).toBeLessThan(0.5);

            // Combat Parasite: Red (high R, low G, low B)
            expect(combatColor.r).toBeGreaterThan(0.8);
            expect(combatColor.g).toBeLessThan(0.5);
            expect(combatColor.b).toBeLessThan(0.5);
        });

        test('should have visually distinguishable colors (color distance check)', () => {
            const energyParasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const combatParasite = new CombatParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const energyColor = energyParasite.getColor();
            const combatColor = combatParasite.getColor();

            // Calculate Euclidean color distance
            const colorDistance = Math.sqrt(
                Math.pow(energyColor.r - combatColor.r, 2) +
                Math.pow(energyColor.g - combatColor.g, 2) +
                Math.pow(energyColor.b - combatColor.b, 2)
            );

            // Colors should be significantly different (distance > 0.5)
            expect(colorDistance).toBeGreaterThan(0.5);
        });
    });

    describe('Property 5: Targeting Hierarchy (CombatParasite)', () => {
        /**
         * For any CombatParasite with both protectors and workers in range,
         * calling targeting logic should select a protector before any worker.
         * Validates: Requirements 6.2, 6.4
         */

        test('should prioritize protectors over workers', () => {
            const combatParasite = new CombatParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const targetPriority = combatParasite.getTargetPriority();

            // First priority should be protectors
            expect(targetPriority[0]).toBe(TargetType.PROTECTOR);

            // Second priority should be workers
            expect(targetPriority[1]).toBe(TargetType.WORKER);
        });

        test('should have protector as primary target type', () => {
            const combatParasite = new CombatParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const targetPriority = combatParasite.getTargetPriority();

            expect(targetPriority.length).toBe(2);
            expect(targetPriority).toContain(TargetType.PROTECTOR);
            expect(targetPriority).toContain(TargetType.WORKER);
            expect(targetPriority.indexOf(TargetType.PROTECTOR)).toBeLessThan(
                targetPriority.indexOf(TargetType.WORKER)
            );
        });
    });

    describe('Property 6: EnergyParasite Worker-Only Targeting', () => {
        /**
         * For any EnergyParasite with protectors and workers in range,
         * the targeting logic should only consider workers as valid targets.
         * Validates: Requirements 6.1, 6.4
         */

        test('should only target workers', () => {
            const energyParasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const targetPriority = energyParasite.getTargetPriority();

            // Should only have workers
            expect(targetPriority.length).toBe(1);
            expect(targetPriority[0]).toBe(TargetType.WORKER);
            expect(targetPriority).not.toContain(TargetType.PROTECTOR);
        });
    });

    describe('Property 7: Queen Inheritance Chain', () => {
        /**
         * For any AdaptiveQueen instance, the inheritance chain should be:
         * Parasite → Queen → AdaptiveQueen, preserving all base class functionality.
         * Validates: Requirements 7.3, 7.5
         */

        test('should maintain correct inheritance chain', () => {
            const queen = new Queen({
                territory: mockTerritory as any,
                generation: 1,
                growthDuration: 0,
                health: 50
            });

            // Queen should be instance of Parasite
            expect(queen).toBeInstanceOf(Parasite);

            // Queen should have base Parasite methods
            expect(typeof queen.getColor).toBe('function');
            expect(typeof queen.getTargetPriority).toBe('function');
            expect(typeof queen.getPosition).toBe('function');
            expect(typeof queen.takeDamage).toBe('function');
        });

        test('Queen should have correct segment configuration', () => {
            const queen = new Queen({
                territory: mockTerritory as any,
                generation: 1,
                growthDuration: 0,
                health: 50
            });

            // Queen has 12 segments (larger than parasites)
            expect((queen as any).getSegmentCount()).toBe(12);

            // Queen has larger base scale
            expect((queen as any).getBaseScale()).toBe(1.5);
        });

        test('Queen should have purple color', () => {
            const queen = new Queen({
                territory: mockTerritory as any,
                generation: 1,
                growthDuration: 0,
                health: 50
            });

            const color = queen.getColor();

            // Purple: moderate R, low G, high B
            expect(color.r).toBeGreaterThan(0.5);
            expect(color.g).toBeLessThan(0.5);
            expect(color.b).toBeGreaterThan(0.5);
        });
    });

    describe('Property 8: Backward Compatibility - Combat Values', () => {
        /**
         * For any parasite type, health, damage, and energy reward values
         * should be identical before and after refactor.
         * Validates: Requirements 8.3, 8.4
         */

        test('EnergyParasite should have correct combat values', () => {
            const energyParasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            expect(energyParasite.getHealth()).toBe(2);
            expect(energyParasite.getMaxHealth()).toBe(2);
            expect(energyParasite.getEnergyReward()).toBe(2);
        });

        test('CombatParasite should have correct combat values', () => {
            const combatParasite = new CombatParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            expect(combatParasite.getHealth()).toBe(4);
            expect(combatParasite.getMaxHealth()).toBe(4);
            expect(combatParasite.getEnergyReward()).toBe(4);
        });

        test('should maintain 2x relationship between types', () => {
            const energyParasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const combatParasite = new CombatParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            expect(combatParasite.getHealth()).toBe(energyParasite.getHealth() * 2);
            expect(combatParasite.getEnergyReward()).toBe(energyParasite.getEnergyReward() * 2);
        });
    });

    describe('Property 9: takeDamage Consistency', () => {
        /**
         * For any parasite, takeDamage should correctly reduce health
         * and return true when destroyed.
         */

        test('should reduce health correctly', () => {
            const parasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            const initialHealth = parasite.getHealth();
            const destroyed = parasite.takeDamage(1);

            expect(parasite.getHealth()).toBe(initialHealth - 1);
            expect(destroyed).toBe(false);
        });

        test('should return true when destroyed', () => {
            const parasite = new EnergyParasite({
                position: new (jest.requireMock('@babylonjs/core').Vector3)(0, 0, 0),
                scene: {},
                materialManager: mockMaterialManager,
                homeDeposit: mockMineralDeposit
            });

            // Deal enough damage to destroy
            const destroyed = parasite.takeDamage(parasite.getHealth());

            expect(destroyed).toBe(true);
            expect(parasite.getHealth()).toBe(0);
        });
    });
});
