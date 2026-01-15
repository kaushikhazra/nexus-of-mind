/**
 * VictoryScreen - Full-screen victory celebration when a level is completed
 *
 * Displays the new title earned, upgrade bonus received, and a continue
 * button to restart with upgraded equipment. Shows enhanced celebration
 * for tier completions (every 5th level).
 */

import { VictoryEventData } from '../game/types/EnergyLordsTypes';

export interface VictoryScreenConfig {
    onContinue?: () => void;
}

export class VictoryScreen {
    private container: HTMLElement | null = null;
    private config: VictoryScreenConfig;
    private isVisible: boolean = false;

    constructor(config: VictoryScreenConfig = {}) {
        this.config = config;
        this.initialize();
    }

    /**
     * Initialize the victory screen (hidden by default)
     */
    private initialize(): void {
        // Create overlay container
        this.container = document.createElement('div');
        this.container.id = 'victory-screen';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 0, 20, 0.95);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(10px);
        `;

        document.body.appendChild(this.container);

        // Add animations
        this.addAnimations();
    }

    /**
     * Add CSS animations
     */
    private addAnimations(): void {
        if (!document.querySelector('#victory-screen-animations')) {
            const style = document.createElement('style');
            style.id = 'victory-screen-animations';
            style.textContent = `
                @keyframes victory-fade-in {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }

                @keyframes victory-glow {
                    0%, 100% {
                        text-shadow: 0 0 20px rgba(255, 215, 0, 0.8),
                                     0 0 40px rgba(255, 215, 0, 0.4);
                    }
                    50% {
                        text-shadow: 0 0 40px rgba(255, 215, 0, 1),
                                     0 0 80px rgba(255, 215, 0, 0.6);
                    }
                }

                @keyframes tier-glow {
                    0%, 100% {
                        text-shadow: 0 0 30px rgba(160, 100, 255, 0.8),
                                     0 0 60px rgba(160, 100, 255, 0.4),
                                     0 0 90px rgba(255, 215, 0, 0.3);
                    }
                    50% {
                        text-shadow: 0 0 50px rgba(160, 100, 255, 1),
                                     0 0 100px rgba(160, 100, 255, 0.6),
                                     0 0 150px rgba(255, 215, 0, 0.5);
                    }
                }

                @keyframes star-pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.8; }
                }

                @keyframes tier-star-rotate {
                    0% { transform: rotate(0deg) scale(1); }
                    25% { transform: rotate(5deg) scale(1.1); }
                    50% { transform: rotate(0deg) scale(1.2); }
                    75% { transform: rotate(-5deg) scale(1.1); }
                    100% { transform: rotate(0deg) scale(1); }
                }

                @keyframes confetti {
                    0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }

                @keyframes sparkle {
                    0%, 100% { opacity: 0; transform: scale(0); }
                    50% { opacity: 1; transform: scale(1); }
                }

                .victory-card {
                    animation: victory-fade-in 0.6s ease-out;
                }

                .victory-title {
                    animation: victory-glow 2s infinite;
                }

                .tier-title {
                    animation: tier-glow 1.5s infinite;
                }

                .victory-star {
                    animation: star-pulse 1.5s infinite;
                }

                .tier-star {
                    animation: tier-star-rotate 2s infinite ease-in-out;
                }

                .victory-button {
                    transition: all 0.3s ease;
                }

                .victory-button:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 30px rgba(255, 215, 0, 0.6);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Show the victory screen with victory data
     */
    public show(victoryData: VictoryEventData): void {
        if (!this.container) return;

        this.container.innerHTML = '';

        const isTierCompletion = victoryData.isTierCompletion;

        // Create victory card with tier-specific styling
        const card = document.createElement('div');
        card.className = 'victory-card';
        card.style.cssText = isTierCompletion ? `
            background: linear-gradient(135deg, rgba(60, 20, 100, 0.95) 0%, rgba(100, 50, 150, 0.95) 50%, rgba(60, 20, 100, 0.95) 100%);
            border: 3px solid rgba(160, 100, 255, 0.9);
            border-radius: 16px;
            padding: 40px 60px;
            text-align: center;
            font-family: 'Orbitron', 'Segoe UI', sans-serif;
            color: #ffffff;
            box-shadow: 0 0 80px rgba(160, 100, 255, 0.5),
                        0 0 160px rgba(255, 215, 0, 0.3),
                        inset 0 0 80px rgba(160, 100, 255, 0.1);
            max-width: 500px;
        ` : `
            background: linear-gradient(135deg, rgba(30, 10, 60, 0.95) 0%, rgba(60, 30, 100, 0.95) 100%);
            border: 3px solid rgba(255, 215, 0, 0.8);
            border-radius: 16px;
            padding: 40px 60px;
            text-align: center;
            font-family: 'Orbitron', 'Segoe UI', sans-serif;
            color: #ffffff;
            box-shadow: 0 0 60px rgba(255, 215, 0, 0.3),
                        0 0 120px rgba(150, 100, 255, 0.2),
                        inset 0 0 60px rgba(255, 215, 0, 0.05);
            max-width: 500px;
        `;

        // Tier completion banner (only for tier completions)
        if (isTierCompletion && victoryData.previousTierName) {
            const tierBanner = document.createElement('div');
            tierBanner.style.cssText = `
                background: linear-gradient(90deg, transparent, rgba(160, 100, 255, 0.3), transparent);
                padding: 10px 30px;
                margin: -40px -60px 20px -60px;
                border-radius: 13px 13px 0 0;
                border-bottom: 2px solid rgba(160, 100, 255, 0.5);
            `;

            const tierBannerText = document.createElement('div');
            tierBannerText.className = 'tier-title';
            tierBannerText.style.cssText = `
                font-size: 16px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 4px;
                color: #a080ff;
            `;
            tierBannerText.textContent = 'NEW TIER UNLOCKED!';

            tierBanner.appendChild(tierBannerText);
            card.appendChild(tierBanner);

            // Mastered tier text
            const masteredText = document.createElement('div');
            masteredText.style.cssText = `
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 2px;
                color: rgba(255, 215, 0, 0.9);
                margin-bottom: 15px;
            `;
            masteredText.textContent = `${victoryData.previousTierName} MASTERED`;
            card.appendChild(masteredText);
        }

        // Star decoration
        const star = document.createElement('div');
        star.className = isTierCompletion ? 'tier-star' : 'victory-star';
        star.style.cssText = `
            font-size: ${isTierCompletion ? '64px' : '48px'};
            margin-bottom: 20px;
            color: ${isTierCompletion ? '#a080ff' : '#ffd700'};
        `;
        star.textContent = isTierCompletion ? '\u2726' : '\u2605'; // Unicode stars

        // Achievement text
        const achievementText = document.createElement('div');
        achievementText.style.cssText = `
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 4px;
            color: rgba(255, 215, 0, 0.9);
            margin-bottom: 10px;
        `;
        achievementText.textContent = isTierCompletion ? 'TIER COMPLETE' : 'LEVEL COMPLETE';

        // Separator
        const separator = document.createElement('div');
        separator.style.cssText = `
            width: 100px;
            height: 2px;
            background: linear-gradient(90deg, transparent, ${isTierCompletion ? 'rgba(160, 100, 255, 0.8)' : 'rgba(255, 215, 0, 0.8)'}, transparent);
            margin: 15px auto;
        `;

        // "You are now" text
        const youAreNow = document.createElement('div');
        youAreNow.style.cssText = `
            font-size: 16px;
            color: rgba(200, 180, 255, 0.9);
            margin-bottom: 10px;
        `;
        youAreNow.textContent = isTierCompletion ? 'You have ascended to' : 'You are now';

        // New title
        const titleElement = document.createElement('div');
        titleElement.className = isTierCompletion ? 'tier-title' : 'victory-title';
        titleElement.style.cssText = `
            font-size: ${isTierCompletion ? '42px' : '36px'};
            font-weight: 700;
            color: ${isTierCompletion ? '#a080ff' : '#ffd700'};
            margin-bottom: 30px;
            text-transform: uppercase;
            letter-spacing: 2px;
        `;
        titleElement.textContent = victoryData.newTitle;

        // Upgrade info
        const upgradeInfo = document.createElement('div');
        upgradeInfo.style.cssText = `
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid rgba(0, 255, 136, 0.3);
            border-radius: 8px;
            padding: 15px 25px;
            margin-bottom: 30px;
        `;

        const upgradeTitle = document.createElement('div');
        upgradeTitle.style.cssText = `
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: rgba(0, 255, 136, 0.8);
            margin-bottom: 8px;
        `;
        upgradeTitle.textContent = 'Power Generator Upgraded';

        const upgradeValue = document.createElement('div');
        upgradeValue.style.cssText = `
            font-size: ${isTierCompletion ? '28px' : '24px'};
            font-weight: 700;
            color: #00ff88;
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
        `;
        upgradeValue.textContent = `+${victoryData.upgradeBonus}%`;

        // Bonus indicator for tier completion
        if (isTierCompletion) {
            const bonusIndicator = document.createElement('div');
            bonusIndicator.style.cssText = `
                font-size: 10px;
                color: #ffd700;
                margin-top: 4px;
                text-transform: uppercase;
                letter-spacing: 1px;
            `;
            bonusIndicator.textContent = 'TIER BONUS!';
            upgradeInfo.appendChild(upgradeTitle);
            upgradeInfo.appendChild(upgradeValue);
            upgradeInfo.appendChild(bonusIndicator);
        } else {
            upgradeInfo.appendChild(upgradeTitle);
            upgradeInfo.appendChild(upgradeValue);
        }

        const totalUpgrade = document.createElement('div');
        totalUpgrade.style.cssText = `
            font-size: 11px;
            color: rgba(0, 255, 136, 0.7);
            margin-top: 5px;
        `;
        totalUpgrade.textContent = `Total Bonus: +${victoryData.totalUpgradeBonus.toFixed(1)}%`;

        upgradeInfo.appendChild(totalUpgrade);

        // Continue button
        const continueButton = document.createElement('button');
        continueButton.className = 'victory-button';
        continueButton.style.cssText = `
            background: linear-gradient(135deg, ${isTierCompletion ? '#a080ff 0%, #8060dd 100%' : '#ffd700 0%, #ffaa00 100%'});
            border: none;
            border-radius: 8px;
            padding: 15px 40px;
            font-family: 'Orbitron', 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: ${isTierCompletion ? '#ffffff' : '#1a0033'};
            text-transform: uppercase;
            letter-spacing: 2px;
            cursor: pointer;
            box-shadow: 0 0 20px ${isTierCompletion ? 'rgba(160, 100, 255, 0.4)' : 'rgba(255, 215, 0, 0.4)'};
        `;
        continueButton.textContent = 'Continue to Next Challenge';

        continueButton.addEventListener('click', () => {
            this.hide();
            if (this.config.onContinue) {
                this.config.onContinue();
            }
        });

        // Level indicator
        const levelIndicator = document.createElement('div');
        levelIndicator.style.cssText = `
            margin-top: 20px;
            font-size: 11px;
            color: rgba(180, 160, 255, 0.6);
        `;
        levelIndicator.textContent = `Level ${victoryData.levelCompleted} Complete`;

        // Next tier preview (for tier completions)
        if (isTierCompletion && victoryData.newTierName) {
            const nextTierPreview = document.createElement('div');
            nextTierPreview.style.cssText = `
                margin-top: 10px;
                font-size: 12px;
                color: rgba(160, 130, 255, 0.8);
            `;
            nextTierPreview.textContent = `Next: ${victoryData.newTierName} Tier`;
            levelIndicator.appendChild(document.createElement('br'));
            levelIndicator.appendChild(nextTierPreview);
        }

        // Assemble card (tier banner already added if applicable)
        card.appendChild(star);
        card.appendChild(achievementText);
        card.appendChild(separator);
        card.appendChild(youAreNow);
        card.appendChild(titleElement);
        card.appendChild(upgradeInfo);
        card.appendChild(continueButton);
        card.appendChild(levelIndicator);

        this.container.appendChild(card);

        // Show the screen
        this.container.style.display = 'flex';
        this.isVisible = true;

        // Add confetti effect (more for tier completion)
        this.createConfetti(isTierCompletion);
    }

    /**
     * Create confetti effect
     */
    private createConfetti(isTierCompletion: boolean = false): void {
        const colors = isTierCompletion
            ? ['#a080ff', '#ffd700', '#8060dd', '#ff6b6b', '#00ff88', '#ffffff']
            : ['#ffd700', '#ff6b6b', '#4ecdc4', '#a855f7', '#00ff88'];
        const confettiCount = isTierCompletion ? 80 : 50;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                top: -20px;
                left: ${Math.random() * 100}%;
                width: ${5 + Math.random() * 10}px;
                height: ${5 + Math.random() * 10}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                opacity: 0.8;
                z-index: 10001;
                pointer-events: none;
                animation: confetti ${2 + Math.random() * 3}s linear forwards;
                animation-delay: ${Math.random() * 2}s;
            `;

            document.body.appendChild(confetti);

            // Remove confetti after animation
            setTimeout(() => {
                confetti.remove();
            }, 5000);
        }

        // Add sparkles for tier completion
        if (isTierCompletion) {
            this.createSparkles();
        }
    }

    /**
     * Create sparkle effect for tier completions
     */
    private createSparkles(): void {
        for (let i = 0; i < 20; i++) {
            const sparkle = document.createElement('div');
            sparkle.style.cssText = `
                position: fixed;
                top: ${20 + Math.random() * 60}%;
                left: ${20 + Math.random() * 60}%;
                width: 4px;
                height: 4px;
                background: #ffffff;
                border-radius: 50%;
                z-index: 10002;
                pointer-events: none;
                animation: sparkle ${0.5 + Math.random() * 1}s ease-in-out infinite;
                animation-delay: ${Math.random() * 2}s;
                box-shadow: 0 0 10px #ffffff, 0 0 20px #a080ff;
            `;

            document.body.appendChild(sparkle);

            // Remove sparkles after some time
            setTimeout(() => {
                sparkle.remove();
            }, 6000);
        }
    }

    /**
     * Hide the victory screen
     */
    public hide(): void {
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.isVisible = false;
    }

    /**
     * Check if victory screen is visible
     */
    public getIsVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Set the continue callback
     */
    public setOnContinue(callback: () => void): void {
        this.config.onContinue = callback;
    }

    /**
     * Dispose the victory screen
     */
    public dispose(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
}
