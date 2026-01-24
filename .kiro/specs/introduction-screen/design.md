# Design Document: Introduction Screen

## Overview

The Introduction Screen feature provides an immersive narrative experience that introduces players to the Korenthi Empire's lore and the game's core premise. This feature displays a multi-page story with typewriter animation effects, allowing players to understand the context behind their role as an Energy Lord before beginning gameplay.

The screen integrates seamlessly with the existing game initialization flow and follows the established SciFi aesthetic of the Nexus of Mind interface. Players can navigate through the story at their own pace and optionally skip future presentations via a persistent preference system.

## Architecture

### Component Structure

The Introduction Screen follows the established UI component pattern used throughout the game:

```
IntroductionScreen
├── IntroductionScreenManager (Core Logic)
├── StoryPageRenderer (Page Display)
├── TypewriterEffect (Text Animation)
├── NavigationControls (Buttons & Checkbox)
├── PreferenceManager (Local Storage)
└── IntroductionModelRenderer (3D Model Visualization)
    ├── EmblemGeometry (Empire & Energy Lords Emblems)
    ├── PlanetRenderer (Desert Planet & Orbital Ship)
    ├── TerrainRenderer (Close-up Terrain View)
    └── ParasiteRenderer (Organic Parasite Models)
```

### Integration Points

- **Game Initialization**: Integrates with `main.ts` Application class initialization flow
- **Local Storage**: Uses browser localStorage for preference persistence
- **UI Styling**: Follows existing component patterns from EnergyDisplay, EnergyLordsHUD, etc.
- **Story Content**: References external `story.md` file for narrative content
- **Babylon.js Engine**: Integrates with existing game engine for 3D model rendering
- **MaterialManager**: Reuses existing SciFi materials and terrain textures
- **SceneManager**: Leverages existing scene management for model rendering
- **TerrainGenerator**: Utilizes existing terrain generation for close-up views

### Data Flow

1. **Initialization**: Check localStorage for "skipIntroduction" preference
2. **Story Loading**: Load story content from story.md structure
3. **Page Rendering**: Display current page with typewriter effect
4. **User Interaction**: Handle navigation and preference updates
5. **Game Transition**: Seamlessly transition to main game on completion

## Components and Interfaces

### IntroductionScreen Class

```typescript
export interface IntroductionScreenConfig {
    containerId: string;
    onComplete: () => void;
    skipPreferenceKey?: string;
}

export class IntroductionScreen {
    private container: HTMLElement | null = null;
    private config: IntroductionScreenConfig;
    private storyPages: StoryPage[];
    private currentPageIndex: number = 0;
    private typewriterEffect: TypewriterEffect;
    private preferenceManager: PreferenceManager;
    
    // UI Elements
    private pageContainer: HTMLElement | null = null;
    private titleElement: HTMLElement | null = null;
    private contentElement: HTMLElement | null = null;
    private nextButton: HTMLElement | null = null;
    private skipCheckbox: HTMLElement | null = null;
    
    constructor(config: IntroductionScreenConfig);
    public show(): void;
    public hide(): void;
    public dispose(): void;
}
```

### StoryPage Interface

```typescript
export interface StoryPage {
    title: string;
    content: string;
    isLastPage: boolean;
}
```

### TypewriterEffect Class

```typescript
export class TypewriterEffect {
    private element: HTMLElement;
    private text: string;
    private speed: number;
    private onComplete: () => void;
    
    constructor(element: HTMLElement, speed?: number);
    public typeText(text: string, onComplete: () => void): void;
    public stop(): void;
    public isComplete(): boolean;
}
```

### PreferenceManager Class

```typescript
export class PreferenceManager {
    private storageKey: string;
    
    constructor(storageKey: string);
    public getSkipIntroduction(): boolean;
    public setSkipIntroduction(skip: boolean): void;
    public clearPreferences(): void;
}
```

### TextColorizer Class

```typescript
export interface ColorTheme {
    primaryText: string;
    empireOrganization: string;
    technology: string;
    threat: string;
    systems: string;
}

export interface ColorRule {
    pattern: RegExp;
    color: string;
    category: 'empire' | 'technology' | 'threat' | 'systems';
}

export class TextColorizer {
    private colorTheme: ColorTheme;
    private colorRules: ColorRule[];
    
    constructor(theme?: Partial<ColorTheme>);
    public colorizeText(text: string): string;
    public addColorRule(pattern: RegExp, category: string): void;
    public setTheme(theme: Partial<ColorTheme>): void;
    private applyColorRules(text: string): string;
    private wrapWithColor(text: string, color: string): string;
}
```

### IntroductionModelRenderer Class

```typescript
export interface ModelConfig {
    pageIndex: number;
    modelType: 'empire-emblem' | 'desert-planet' | 'terrain-closeup' | 'energy-lords-emblem' | 'parasites' | 'orbital-system';
    containerWidth: number;
    containerHeight: number;
}

export interface ModelAnimation {
    rotationSpeed: number; // RPM
    additionalEffects?: 'pulsing' | 'writhing' | 'orbital' | 'mining-beam';
}

export class IntroductionModelRenderer {
    private canvas: HTMLCanvasElement;
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene;
    private camera: BABYLON.ArcRotateCamera;
    private currentModel: BABYLON.AbstractMesh | null = null;
    private materialManager: MaterialManager;
    private animationGroup: BABYLON.AnimationGroup | null = null;
    
    constructor(container: HTMLElement, materialManager: MaterialManager);
    public loadModelForPage(pageIndex: number): Promise<void>;
    public startAnimation(): void;
    public stopAnimation(): void;
    public dispose(): void;
    
    private createEmpireEmblem(): BABYLON.AbstractMesh;
    private createDesertPlanet(): BABYLON.AbstractMesh;
    private createTerrainCloseup(): BABYLON.AbstractMesh;
    private createEnergyLordsEmblem(): BABYLON.AbstractMesh;
    private createParasiteModels(): BABYLON.AbstractMesh;
    private createOrbitalSystem(): BABYLON.AbstractMesh;
    
    private setupLighting(): void;
    private setupPostProcessing(): void;
    private createRotationAnimation(mesh: BABYLON.AbstractMesh, speed: number): BABYLON.Animation;
}
```

### EmblemGeometry Class

```typescript
export interface EmblemDesign {
    primaryShape: 'hexagon' | 'octagon' | 'star' | 'diamond';
    innerElements: ('ring' | 'cross' | 'triangle' | 'circle')[];
    glowIntensity: number;
    colors: {
        primary: string;
        secondary: string;
        glow: string;
    };
}

export class EmblemGeometry {
    private scene: BABYLON.Scene;
    private materialManager: MaterialManager;
    
    constructor(scene: BABYLON.Scene, materialManager: MaterialManager);
    public createEmpireEmblem(): BABYLON.AbstractMesh;
    public createEnergyLordsEmblem(): BABYLON.AbstractMesh;
    
    private createGeometricShape(design: EmblemDesign): BABYLON.AbstractMesh;
    private applyNeonGlowMaterial(mesh: BABYLON.AbstractMesh, colors: any): void;
    private addPulsingAnimation(mesh: BABYLON.AbstractMesh): BABYLON.Animation;
}
```

### PlanetRenderer Class

```typescript
export interface PlanetConfig {
    radius: number;
    textureType: 'desert' | 'toxic';
    atmosphereGlow: boolean;
    cloudLayer: boolean;
    rotationSpeed: number;
}

export interface OrbitingShip {
    shipModel: BABYLON.AbstractMesh;
    orbitRadius: number;
    orbitSpeed: number;
    miningBeam: boolean;
}

export class PlanetRenderer {
    private scene: BABYLON.Scene;
    private materialManager: MaterialManager;
    
    constructor(scene: BABYLON.Scene, materialManager: MaterialManager);
    public createDesertPlanet(config: PlanetConfig): BABYLON.AbstractMesh;
    public createOrbitalSystem(planet: BABYLON.AbstractMesh): OrbitingShip;
    
    private createAtmosphereGlow(planet: BABYLON.AbstractMesh): BABYLON.AbstractMesh;
    private createCloudLayer(planet: BABYLON.AbstractMesh): BABYLON.AbstractMesh;
    private createMiningShip(): BABYLON.AbstractMesh;
    private createMiningBeam(ship: BABYLON.AbstractMesh, planet: BABYLON.AbstractMesh): BABYLON.AbstractMesh;
    private setupOrbitalAnimation(ship: BABYLON.AbstractMesh, radius: number, speed: number): BABYLON.Animation;
}
```

### TerrainRenderer Class

```typescript
export interface TerrainConfig {
    chunkSize: number;
    heightScale: number;
    mineralDeposits: boolean;
    atmosphericEffects: boolean;
    toxicGlow: boolean;
}

export class TerrainRenderer {
    private scene: BABYLON.Scene;
    private materialManager: MaterialManager;
    private terrainGenerator: TerrainGenerator;
    
    constructor(scene: BABYLON.Scene, materialManager: MaterialManager, terrainGenerator: TerrainGenerator);
    public createTerrainCloseup(config: TerrainConfig): BABYLON.AbstractMesh;
    
    private generateMiniTerrain(size: number): BABYLON.AbstractMesh;
    private addMineralDeposits(terrain: BABYLON.AbstractMesh): BABYLON.AbstractMesh[];
    private createAtmosphericParticles(): BABYLON.ParticleSystem;
    private addToxicGlowEffect(terrain: BABYLON.AbstractMesh): void;
}
```

### ParasiteRenderer Class

```typescript
export interface ParasiteConfig {
    count: number;
    organicShapes: ('blob' | 'tendril' | 'spore' | 'cluster')[];
    pulsing: boolean;
    writhing: boolean;
    redVeins: boolean;
}

export class ParasiteRenderer {
    private scene: BABYLON.Scene;
    private materialManager: MaterialManager;
    
    constructor(scene: BABYLON.Scene, materialManager: MaterialManager);
    public createParasiteGroup(config: ParasiteConfig): BABYLON.AbstractMesh;
    
    private createOrganicBlob(): BABYLON.AbstractMesh;
    private createTendrilShape(): BABYLON.AbstractMesh;
    private createSporeCluster(): BABYLON.AbstractMesh;
    private applyOrganicMaterial(mesh: BABYLON.AbstractMesh): void;
    private addPulsingVeins(mesh: BABYLON.AbstractMesh): void;
    private createWrithingAnimation(mesh: BABYLON.AbstractMesh): BABYLON.Animation;
}
```

## Data Models

### Story Content Structure

The story content is structured as an array of pages, each containing:

```typescript
interface StoryContent {
    pages: StoryPage[];
    metadata: {
        empireName: string;
        guildName: string;
        version: string;
    };
}
```

### Story Pages

Based on the story.md file, the content is divided into 6 logical pages:

1. **The Empire and the Crisis** - Introduction to Korenthi Empire and energy crisis
2. **The Discovery** - Discovery of the mineral-rich planet
3. **The Challenge** - Toxic environment and orbital mining solution
4. **The Energy Lords** - Formation of the guild and player's role
5. **The Threat** - Introduction to parasites and hive mind
6. **Your Mission** - Final mission briefing and call to action

### UI State Management

```typescript
interface IntroductionState {
    currentPage: number;
    isTypewriterActive: boolean;
    skipIntroduction: boolean;
    isVisible: boolean;
    modelRenderer: IntroductionModelRenderer | null;
    isModelLoading: boolean;
    currentModelType: ModelType | null;
}

interface ModelType {
    pageIndex: number;
    type: 'empire-emblem' | 'desert-planet' | 'terrain-closeup' | 'energy-lords-emblem' | 'parasites' | 'orbital-system';
    config: ModelConfig;
    animation: ModelAnimation;
}
```

### 3D Model Configuration

```typescript
interface ModelPageMapping {
    [pageIndex: number]: {
        modelType: string;
        description: string;
        complexity: 'easy' | 'medium' | 'hard';
        config: ModelConfig;
        animation: ModelAnimation;
    };
}

const MODEL_CONFIGURATIONS: ModelPageMapping = {
    0: { // Page 1: The Empire and the Crisis
        modelType: 'empire-emblem',
        description: 'Korenthi Empire emblem with neon glow effects',
        complexity: 'easy',
        config: {
            pageIndex: 0,
            modelType: 'empire-emblem',
            containerWidth: 300,
            containerHeight: 400
        },
        animation: {
            rotationSpeed: 0.5, // 0.5 RPM
            additionalEffects: 'pulsing'
        }
    },
    1: { // Page 2: The Discovery
        modelType: 'desert-planet',
        description: 'Desert planet using existing terrain textures',
        complexity: 'medium',
        config: {
            pageIndex: 1,
            modelType: 'desert-planet',
            containerWidth: 300,
            containerHeight: 400
        },
        animation: {
            rotationSpeed: 0.5
        }
    },
    2: { // Page 3: The Challenge
        modelType: 'terrain-closeup',
        description: 'Close-up terrain with mineral deposits and atmospheric effects',
        complexity: 'hard',
        config: {
            pageIndex: 2,
            modelType: 'terrain-closeup',
            containerWidth: 300,
            containerHeight: 400
        },
        animation: {
            rotationSpeed: 0.3
        }
    },
    3: { // Page 4: The Energy Lords
        modelType: 'energy-lords-emblem',
        description: 'Energy Lords guild emblem with cyan/gold neon effects',
        complexity: 'easy',
        config: {
            pageIndex: 3,
            modelType: 'energy-lords-emblem',
            containerWidth: 300,
            containerHeight: 400
        },
        animation: {
            rotationSpeed: 0.5,
            additionalEffects: 'pulsing'
        }
    },
    4: { // Page 5: The Threat
        modelType: 'parasites',
        description: 'Organic parasite models with dark materials and red pulsing effects',
        complexity: 'medium',
        config: {
            pageIndex: 4,
            modelType: 'parasites',
            containerWidth: 300,
            containerHeight: 400
        },
        animation: {
            rotationSpeed: 0.4,
            additionalEffects: 'writhing'
        }
    },
    5: { // Page 6: Your Mission
        modelType: 'orbital-system',
        description: 'Planet with orbiting mining ship and energy beam connections',
        complexity: 'hard',
        config: {
            pageIndex: 5,
            modelType: 'orbital-system',
            containerWidth: 300,
            containerHeight: 400
        },
        animation: {
            rotationSpeed: 0.5,
            additionalEffects: 'orbital'
        }
    }
};
```

### Text Coloring System

The text coloring system enhances readability and visual hierarchy through contextual color application:

```typescript
interface ColorConfiguration {
    theme: {
        primaryText: '#f0f4f8';        // Light grey-white for main content
        empireOrganization: '#00ffff';  // Cyan for empire/organization names
        technology: '#ffd700';          // Soft gold for tech concepts
        threat: '#ff6b6b';              // Soft red for threats/dangers
        systems: '#4ecdc4';             // Soft green for systems/technology
    };
    
    colorRules: {
        empire: ['Korenthi Empire', 'The Energy Lords', 'Korenthi'];
        technology: ['Artificial Consciousness', 'quantum tunneling', 'consciousness interfaces'];
        threat: ['parasites', 'Queen consciousness', 'hive mind', 'adaptive intelligence'];
        systems: ['orbital mining system', 'energy sources', 'mining operations', 'robotic ships'];
    };
}
```

### Color Application Strategy

1. **Base Text**: All story content uses the primary text color for optimal readability
2. **Keyword Detection**: Pattern matching identifies key terms for color highlighting
3. **HTML Wrapping**: Colored terms are wrapped in `<span>` elements with inline styles
4. **Animation Compatibility**: Colored HTML content works seamlessly with typewriter effects
5. **Accessibility**: All color combinations maintain WCAG AA contrast ratios

## Error Handling

### Graceful Degradation

- **Missing Story Content**: Display fallback message and proceed to game
- **LocalStorage Unavailable**: Continue without preference persistence
- **Animation Failures**: Fall back to instant text display
- **UI Container Missing**: Create container dynamically

### Error Recovery

- **Typewriter Interruption**: Allow immediate completion on user interaction
- **Navigation Failures**: Provide alternative navigation methods
- **Preference Save Failures**: Log error but continue functionality

## Testing Strategy

### Unit Testing Approach

**Core Component Tests**:
- IntroductionScreen initialization and lifecycle
- TypewriterEffect timing and completion
- PreferenceManager localStorage operations
- Story content parsing and validation

**UI Interaction Tests**:
- Navigation button functionality
- Checkbox state management
- Page transitions and animations
- Responsive layout behavior

**Integration Tests**:
- Game initialization flow integration
- Story content loading and display
- Preference persistence across sessions
- Error handling and recovery scenarios

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Story Content Completeness
*For any* story content structure, the Introduction Screen should display all required narrative elements including the Korenthi Empire crisis, Energy Lords guild formation, orbital mining technology, and parasite threat information
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

### Property 2: Story Pagination Consistency  
*For any* story content, the Introduction Screen should divide it into logical pages with proper navigation sequence
**Validates: Requirements 2.2**

### Property 3: Typewriter Animation Behavior
*For any* text content and page, the typewriter effect should animate character-by-character with consistent timing regardless of text length
**Validates: Requirements 2.1, 7.2**

### Property 4: Navigation State Management
*For any* page in the story sequence, the Next button should be disabled during typewriter animation and enabled immediately upon completion, responding to clicks within the expected timeframe
**Validates: Requirements 2.3, 2.4, 6.1, 6.2**

### Property 5: Preference Persistence Consistency
*For any* checkbox state change, the preference system should store the "Don't show again" setting locally and respect it across all future game launches
**Validates: Requirements 3.2, 3.3, 3.4**

### Property 6: UI Element Presence Consistency
*For any* page displayed, the Introduction Screen should include a "Don't show again" checkbox that can be toggled at any time during the presentation
**Validates: Requirements 3.1, 6.4**

### Property 7: Visual Styling Consistency
*For any* UI element created, the Introduction Screen should apply the established SciFi aesthetic including Orbitron font, cyan/teal borders, dark backgrounds with blur effects, and consistent button hover states
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**

### Property 8: Game Integration Behavior
*For any* preference state at game launch, the initialization system should check the preference and conditionally display the Introduction Screen before proceeding to the main game
**Validates: Requirements 5.1, 5.2**

### Property 9: Interactive Element Responsiveness
*For any* interactive element (buttons, checkboxes), the Introduction Screen should provide appropriate visual feedback for hover states and maintain accessibility
**Validates: Requirements 6.3**

### Property 10: Responsive Layout Consistency
*For any* screen size or resolution, the Introduction Screen should maintain proper layout and readability without breaking the visual design
**Validates: Requirements 7.5**

### Property 11: Text Coloring Consistency
*For any* story content containing key narrative terms, the TextColorizer should apply contextually appropriate colors while maintaining the primary text readability and preserving the SciFi aesthetic
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8**

### Property 12: Color Animation Compatibility
*For any* colored text content, the typewriter animation should display colored HTML elements correctly without breaking the animation flow or color rendering
**Validates: Requirements 8.9, 8.10**

### Property 13: 3D Model Rendering Consistency
*For any* story page displayed, the Introduction Screen should render the contextually appropriate 3D model in the dedicated 300px model area with proper lighting and materials
**Validates: Requirements 9.1, 9.2**

### Property 14: Model Animation Behavior
*For any* 3D model loaded, the model should animate with slow rotation at approximately 0.5 RPM and any additional effects specific to the model type
**Validates: Requirements 9.3**

### Property 15: Model Performance Consistency
*For any* 3D model rendered, the Introduction Screen should maintain 60fps performance and load models efficiently for the current page only
**Validates: Requirements 9.6, 9.8**

### Property 16: Layout Integration Consistency
*For any* screen size, the Introduction Screen should properly integrate the 3D model area with the story content area, including the soft dividing line with SciFi glow effect
**Validates: Requirements 9.4, 9.7**

### Property 17: Asset Reuse Consistency
*For any* 3D model created, the system should utilize existing game assets (MaterialManager, terrain textures, Babylon.js engine) for visual consistency with the main game
**Validates: Requirements 9.5, 9.9, 9.10**

### Example Test Cases

**Final Page Continue Button**: The last page should display "Continue" instead of "Next" button
**Validates: Requirements 2.5**

**Black Background Styling**: The Introduction Screen should use a black background for the entire screen
**Validates: Requirements 4.5**

**Preference Reset Functionality**: The Introduction Screen should provide a mechanism to reset the "Don't show again" preference for testing purposes
**Validates: Requirements 3.5**

**Game Transition on Completion**: When the player clicks "Continue" on the final page, the Introduction Screen should transition to the main game
**Validates: Requirements 5.3**

**Empire Emblem Model Loading**: Page 1 should load and display the Korenthi Empire emblem with neon glow effects and slow rotation
**Validates: Requirements 9.2**

**Desert Planet Texture Mapping**: Page 2 should display a desert planet using existing terrain textures with proper UV mapping
**Validates: Requirements 9.2, 9.5**

**Model Area Layout**: Each page should display a 300px wide model area on the left with a soft dividing line separating it from story content
**Validates: Requirements 9.1, 9.4**

**Responsive Model Collapse**: On mobile devices, the model area should collapse to provide more space for story content
**Validates: Requirements 9.7**

**Performance During Model Rendering**: The Introduction Screen should maintain smooth performance while rendering 3D models
**Validates: Requirements 9.6**

## Testing Strategy

### Dual Testing Approach

The Introduction Screen feature requires both unit testing and property-based testing for comprehensive coverage:

**Unit Tests** focus on:
- Specific UI interactions and state transitions
- Edge cases like empty story content or missing containers
- Integration points with game initialization
- Error handling and recovery scenarios
- Specific examples like final page behavior and preference reset

**Property Tests** focus on:
- Universal behaviors across all story content and pages
- Consistent styling and animation behavior
- Preference persistence across different states
- Navigation behavior for any valid page sequence
- Responsive design across different viewport sizes

### Property-Based Testing Configuration

- **Testing Library**: Use fast-check for TypeScript property-based testing
- **Test Iterations**: Minimum 100 iterations per property test
- **Test Tagging**: Each property test references its design document property
- **Tag Format**: `Feature: introduction-screen, Property {number}: {property_text}`

### Unit Testing Balance

Unit tests complement property tests by:
- Testing specific UI states and transitions that are difficult to generate randomly
- Validating integration with external systems (localStorage, game initialization)
- Testing error conditions and edge cases
- Verifying specific visual requirements and accessibility features

Property tests handle:
- Comprehensive input coverage through randomized story content
- Universal behavior validation across all possible states
- Consistent behavior verification regardless of content variations
- Scalable testing of UI responsiveness and styling consistency

### Test Coverage Strategy

**Core Functionality Coverage**:
- Story content loading and display (Property 1, 2)
- Typewriter animation behavior (Property 3)
- Navigation and state management (Property 4)
- Preference persistence (Property 5, 6)

**UI and Integration Coverage**:
- Visual styling consistency (Property 7)
- Game initialization integration (Property 8)
- Interactive element behavior (Property 9)
- Responsive design (Property 10)

**Edge Case Coverage**:
- Missing or malformed story content
- LocalStorage unavailability
- Container element missing
- Animation interruption scenarios
- Rapid user interactions

Each property test will run with a minimum of 100 iterations to ensure comprehensive coverage of the input space, while unit tests will focus on specific scenarios and integration points that require precise control over test conditions.