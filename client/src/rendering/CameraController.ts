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

    // Camera configuration
    private readonly INITIAL_RADIUS = 25;
    private readonly INITIAL_ALPHA = -Math.PI / 4; // 45 degrees from side
    private readonly INITIAL_BETA = Math.PI / 4;   // 45 degrees from horizontal (better RTS view)
    private readonly MIN_RADIUS = 8;
    private readonly MAX_RADIUS = 60;
    private readonly MIN_BETA = 0.1;
    private readonly MAX_BETA = Math.PI / 2 - 0.1;

    constructor(scene: Scene, canvas: HTMLCanvasElement) {
        this.scene = scene;
        this.canvas = canvas;
        console.log('📷 CameraController created');
    }

    /**
     * Setup RTS-style camera with appropriate controls
     */
    public setupCamera(): void {
        try {
            console.log('📷 Setting up RTS camera...');

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

            console.log('✅ RTS camera setup complete');

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

        console.log('⚙️ Camera constraints configured');
    }

    /**
     * Setup camera input controls
     */
    private setupCameraControls(): void {
        if (!this.camera) return;

        // Enable standard camera inputs
        this.camera.inputs.addMouseWheel();
        this.camera.inputs.addPointers();
        this.camera.inputs.addKeyboard();

        // Configure mouse controls
        const pointerInput = this.camera.inputs.attached.pointers;
        if (pointerInput && 'buttons' in pointerInput) {
            // Right mouse button for rotation
            (pointerInput as any).buttons = [0, 1, 2]; // Left, middle, right mouse buttons
        }

        // Configure keyboard controls for camera movement
        const keyboardInput = this.camera.inputs.attached.keyboard;
        if (keyboardInput && 'keysUp' in keyboardInput) {
            // WASD keys for camera panning
            (keyboardInput as any).keysUp = [87]; // W
            (keyboardInput as any).keysDown = [83]; // S
            (keyboardInput as any).keysLeft = [65]; // A
            (keyboardInput as any).keysRight = [68]; // D
        }

        // Add custom input handling for edge scrolling (future enhancement)
        this.setupEdgeScrolling();

        console.log('🎮 Camera controls configured');
    }

    /**
     * Set camera target position
     */
    public setCameraTarget(target: Vector3): void {
        if (this.camera) {
            this.camera.setTarget(target);
            console.log(`📷 Camera target set to: ${target.toString()}`);
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

        console.log('🖱️ Edge scrolling setup (placeholder)');
    }

    /**
     * Get the current camera
     */
    public getCamera(): ArcRotateCamera | null {
        return this.camera;
    }

    /**
     * Set camera target position
     */
    public setCameraTarget(position: Vector3): void {
        if (this.camera) {
            this.camera.setTarget(position);
        }
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

        console.log('🔄 Camera reset to default position');
    }

    /**
     * Dispose camera resources
     */
    public dispose(): void {
        if (this.camera) {
            console.log('🗑️ Disposing camera...');
            
            this.camera.dispose();
            this.camera = null;
            
            console.log('✅ Camera disposed');
        }
    }
}