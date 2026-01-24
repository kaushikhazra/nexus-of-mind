/**
 * Tests for StoryContentParser
 */

import { StoryContentParser, StoryContent, StoryPage } from '../StoryContentParser';

describe('StoryContentParser', () => {
    describe('parseStoryContent', () => {
        it('should parse valid markdown content correctly', () => {
            const markdownContent = `# The Energy Lords: Origin Story

## Page 1: The Empire and the Crisis

In the distant reaches of the galaxy, the **Korenthi** Empire has achieved what many thought impossible - the mastery of Artificial Consciousness.

But this triumph came at a devastating cost.

## Page 2: The Discovery

Though the **Korenthi** are a peaceful race by nature, desperation has driven them to seek new energy sources.

This barren planet harbors a unique mineral.`;

            const result = StoryContentParser.parseStoryContent(markdownContent);

            expect(result.pages).toHaveLength(2);
            expect(result.pages[0].title).toBe('The Empire and the Crisis');
            expect(result.pages[0].pageNumber).toBe(1);
            expect(result.pages[0].isLastPage).toBe(false);
            expect(result.pages[0].content).toContain('Korenthi Empire');
            expect(result.pages[0].content).not.toContain('**'); // Bold formatting should be removed

            expect(result.pages[1].title).toBe('The Discovery');
            expect(result.pages[1].pageNumber).toBe(2);
            expect(result.pages[1].isLastPage).toBe(true);
            expect(result.pages[1].content).toContain('peaceful race');

            expect(result.metadata.empireName).toBe('Korenthi');
            expect(result.metadata.guildName).toBe('The Energy Lords');
        });

        it('should handle empty or invalid content gracefully', () => {
            const result = StoryContentParser.parseStoryContent('');

            expect(result.pages).toHaveLength(1);
            expect(result.pages[0].title).toBe('Welcome to The Energy Lords');
            expect(result.pages[0].isLastPage).toBe(true);
            expect(result.metadata.empireName).toBe('Korenthi');
        });

        it('should extract metadata correctly', () => {
            const markdownContent = `# The Energy Lords: Origin Story

## Page 1: Test

The **Korenthi** Empire and **The Energy Lords** guild.`;

            const result = StoryContentParser.parseStoryContent(markdownContent);

            expect(result.metadata.empireName).toBe('Korenthi');
            expect(result.metadata.guildName).toBe('The Energy Lords');
        });
    });

    describe('validateStoryContent', () => {
        it('should validate correct story content', () => {
            const validContent: StoryContent = {
                pages: [
                    {
                        title: 'Test Page',
                        content: 'Test content',
                        isLastPage: true,
                        pageNumber: 1,
                        metadata: {
                            empireName: 'Korenthi',
                            guildName: 'The Energy Lords',
                            version: '1.0.0'
                        }
                    }
                ],
                metadata: {
                    empireName: 'Korenthi',
                    guildName: 'The Energy Lords',
                    version: '1.0.0'
                }
            };

            expect(StoryContentParser.validateStoryContent(validContent)).toBe(true);
        });

        it('should reject invalid story content', () => {
            const invalidContent: StoryContent = {
                pages: [
                    {
                        title: '',
                        content: 'Test content',
                        isLastPage: true,
                        pageNumber: 1
                    }
                ],
                metadata: {
                    empireName: 'Korenthi',
                    guildName: 'The Energy Lords',
                    version: '1.0.0'
                }
            };

            expect(StoryContentParser.validateStoryContent(invalidContent)).toBe(false);
        });

        it('should reject content with multiple last pages', () => {
            const invalidContent: StoryContent = {
                pages: [
                    {
                        title: 'Page 1',
                        content: 'Content 1',
                        isLastPage: true,
                        pageNumber: 1
                    },
                    {
                        title: 'Page 2',
                        content: 'Content 2',
                        isLastPage: true,
                        pageNumber: 2
                    }
                ],
                metadata: {
                    empireName: 'Korenthi',
                    guildName: 'The Energy Lords',
                    version: '1.0.0'
                }
            };

            expect(StoryContentParser.validateStoryContent(invalidContent)).toBe(false);
        });
    });

    describe('getPredefinedStoryContent', () => {
        it('should return valid predefined story content', () => {
            const content = StoryContentParser.getPredefinedStoryContent();

            expect(content.pages.length).toBeGreaterThan(0);
            expect(StoryContentParser.validateStoryContent(content)).toBe(true);
            expect(content.pages[content.pages.length - 1].isLastPage).toBe(true);
            expect(content.metadata.empireName).toBe('Korenthi');
            expect(content.metadata.guildName).toBe('The Energy Lords');
        });

        it('should have exactly 6 pages matching the story structure', () => {
            const content = StoryContentParser.getPredefinedStoryContent();

            expect(content.pages).toHaveLength(6);
            expect(content.pages[0].title).toBe('The Empire and the Crisis');
            expect(content.pages[1].title).toBe('The Discovery');
            expect(content.pages[2].title).toBe('The Challenge');
            expect(content.pages[3].title).toBe('The Energy Lords');
            expect(content.pages[4].title).toBe('The Threat');
            expect(content.pages[5].title).toBe('Your Mission');
            expect(content.pages[5].isLastPage).toBe(true);
        });
    });
});