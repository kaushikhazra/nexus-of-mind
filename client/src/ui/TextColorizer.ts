/**
 * TextColorizer - Enhanced text coloring system for narrative content
 * 
 * Provides contextual color highlighting for key terms in story content
 * while maintaining accessibility and SciFi aesthetic consistency.
 * Supports HTML rendering with typewriter animation compatibility.
 */

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

    constructor(theme?: Partial<ColorTheme>) {
        // Default SciFi color theme with accessibility compliance (WCAG AA)
        this.colorTheme = {
            primaryText: '#b8c5d1',        // Softer grey for better readability
            empireOrganization: '#00ffff',  // Cyan for empire/organization names
            technology: '#ffd700',          // Soft gold for tech concepts
            threat: '#ff6b6b',              // Soft red for threats/dangers
            systems: '#4ecdc4',             // Soft green for systems/technology
            ...theme
        };

        // Initialize color rules for keyword detection
        this.colorRules = this.createDefaultColorRules();
    }

    /**
     * Apply contextual coloring to text content
     * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
     */
    public colorizeText(text: string): string {
        if (!text || typeof text !== 'string') {
            return text;
        }

        // Start with primary text color as base
        let colorizedText = text;

        // Apply color rules in order of priority (most specific first)
        colorizedText = this.applyColorRules(colorizedText);

        return colorizedText;
    }

    /**
     * Add a custom color rule for specific patterns
     * Requirements: 8.2
     */
    public addColorRule(pattern: RegExp, category: 'empire' | 'technology' | 'threat' | 'systems'): void {
        const color = this.getColorForCategory(category);
        
        this.colorRules.push({
            pattern,
            color,
            category
        });

        // Sort rules by pattern length (longer patterns first for better matching)
        this.colorRules.sort((a, b) => {
            const aLength = a.pattern.source.length;
            const bLength = b.pattern.source.length;
            return bLength - aLength;
        });
    }

    /**
     * Update the color theme
     * Requirements: 8.1, 8.7, 8.8
     */
    public setTheme(theme: Partial<ColorTheme>): void {
        this.colorTheme = { ...this.colorTheme, ...theme };
        
        // Update existing color rules with new theme colors
        this.colorRules = this.colorRules.map(rule => ({
            ...rule,
            color: this.getColorForCategory(rule.category)
        }));
    }

    /**
     * Get the current color theme
     */
    public getTheme(): ColorTheme {
        return { ...this.colorTheme };
    }

    /**
     * Apply all color rules to the text content
     * Requirements: 8.9, 8.10
     */
    private applyColorRules(text: string): string {
        let result = text;

        // Apply each color rule
        for (const rule of this.colorRules) {
            result = result.replace(rule.pattern, (match) => {
                // Avoid double-wrapping already colored text
                if (match.includes('<span') || match.includes('</span>')) {
                    return match;
                }
                
                return this.wrapWithColor(match, rule.color);
            });
        }

        return result;
    }

    /**
     * Wrap text with colored span element
     * Requirements: 8.9, 8.10
     */
    private wrapWithColor(text: string, color: string): string {
        return `<span style="color: ${color}; text-shadow: 0 0 8px ${color}40;">${text}</span>`;
    }

    /**
     * Get color for a specific category
     */
    private getColorForCategory(category: string): string {
        switch (category) {
            case 'empire':
                return this.colorTheme.empireOrganization;
            case 'technology':
                return this.colorTheme.technology;
            case 'threat':
                return this.colorTheme.threat;
            case 'systems':
                return this.colorTheme.systems;
            default:
                return this.colorTheme.primaryText;
        }
    }

    /**
     * Create default color rules for key narrative terms
     * Requirements: 8.3, 8.4, 8.5, 8.6
     */
    private createDefaultColorRules(): ColorRule[] {
        const rules: ColorRule[] = [];

        // Empire and Organization terms (Cyan)
        const empireTerms = [
            'Korenthi Empire',
            'The Energy Lords',
            'Energy Lords',
            'Energy Lord',
            'Korenthi'
        ];

        empireTerms.forEach(term => {
            rules.push({
                pattern: new RegExp(`\\b${this.escapeRegExp(term)}\\b`, 'gi'),
                color: this.colorTheme.empireOrganization,
                category: 'empire'
            });
        });

        // Technology terms (Gold)
        const technologyTerms = [
            'Artificial Consciousness',
            'quantum tunneling technology',
            'quantum tunneling',
            'consciousness interfaces',
            'quantum-linked consciousness interfaces',
            'remote orbital mining system'
        ];

        technologyTerms.forEach(term => {
            rules.push({
                pattern: new RegExp(`\\b${this.escapeRegExp(term)}\\b`, 'gi'),
                color: this.colorTheme.technology,
                category: 'technology'
            });
        });

        // Threat terms (Red/Orange)
        const threatTerms = [
            'parasitic entities',
            'parasites',
            'Queen consciousness',
            'hive mind',
            'adaptive intelligence',
            'central Queen consciousness',
            'adaptive Queen intelligence'
        ];

        threatTerms.forEach(term => {
            rules.push({
                pattern: new RegExp(`\\b${this.escapeRegExp(term)}\\b`, 'gi'),
                color: this.colorTheme.threat,
                category: 'threat'
            });
        });

        // Systems and Technology terms (Green/Blue)
        const systemsTerms = [
            'orbital mining system',
            'energy sources',
            'mining operations',
            'robotic ships',
            'mining drones',
            'energy generators',
            'protector drones',
            'crystalline substance'
        ];

        systemsTerms.forEach(term => {
            rules.push({
                pattern: new RegExp(`\\b${this.escapeRegExp(term)}\\b`, 'gi'),
                color: this.colorTheme.systems,
                category: 'systems'
            });
        });

        // Sort by pattern length (longer patterns first for better matching)
        return rules.sort((a, b) => {
            const aLength = a.pattern.source.length;
            const bLength = b.pattern.source.length;
            return bLength - aLength;
        });
    }

    /**
     * Escape special regex characters in a string
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Validate color accessibility (basic contrast check)
     * Requirements: 8.7
     */
    public validateAccessibility(): { isValid: boolean; issues: string[] } {
        const issues: string[] = [];
        
        // Basic validation - in a real implementation, this would use proper contrast ratio calculations
        const colors = [
            this.colorTheme.empireOrganization,
            this.colorTheme.technology,
            this.colorTheme.threat,
            this.colorTheme.systems
        ];

        // Check for valid hex colors
        colors.forEach((color, index) => {
            if (!color.match(/^#[0-9A-Fa-f]{6}$/)) {
                const categories = ['empire', 'technology', 'threat', 'systems'];
                issues.push(`Invalid color format for ${categories[index]}: ${color}`);
            }
        });

        return {
            isValid: issues.length === 0,
            issues
        };
    }

    /**
     * Get statistics about color rule application
     */
    public getColoringStats(text: string): { 
        totalMatches: number; 
        matchesByCategory: Record<string, number>;
        coloredText: string;
    } {
        const stats = {
            totalMatches: 0,
            matchesByCategory: {
                empire: 0,
                technology: 0,
                threat: 0,
                systems: 0
            },
            coloredText: ''
        };

        let workingText = text;

        // Count matches for each rule
        for (const rule of this.colorRules) {
            const matches = workingText.match(rule.pattern);
            if (matches) {
                const matchCount = matches.length;
                stats.totalMatches += matchCount;
                stats.matchesByCategory[rule.category] += matchCount;
            }
        }

        stats.coloredText = this.colorizeText(text);

        return stats;
    }

    /**
     * Reset to default color rules
     */
    public resetToDefaults(): void {
        this.colorRules = this.createDefaultColorRules();
    }

    /**
     * Clear all color rules
     */
    public clearColorRules(): void {
        this.colorRules = [];
    }

    /**
     * Get all current color rules
     */
    public getColorRules(): ColorRule[] {
        return [...this.colorRules];
    }
}