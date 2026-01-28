/**
 * BuildingAnimator - Animation updates for building visuals
 *
 * Handles all building-specific animations including antenna rotation,
 * energy core pulsing, containment ring rotation, and visual effects.
 */

import type { BuildingVisual } from './BuildingRendererInterfaces';
import type { BuildingMaterials } from './BuildingMaterials';

export class BuildingAnimator {
    private materials: BuildingMaterials;

    constructor(materials: BuildingMaterials) {
        this.materials = materials;
    }

    public updateBuildingAnimations(buildingVisual: BuildingVisual): void {
        const building = buildingVisual.building;
        const buildingType = building.getBuildingType();
        const time = performance.now() / 1000;

        if (buildingType.id === 'base') {
            this.updateBaseAnimations(buildingVisual, building, time);
        }

        if (buildingType.id === 'powerPlant') {
            this.updatePowerPlantAnimations(buildingVisual, building, time);
        }
    }

    private updateBaseAnimations(buildingVisual: BuildingVisual, building: any, time: number): void {
        if (buildingVisual.antennaRotator) {
            buildingVisual.antennaRotator.rotation.z += 0.02;
        }

        if (buildingVisual.energyCore && buildingVisual.energyCoreMaterial) {
            const energyStorage = building.getEnergyStorage();

            if (energyStorage) {
                const energyPercent = energyStorage.getCurrentEnergy() / energyStorage.getCapacity();
                const pulseIntensity = 0.3 + energyPercent * 0.7;
                const pulse = Math.sin(time * 2) * 0.15 + 0.85;
                const baseIntensity = pulseIntensity * pulse;

                const emissive = buildingVisual.energyCoreMaterial.emissiveColor;
                emissive.r = 0.3 * baseIntensity;
                emissive.g = 1.2 * baseIntensity;
                emissive.b = 1.5 * baseIntensity;

                const coreScale = 0.95 + pulse * 0.1;
                buildingVisual.energyCore.scaling.set(coreScale, coreScale, coreScale);
            } else {
                const pulse = Math.sin(time * 2) * 0.2 + 0.8;
                const emissive = buildingVisual.energyCoreMaterial.emissiveColor;
                emissive.r = 0.4 * pulse;
                emissive.g = 1.2 * pulse;
                emissive.b = 1.5 * pulse;
            }
        }
    }

    private updatePowerPlantAnimations(buildingVisual: BuildingVisual, building: any, time: number): void {
        if (buildingVisual.containmentRing) {
            buildingVisual.containmentRing.rotation.z += 0.03;
            buildingVisual.containmentRing.rotation.y += 0.015;
        }

        if (buildingVisual.energyCore && buildingVisual.energyCoreMaterial) {
            const energyGeneration = building.getEnergyGeneration();

            const pulseSpeed = 3 + energyGeneration * 0.5;
            const pulse = Math.sin(time * pulseSpeed) * 0.2 + 0.8;

            const emissive = buildingVisual.energyCoreMaterial.emissiveColor;
            emissive.r = 1.5 * pulse;
            emissive.g = 0.9 * pulse;
            emissive.b = 0.3 * pulse;

            const coreScale = 0.9 + pulse * 0.15;
            buildingVisual.energyCore.scaling.set(coreScale, coreScale, coreScale);
        }
    }

    public updateConstructionVisualization(buildingVisual: BuildingVisual): void {
        buildingVisual.mesh.scaling.set(1, 1, 1);
        buildingVisual.constructionIndicator.setEnabled(false);

        if (buildingVisual.material) {
            buildingVisual.material.alpha = 1.0;
        }
    }

    public updateEnergyVisualization(buildingVisual: BuildingVisual): void {
        const building = buildingVisual.building;
        const energyGeneration = building.getEnergyGeneration();

        if (energyGeneration > 0 && building.isComplete() && buildingVisual.energyIndicator) {
            buildingVisual.energyIndicator.setEnabled(true);

            const pulseScale = 1.0 + (energyGeneration * 0.1);
            buildingVisual.energyIndicator.scaling.set(pulseScale, pulseScale, pulseScale);

            if (this.materials.energyIndicatorMaterial) {
                const intensity = Math.min(1.0, energyGeneration / 3.0);
                this.materials.energyIndicatorMaterial.emissiveColor.r = 0;
                this.materials.energyIndicatorMaterial.emissiveColor.g = intensity;
                this.materials.energyIndicatorMaterial.emissiveColor.b = 0;
            }
        } else if (buildingVisual.energyIndicator) {
            buildingVisual.energyIndicator.setEnabled(false);
        }
    }

    public updateHealthVisualization(buildingVisual: BuildingVisual, baseEmissive: { r: number; g: number; b: number } | null): void {
        const healthPercentage = buildingVisual.building.getHealth() / buildingVisual.building.getMaxHealth();

        if (buildingVisual.material && baseEmissive) {
            buildingVisual.material.emissiveColor.r = baseEmissive.r * healthPercentage;
            buildingVisual.material.emissiveColor.g = baseEmissive.g * healthPercentage;
            buildingVisual.material.emissiveColor.b = baseEmissive.b * healthPercentage;
        }
    }
}
