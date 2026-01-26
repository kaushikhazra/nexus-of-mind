/**
 * StoryContentParser - Parses story content from markdown structure
 * 
 * Handles parsing of story.md content into structured StoryPage objects
 * with proper validation and error handling.
 */

export interface StoryPage {
    title: string;
    content: string;
    isLastPage: boolean;
    pageNumber: number;
    metadata?: {
        empireName?: string;
        guildName?: string;
        version?: string;
    };
}

export interface StoryContent {
    pages: StoryPage[];
    metadata: {
        empireName: string;
        guildName: string;
        version: string;
    };
}

export interface ParsedStorySection {
    title: string;
    content: string;
    pageNumber: number;
}

export class StoryContentParser {
    private static readonly DEFAULT_METADATA = {
        empireName: 'Korenthi',
        guildName: 'The Energy Lords',
        version: '1.0.0'
    };

    /**
     * Parse story content from markdown text
     * @param markdownContent - Raw markdown content from story.md
     * @returns Parsed story content with pages and metadata
     */
    public static parseStoryContent(markdownContent: string): StoryContent {
        try {
            const sections = this.extractSections(markdownContent);
            const metadata = this.extractMetadata(markdownContent);
            const pages = this.createStoryPages(sections, metadata);

            return {
                pages,
                metadata
            };
        } catch (error) {
            console.error('Error parsing story content:', error);
            return this.createFallbackContent();
        }
    }

    /**
     * Extract sections from markdown content
     * @param content - Raw markdown content
     * @returns Array of parsed story sections
     */
    private static extractSections(content: string): ParsedStorySection[] {
        const sections: ParsedStorySection[] = [];
        
        // Split content by ## Page headers
        const pageRegex = /## Page (\d+): (.+?)\n\n([\s\S]*?)(?=## Page \d+:|$)/g;
        let match;
        
        while ((match = pageRegex.exec(content)) !== null) {
            const pageNumber = parseInt(match[1], 10);
            const title = match[2].trim();
            const rawContent = match[3].trim();
            
            // Clean up content - remove markdown formatting for display
            const cleanContent = this.cleanMarkdownContent(rawContent);
            
            sections.push({
                title,
                content: cleanContent,
                pageNumber
            });
        }

        // Validate that we found sections
        if (sections.length === 0) {
            throw new Error('No story sections found in markdown content');
        }

        // Sort by page number to ensure correct order
        sections.sort((a, b) => a.pageNumber - b.pageNumber);

        return sections;
    }

    /**
     * Extract metadata from markdown content
     * @param content - Raw markdown content
     * @returns Story metadata
     */
    private static extractMetadata(content: string): StoryContent['metadata'] {
        const metadata = { ...this.DEFAULT_METADATA };

        // Extract empire name (look for **Korenthi** or similar patterns)
        const empireMatch = content.match(/\*\*([A-Z][a-z]+)\*\*\s+Empire/);
        if (empireMatch) {
            metadata.empireName = empireMatch[1];
        }

        // Extract guild name (look for **The Energy Lords** or similar patterns)
        const guildMatch = content.match(/\*\*([^*]+Lords[^*]*)\*\*/);
        if (guildMatch) {
            metadata.guildName = guildMatch[1];
        }

        return metadata;
    }

    /**
     * Create StoryPage objects from parsed sections
     * @param sections - Parsed story sections
     * @param metadata - Story metadata
     * @returns Array of StoryPage objects
     */
    private static createStoryPages(sections: ParsedStorySection[], metadata: StoryContent['metadata']): StoryPage[] {
        return sections.map((section, index) => ({
            title: section.title,
            content: section.content,
            isLastPage: index === sections.length - 1,
            pageNumber: section.pageNumber,
            metadata: {
                empireName: metadata.empireName,
                guildName: metadata.guildName,
                version: metadata.version
            }
        }));
    }

    /**
     * Clean markdown content for display
     * @param content - Raw markdown content
     * @returns Cleaned content suitable for display
     */
    private static cleanMarkdownContent(content: string): string {
        return content
            // Remove bold markdown formatting but keep the text
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            // Remove italic markdown formatting but keep the text
            .replace(/\*([^*]+)\*/g, '$1')
            // Clean up extra whitespace and normalize line breaks
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Create fallback content when parsing fails
     * @returns Default story content
     */
    private static createFallbackContent(): StoryContent {
        const fallbackPages: StoryPage[] = [
            {
                title: "Welcome to The Energy Lords",
                content: "Welcome to Nexus of Mind. You are about to embark on a journey as a member of The Energy Lords, an elite guild tasked with mining precious energy resources from a hostile alien world.\n\nYour mission is critical to the survival of your civilization. Prepare yourself for the challenges ahead.",
                isLastPage: true,
                pageNumber: 1,
                metadata: this.DEFAULT_METADATA
            }
        ];

        return {
            pages: fallbackPages,
            metadata: this.DEFAULT_METADATA
        };
    }

    /**
     * Validate story content structure
     * @param content - Story content to validate
     * @returns True if content is valid, false otherwise
     */
    public static validateStoryContent(content: StoryContent): boolean {
        try {
            // Check that we have pages
            if (!content.pages || content.pages.length === 0) {
                return false;
            }

            // Check that each page has required fields
            for (const page of content.pages) {
                if (!page.title || typeof page.title !== 'string') {
                    return false;
                }
                if (!page.content || typeof page.content !== 'string') {
                    return false;
                }
                if (typeof page.isLastPage !== 'boolean') {
                    return false;
                }
                if (typeof page.pageNumber !== 'number' || page.pageNumber < 1) {
                    return false;
                }
            }

            // Check that exactly one page is marked as last page
            const lastPages = content.pages.filter(page => page.isLastPage);
            if (lastPages.length !== 1) {
                return false;
            }

            // Check that the last page is actually the last in the array
            const lastPageIndex = content.pages.length - 1;
            if (!content.pages[lastPageIndex].isLastPage) {
                return false;
            }

            // Check metadata
            if (!content.metadata || typeof content.metadata !== 'object') {
                return false;
            }

            if (!content.metadata.empireName || typeof content.metadata.empireName !== 'string') {
                return false;
            }

            if (!content.metadata.guildName || typeof content.metadata.guildName !== 'string') {
                return false;
            }

            if (!content.metadata.version || typeof content.metadata.version !== 'string') {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating story content:', error);
            return false;
        }
    }

    /**
     * Get the predefined story content (for when story.md is not available)
     * @returns Predefined story content based on the established narrative
     */
    public static getPredefinedStoryContent(): StoryContent {
        const pages: StoryPage[] = [
            {
                title: "The Empire and the Crisis",
                content: "In the distant reaches of the galaxy, the Korenthi Empire has achieved what many thought impossible - the mastery of Artificial Consciousness. This breakthrough has revolutionized their society, culture, and scientific advancement, creating a civilization of unprecedented sophistication and harmony.\n\nBut this triumph came at a devastating cost. The energy demands of maintaining their Artificial Consciousness network have pushed their civilization to the brink of collapse. Energy starvation now threatens every aspect of Korenthi life - from the simplest daily tasks to the most complex scientific endeavors.",
                isLastPage: false,
                pageNumber: 1,
                metadata: this.DEFAULT_METADATA
            },
            {
                title: "The Discovery",
                content: "Though the Korenthi are a peaceful race by nature, desperation has driven them to seek new energy sources across the galaxy. Their explorers, pushing beyond the boundaries of known space, have made a remarkable discovery on a desolate, forgotten world.\n\nThis barren planet harbors a unique mineral unlike anything in their databases - a crystalline substance that their scientists have confirmed to be an extraordinary energy source. The potential is staggering: enough power to restore their civilization and fuel their Artificial Consciousness for millennia.",
                isLastPage: false,
                pageNumber: 2,
                metadata: this.DEFAULT_METADATA
            },
            {
                title: "The Challenge",
                content: "However, fate has presented them with a cruel irony. The planet's atmosphere and surface conditions are lethally toxic to the Korenthi species. Even their most advanced protective technologies cannot shield them from the world's hostile environment.\n\nUndeterred by this obstacle, their greatest minds have developed an ingenious solution: a remote orbital mining system. Using quantum tunneling technology - made possible by their Artificial Consciousness - they can operate sophisticated mining equipment from the safety of their home worlds.",
                isLastPage: false,
                pageNumber: 3,
                metadata: this.DEFAULT_METADATA
            },
            {
                title: "The Energy Lords",
                content: "From this necessity, a new organization was born: The Energy Lords. This elite guild brings together the most skilled remote operators, engineers, and strategists in the Korenthi Empire. You have been selected to join their ranks - a honor that carries both great privilege and tremendous responsibility.\n\nThe Energy Lords have deployed specialized robotic ships capable of establishing complete mining operations on the hostile planet's surface. These vessels can deploy bases, mining drones, and energy generators - all controlled remotely through quantum-linked consciousness interfaces.",
                isLastPage: false,
                pageNumber: 4,
                metadata: this.DEFAULT_METADATA
            },
            {
                title: "The Threat",
                content: "But the Korenthi are not alone on this world. The planet harbors a peculiar indigenous species - parasitic entities that have evolved in the toxic environment. These creatures are highly territorial and view the mining operations as an invasion of their domain.\n\nEarly mining attempts revealed disturbing intelligence in these parasites. They actively hunt the mining drones, adapting their tactics with each encounter. Most troubling of all, researchers have discovered they operate as a hive mind, with a central Queen consciousness that learns from every interaction.",
                isLastPage: false,
                pageNumber: 5,
                metadata: this.DEFAULT_METADATA
            },
            {
                title: "Your Mission",
                content: "The Korenthi have deployed protector drones to defend the mining operations, but the parasites continue to evolve their strategies. The Queen's adaptive intelligence poses an unprecedented challenge - one that may require a conscious mind to counter.\n\nWhile researchers work tirelessly to find a way to neutralize the Queen, the mining operations must continue. The survival of the Korenthi Empire depends on the energy these operations provide.\n\nYou are now connected to your orbital mining ship, ready to establish operations on this hostile world. Your mission: sustain mineral extraction against an enemy that learns from your every move. The fate of the Korenthi Empire - and their Artificial Consciousness - rests in your hands.\n\nWelcome to The Energy Lords.",
                isLastPage: true,
                pageNumber: 6,
                metadata: this.DEFAULT_METADATA
            }
        ];

        return {
            pages,
            metadata: this.DEFAULT_METADATA
        };
    }
}