/**
 * TerritoryUIStyles - CSS styles for territory visual UI
 *
 * Handles injection of CSS styles for territory visualization.
 */

export function injectTerritoryUIStyles(): void {
    if (document.querySelector('#territory-visual-ui-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'territory-visual-ui-styles';
    style.textContent = `
        .territory-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-weight: 700;
            font-size: 12px;
        }

        .territory-coords {
            color: #aaaaaa;
            font-size: 10px;
            font-weight: 600;
        }

        .territory-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-queen-controlled {
            background: rgba(255, 0, 0, 0.8);
            color: #fff;
            border: 1px solid rgba(255, 0, 0, 0.6);
            animation: pulse-danger 2s infinite;
        }

        .status-liberated {
            background: rgba(0, 255, 0, 0.8);
            color: #fff;
            border: 1px solid rgba(0, 255, 0, 0.6);
            animation: pulse-safe 3s infinite;
        }

        .status-contested {
            background: rgba(255, 165, 0, 0.8);
            color: #fff;
            border: 1px solid rgba(255, 165, 0, 0.6);
        }

        .liberation-timer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 8px 0;
        }

        .timer-display {
            font-size: 16px;
            font-weight: 700;
            color: #00ff00;
            text-shadow: 0 0 8px rgba(0, 255, 0, 0.8);
        }

        .mining-bonus {
            font-size: 10px;
            color: #ffff00;
            font-weight: 600;
        }

        .queen-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 6px 0;
        }

        .queen-phase {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .phase-underground {
            background: rgba(139, 69, 19, 0.8);
            color: #deb887;
            border: 1px solid rgba(139, 69, 19, 0.6);
        }

        .phase-construction {
            background: rgba(255, 165, 0, 0.8);
            color: #fff;
            border: 1px solid rgba(255, 165, 0, 0.6);
        }

        .phase-active {
            background: rgba(255, 0, 0, 0.8);
            color: #fff;
            border: 1px solid rgba(255, 0, 0, 0.6);
            animation: pulse-danger 1.5s infinite;
        }

        .vulnerability-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }

        .vulnerable {
            background: rgba(255, 0, 0, 0.8);
            color: #fff;
            animation: pulse-danger 1s infinite;
        }

        .invulnerable {
            background: rgba(0, 100, 0, 0.8);
            color: #fff;
        }

        .territory-entry-notification.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .territory-entry-notification.hide {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }

        @keyframes pulse-danger {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }

        @keyframes pulse-safe {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }

        .fade-in {
            animation: fadeIn 0.5s ease;
        }

        .fade-out {
            animation: fadeOut 0.5s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }

        @keyframes fadeOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(-20px); }
        }

        .progress-bar {
            width: 100%;
            height: 4px;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 2px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
            margin: 4px 0;
        }

        .progress-fill {
            height: 100%;
            transition: width 0.5s ease;
            border-radius: 1px;
        }

        .progress-liberation {
            background: linear-gradient(90deg,
                rgba(0, 255, 0, 0.8) 0%,
                rgba(0, 255, 255, 0.8) 100%);
        }
    `;
    document.head.appendChild(style);
}
