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
     * Setup camera input controls with custom RTS-style navigation
     */
    private setupCameraControls(): void {
        if (!this.camera) return;

        // Remove default inputs to implement custom controls
        this.camera.inputs.clear();
        
        // Add only mouse wheel for zooming
        this.camera.inputs.addMouseWheel();
        
        // Add custom pointer input for mouse controls
        this.setupCustomMouseControls();
        
        // Add custom keyboard input for WASD/Arrow movement
        this.setupCustomKeyboardControls();

        console.log('🎮 Custom RTS camera controls configured');
    }

    /**
     * Setup custom mouse controls
     */
    private setupCustomMouseControls(): void {
        if (!this.camera || !this.scene) return;

        let isLeftMouseDown = false;
        let isRightMouseDown = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        // Mouse down handler
        this.canvas.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Left mouse button
                isLeftMouseDown = true;
            } else if (event.button === 2) { // Right mouse button
                isRightMouseDown = true;
            }
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        });

        // Mouse up handler
        this.canvas.addEventListener('mouseup', (event) => {
            if (event.button === 0) {
                isLeftMouseDown = false;
            } else if (event.button === 2) {
                isRightMouseDown = false;
            }
        });

        // Mouse move handler
        this.canvas.addEventListener('mousemove', (event) => {
            if (!this.camera) return;

            const deltaX = event.clientX - lastMouseX;
            const deltaY = event.clientY - lastMouseY;

            if (isLeftMouseDown) {
                // Left click + drag: Tilt camera up/down (change beta angle)
                const sensitivity = 0.01;
                this.camera.beta += deltaY * sensitivity;
                
                // Clamp beta to prevent flipping
                this.camera.beta = Math.max(this.MIN_BETA, Math.min(this.MAX_BETA, this.camera.beta));
            }

            if (isRightMouseDown) {
                // Right click + drag: Rotate camera around target (change alpha angle)
                const sensitivity = 0.01;
                this.camera.alpha -= deltaX * sensitivity; // Negative for natural rotation
            }

            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        });

        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
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

        // Key down handler
        window.addEventListener('keydown', (event) => {
            pressedKeys.add(event.code);
        });

        // Key up handler
        window.addEventListener('keyup', (event) => {
            pressedKeys.delete(event.code);
        });

        // Update camera position based on pressed keys (called each frame)
        this.scene.registerBeforeRender(() => {
            if (!this.camera) return;

            const target = this.camera.getTarget();
            let moved = false;

            // W/Up Arrow: Move forward in the map
            if (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) {
                const forward = this.camera.getDirection(Vector3.Forward()).scale(moveSpeed);
                const newTarget = target.add(new Vector3(forward.x, 0, forward.z)); // Keep Y constant
                this.camera.setTarget(newTarget);
                moved = true;
            }

            // S/Down Arrow: Move backward in the map
            if (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown')) {
                const backward = this.camera.getDirection(Vector3.Backward()).scale(moveSpeed);
                const newTarget = target.add(new Vector3(backward.x, 0, backward.z)); // Keep Y constant
                this.camera.setTarget(newTarget);
                moved = true;
            }

            // A/Left Arrow: Rotate view to left
            if (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft')) {
                this.camera.alpha -= rotateSpeed;
                moved = true;
            }

            // D/Right Arrow: Rotate view to right
            if (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) {
                this.camera.alpha += rotateSpeed;
                moved = true;
            }

            // Optional: Log movement for debugging
            if (moved) {
                // console.log(`📷 Camera moved - Target: ${this.camera.getTarget().toString()}, Alpha: ${this.camera.alpha.toFixed(2)}`);
            }
        });
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
            
            // Remove event listeners to prevent memory leaks
            // Note: In a production app, we'd store references to the handlers for proper cleanup
            // For now, the handlers will be cleaned up when the page unloads
            
            this.camera.dispose();
            this.camera = null;
            
            console.log('✅ Camera disposed');
        }
    }
}