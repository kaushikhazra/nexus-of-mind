/**
 * CameraController - RTS-style camera controls and movement
 * 
 * Implements ArcRotateCamera with constraints and smooth controls optimized
 * for strategic gameplay. Provides smooth camera transitions and appropriate
 * boundaries for RTS-style gameplay.
 */

import { Scene, ArcRotateCamera, Vector3 } from '@babylonjs/core';

export class CameraController {
    private scene: Scene;
    private canvas: HTMLCanvasElement;
    private camera: ArcRotateCamera | null = null;

    // Fix 18: Static direction vectors to avoid per-frame allocation from Vector3.Forward()/Backward()
    private static readonly FORWARD = new Vector3(0, 0, 1);
    private static readonly BACKWARD = new Vector3(0, 0, -1);

    // Cached vectors for keyboard movement (avoid per-frame allocations)
    private cachedMoveVector: Vector3 = new Vector3();
    private cachedNewTarget: Vector3 = new Vector3();
    private cachedDirection: Vector3 = new Vector3(); // Fix 18: for getDirectionToRef result

    // Fix: Track callbacks for cleanup to prevent memory leaks
    private renderObserver: (() => void) | null = null;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
    private keyupHandler: ((event: KeyboardEvent) => void) | null = null;

    // Camera configuration
    private readonly INITIAL_RADIUS = 75; // Increased 3x for better overview (was 25)
    private readonly INITIAL_ALPHA = -Math.PI / 4; // 45 degrees from side
    private readonly INITIAL_BETA = Math.PI / 4;   // 45 degrees from horizontal (better RTS view)
    private readonly MIN_RADIUS = 8;
    private readonly MAX_RADIUS = 60;
    private readonly MIN_BETA = 0.1;
    private readonly MAX_BETA = Math.PI / 2 - 0.1;

    constructor(scene: Scene, canvas: HTMLCanvasElement) {
        this.scene = scene;
        this.canvas = canvas;
    }

    /**
     * Setup RTS-style camera with appropriate controls
     */
    public setupCamera(): void {
        try {
            // Create ArcRotateCamera for RTS-style controls
            this.camera = new ArcRotateCamera(
                'rtsCamera',
                this.INITIAL_ALPHA,
                this.INITIAL_BETA,
                this.INITIAL_RADIUS,
                Vector3.Zero(),
                this.scene
            );

            // Configure camera constraints
            this.configureCameraConstraints();

            // Setup camera controls
            this.setupCameraControls();

            // Attach camera to canvas
            this.camera.attachControl(this.canvas, true);

            // Set as active camera
            this.scene.activeCamera = this.camera;

            // Set camera target to a better position (slightly above ground)
            this.setCameraTarget(new Vector3(0, 2, 0));

        } catch (error) {
            console.error('❌ Failed to setup camera:', error);
            throw error;
        }
    }

    /**
     * Configure camera movement constraints for RTS gameplay
     */
    private configureCameraConstraints(): void {
        if (!this.camera) return;

        // Set zoom limits
        this.camera.lowerRadiusLimit = this.MIN_RADIUS;
        this.camera.upperRadiusLimit = this.MAX_RADIUS;

        // Set vertical rotation limits (prevent camera from going underground or too high)
        this.camera.lowerBetaLimit = this.MIN_BETA;
        this.camera.upperBetaLimit = this.MAX_BETA;

        // No horizontal rotation limits (allow full 360° rotation)
        this.camera.lowerAlphaLimit = null;
        this.camera.upperAlphaLimit = null;

        // Configure smooth movement
        this.camera.inertia = 0.7;
        this.camera.angularSensibilityX = 1000;
        this.camera.angularSensibilityY = 1000;
        this.camera.wheelPrecision = 50;
        this.camera.pinchPrecision = 50;
    }

    /**
     * Setup camera input controls with custom keyboard but default mouse
     */
    private setupCameraControls(): void {
        if (!this.camera) return;

        // Enable standard mouse controls (only if not already attached)
        if (!this.camera.inputs.attached.mousewheel) {
            this.camera.inputs.addMouseWheel();
        }
        if (!this.camera.inputs.attached.pointers) {
            this.camera.inputs.addPointers();
        }
        
        // Add custom keyboard controls only
        this.setupCustomKeyboardControls();

        // Configure mouse controls (keep original settings)
        const pointerInput = this.camera.inputs.attached.pointers;
        if (pointerInput && 'buttons' in pointerInput) {
            // Left, middle, right mouse buttons (original behavior)
            (pointerInput as any).buttons = [0, 1, 2];
        }
    }

    /**
     * Setup custom keyboard controls for camera movement
     */
    private setupCustomKeyboardControls(): void {
        if (!this.camera) return;

        const moveSpeed = 0.5; // Units per frame
        const rotateSpeed = 0.02; // Radians per frame

        // Track pressed keys
        const pressedKeys = new Set<string>();

        // Fix: Store handlers for cleanup
        this.keydownHandler = (event: KeyboardEvent) => {
            pressedKeys.add(event.code);
        };
        this.keyupHandler = (event: KeyboardEvent) => {
            pressedKeys.delete(event.code);
        };

        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);

        // Fix: Store render callback for cleanup
        this.renderObserver = () => {
            if (!this.camera) return;

            const target = this.camera.getTarget();

            // W/Up Arrow: Move forward in the map
            // Fix 18: Use static FORWARD and getDirectionToRef instead of Vector3.Forward() and getDirection()
            if (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) {
                this.camera.getDirectionToRef(CameraController.FORWARD, this.cachedDirection);
                this.cachedDirection.scaleInPlace(moveSpeed);
                this.cachedMoveVector.set(this.cachedDirection.x, 0, this.cachedDirection.z);
                target.addToRef(this.cachedMoveVector, this.cachedNewTarget);
                this.camera.setTarget(this.cachedNewTarget);
            }

            // S/Down Arrow: Move backward in the map
            // Fix 18: Use static BACKWARD and getDirectionToRef
            if (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown')) {
                this.camera.getDirectionToRef(CameraController.BACKWARD, this.cachedDirection);
                this.cachedDirection.scaleInPlace(moveSpeed);
                this.cachedMoveVector.set(this.cachedDirection.x, 0, this.cachedDirection.z);
                target.addToRef(this.cachedMoveVector, this.cachedNewTarget);
                this.camera.setTarget(this.cachedNewTarget);
            }

            // A/Left Arrow: Rotate view to left
            if (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft')) {
                this.camera.alpha -= rotateSpeed;
            }

            // D/Right Arrow: Rotate view to right
            if (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) {
                this.camera.alpha += rotateSpeed;
            }
        };

        this.scene.registerBeforeRender(this.renderObserver);
    }

    /**
     * Set camera target position
     */
    public setCameraTarget(target: Vector3): void {
        if (this.camera) {
            this.camera.setTarget(target);
        }
    }

    /**
     * Setup edge scrolling for RTS-style camera movement
     */
    private setupEdgeScrolling(): void {
        // Edge scrolling will be implemented in future iterations
        // This is a placeholder for the functionality
        
        const edgeScrollSpeed = 0.5;
        const edgeScrollMargin = 50; // pixels from edge

        // Mouse move handler for edge scrolling
        this.canvas.addEventListener('mousemove', (event) => {
            if (!this.camera) return;

            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Check if mouse is near edges
            const nearLeftEdge = x < edgeScrollMargin;
            const nearRightEdge = x > rect.width - edgeScrollMargin;
            const nearTopEdge = y < edgeScrollMargin;
            const nearBottomEdge = y > rect.height - edgeScrollMargin;

            // Calculate movement vector
            let moveX = 0;
            let moveZ = 0;

            if (nearLeftEdge) moveX = -edgeScrollSpeed;
            if (nearRightEdge) moveX = edgeScrollSpeed;
            if (nearTopEdge) moveZ = edgeScrollSpeed;
            if (nearBottomEdge) moveZ = -edgeScrollSpeed;

            // Apply movement (will be implemented when needed)
            if (moveX !== 0 || moveZ !== 0) {
                // Future: Move camera target position
                // this.moveCameraTarget(moveX, moveZ);
            }
        });

    }

    /**
     * Get the current camera
     */
    public getCamera(): ArcRotateCamera | null {
        return this.camera;
    }



    /**
     * Smoothly move camera to a new position
     */
    public moveCameraTo(target: Vector3, _duration: number = 1000): void {
        if (!this.camera) return;

        // Future enhancement: Smooth camera transitions
        // For now, just set the target directly
        this.setCameraTarget(target);
    }

    /**
     * Reset camera to default position
     */
    public resetCamera(): void {
        if (!this.camera) return;

        this.camera.alpha = this.INITIAL_ALPHA;
        this.camera.beta = this.INITIAL_BETA;
        this.camera.radius = this.INITIAL_RADIUS;
        this.camera.setTarget(Vector3.Zero());
    }

    /**
     * Dispose camera resources
     */
    public dispose(): void {
        // Fix: Unregister render callback to prevent memory leak
        if (this.renderObserver) {
            this.scene.unregisterBeforeRender(this.renderObserver);
            this.renderObserver = null;
        }

        // Fix: Remove keyboard event listeners
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        if (this.keyupHandler) {
            window.removeEventListener('keyup', this.keyupHandler);
            this.keyupHandler = null;
        }

        if (this.camera) {
            this.camera.dispose();
            this.camera = null;
        }
    }
}