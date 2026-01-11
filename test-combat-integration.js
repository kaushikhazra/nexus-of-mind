/**
 * Simple integration test to verify core combat mechanics work together
 */

const { Vector3 } = require('@babylonjs/core');
const { CombatSystem } = require('./client/src/game/CombatSystem');
const { EnergyManager } = require('./client/src/game/EnergyManager');
const { Protector } = require('./client/src/game/entities/Protector');
const { EnergyParasite } = require('./client/src/game/entities/EnergyParasite');

// Mock MaterialManager for EnergyParasite
const mockMaterialManager = {
    getParasiteMaterial: () => null
};

// Mock MineralDeposit for EnergyParasite
const mockMineralDeposit = {
    id: 'test-deposit',
    position: new Vector3(0, 0, 0)
};

async function testCombatIntegration() {
    console.log('🧪 Testing Combat System Integration...\n');

    try {
        // 1. Initialize energy system
        const energyManager = EnergyManager.getInstance();
        energyManager.initialize(100); // Start with 100 energy
        console.log('✅ Energy system initialized with 100 energy');

        // 2. Create combat system
        const combatSystem = new CombatSystem(energyManager);
        console.log('✅ Combat system created');

        // 3. Create protector
        const protector = new Protector(new Vector3(0, 0, 0));
        combatSystem.registerProtector(protector);
        console.log('✅ Protector created and registered');

        // 4. Create energy parasite target
        const parasite = new EnergyParasite({
            position: new Vector3(5, 0, 0), // Within range (8 units)
            scene: null, // Mock scene
            materialManager: mockMaterialManager,
            homeDeposit: mockMineralDeposit
        });
        console.log('✅ Energy parasite created at range 5 (within combat range of 8)');

        // 5. Test target validation
        const validation = combatSystem.validateTarget(protector, parasite);
        console.log(`✅ Target validation: ${validation.isValid ? 'VALID' : 'INVALID'} (${validation.reason})`);

        if (!validation.isValid) {
            console.log('❌ Target validation failed - cannot proceed with combat test');
            return false;
        }

        // 6. Test attack initiation
        const attackInitiated = combatSystem.initiateAttack(protector, parasite);
        console.log(`✅ Attack initiation: ${attackInitiated ? 'SUCCESS' : 'FAILED'}`);

        if (!attackInitiated) {
            console.log('❌ Attack initiation failed');
            return false;
        }

        // 7. Check combat state
        const activeCombats = combatSystem.getActiveCombats();
        console.log(`✅ Active combats: ${activeCombats.length}`);

        // 8. Execute attack
        const attackResult = combatSystem.executeAttack(protector, parasite, activeCombats[0]);
        console.log(`✅ Attack execution: ${attackResult.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`   - Damage dealt: ${attackResult.damageDealt}`);
        console.log(`   - Energy consumed: ${attackResult.energyConsumed}`);
        console.log(`   - Target destroyed: ${attackResult.targetDestroyed}`);
        console.log(`   - Energy rewarded: ${attackResult.energyRewarded}`);

        // 9. Check energy levels
        const finalEnergy = energyManager.getTotalEnergy();
        console.log(`✅ Final energy: ${finalEnergy} (started with 100)`);

        // 10. Check parasite health
        console.log(`✅ Parasite health: ${parasite.health}/${parasite.maxHealth}`);

        console.log('\n🎉 Combat system integration test completed successfully!');
        return true;

    } catch (error) {
        console.error('❌ Combat integration test failed:', error);
        return false;
    }
}

// Run the test
testCombatIntegration().then(success => {
    process.exit(success ? 0 : 1);
});