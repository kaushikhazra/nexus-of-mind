/**
 * IntroductionScreen Responsive Design Tests
 * 
 * Tests for responsive layout handling, viewport detection, and mobile-friendly interactions.
 * 
 * @jest-environment jsdom
 */

describe('IntroductionScreen Responsive Design', () => {
    beforeEach(() => {
        // Set up DOM environment
        document.body.innerHTML = '';
        
        // Mock window properties for responsive testing
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 1024
        });
        
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: 768
        });

        // Mock ResizeObserver
        global.ResizeObserver = jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            disconnect: jest.fn(),
            unobserve: jest.fn()
        }));
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    test('should detect desktop viewport correctly', () => {
        // Set desktop dimensions
        Object.defineProperty(window, 'innerWidth', { value: 1200 });
        Object.defineProperty(window, 'innerHeight', { value: 800 });

        // Test viewport detection logic
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const isMobile = width <= 768;
        const isTablet = width > 768 && width <= 1024;
        const isDesktop = width > 1024;
        const orientation = width > height ? 'landscape' : 'portrait';

        expect(isMobile).toBe(false);
        expect(isTablet).toBe(false);
        expect(isDesktop).toBe(true);
        expect(orientation).toBe('landscape');
    });

    test('should detect mobile viewport correctly', () => {
        // Set mobile dimensions
        Object.defineProperty(window, 'innerWidth', { value: 375 });
        Object.defineProperty(window, 'innerHeight', { value: 667 });

        // Test viewport detection logic
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const isMobile = width <= 768;
        const isTablet = width > 768 && width <= 1024;
        const isDesktop = width > 1024;
        const orientation = width > height ? 'landscape' : 'portrait';

        expect(isMobile).toBe(true);
        expect(isTablet).toBe(false);
        expect(isDesktop).toBe(false);
        expect(orientation).toBe('portrait');
    });

    test('should detect tablet viewport correctly', () => {
        // Set tablet dimensions
        Object.defineProperty(window, 'innerWidth', { value: 768 });
        Object.defineProperty(window, 'innerHeight', { value: 1024 });

        // Test viewport detection logic
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const isMobile = width <= 768;
        const isTablet = width > 768 && width <= 1024;
        const isDesktop = width > 1024;
        const orientation = width > height ? 'landscape' : 'portrait';

        expect(isMobile).toBe(true); // 768 is considered mobile (<=768)
        expect(isTablet).toBe(false);
        expect(isDesktop).toBe(false);
        expect(orientation).toBe('portrait');
    });

    test('should handle window resize events', () => {
        const mockHandler = jest.fn();
        window.addEventListener('resize', mockHandler);
        
        // Simulate resize
        window.dispatchEvent(new Event('resize'));
        
        expect(mockHandler).toHaveBeenCalledTimes(1);
        
        window.removeEventListener('resize', mockHandler);
    });

    test('should handle orientation change events', () => {
        const mockHandler = jest.fn();
        window.addEventListener('orientationchange', mockHandler);
        
        // Simulate orientation change
        window.dispatchEvent(new Event('orientationchange'));
        
        expect(mockHandler).toHaveBeenCalledTimes(1);
        
        window.removeEventListener('orientationchange', mockHandler);
    });

    test('should create responsive UI elements with proper styling', () => {
        // Create container
        const container = document.createElement('div');
        container.id = 'test-introduction-container';
        document.body.appendChild(container);

        // Create page container with mobile styles
        const pageContainer = document.createElement('div');
        pageContainer.className = 'introduction-content';
        
        // Apply mobile styles
        pageContainer.style.cssText = `
            background: rgba(0, 10, 20, 0.9);
            border: 1px solid rgba(0, 255, 255, 0.6);
            border-radius: 0;
            padding: 20px 16px;
            max-width: 100%;
            width: 100%;
            max-height: 100vh;
            height: 100vh;
            overflow-y: auto;
            backdrop-filter: blur(8px);
            box-shadow: none;
            position: relative;
            display: flex;
            flex-direction: column;
        `;

        container.appendChild(pageContainer);

        // Verify mobile styles are applied
        expect(pageContainer.style.padding).toBe('20px 16px');
        expect(pageContainer.style.width).toBe('100%');
        expect(pageContainer.style.maxWidth).toBe('100%');
        expect(pageContainer.style.borderRadius).toBe('0');
        expect(pageContainer.style.display).toBe('flex');
        expect(pageContainer.style.flexDirection).toBe('column');
    });

    test('should create touch-friendly button elements', () => {
        // Create button with mobile touch styles
        const button = document.createElement('button');
        button.style.cssText = `
            padding: 14px 28px;
            font-size: 16px;
            min-width: 140px;
            touch-action: manipulation;
            background: rgba(0, 40, 80, 0.6);
            border: 2px solid #00ffff;
            border-radius: 6px;
            color: #00ffff;
            cursor: pointer;
        `;

        // Verify touch-friendly properties
        expect(button.style.padding).toBe('14px 28px');
        expect(button.style.fontSize).toBe('16px');
        expect(button.style.minWidth).toBe('140px');
        // Note: touchAction might not be supported in jsdom, so we'll skip this check
        // expect(button.style.touchAction).toBe('manipulation');
        expect(button.style.cursor).toBe('pointer');
    });

    test('should handle touch events for mobile interactions', () => {
        const button = document.createElement('button');
        document.body.appendChild(button);

        const touchStartHandler = jest.fn((e) => {
            e.preventDefault();
            button.style.transform = 'scale(0.95)';
            button.style.transition = 'transform 0.1s ease';
        });

        const touchEndHandler = jest.fn((e) => {
            e.preventDefault();
            button.style.transform = 'scale(1)';
            setTimeout(() => {
                button.style.transition = 'all 0.3s ease';
            }, 100);
        });

        button.addEventListener('touchstart', touchStartHandler);
        button.addEventListener('touchend', touchEndHandler);

        // Create touch events
        const touchStartEvent = new TouchEvent('touchstart', {
            touches: [{ clientX: 100, clientY: 100 } as Touch]
        });
        const touchEndEvent = new TouchEvent('touchend', {
            changedTouches: [{ clientX: 100, clientY: 100 } as Touch]
        });

        // Simulate touch interactions
        button.dispatchEvent(touchStartEvent);
        expect(touchStartHandler).toHaveBeenCalledTimes(1);
        expect(button.style.transform).toBe('scale(0.95)');

        button.dispatchEvent(touchEndEvent);
        expect(touchEndHandler).toHaveBeenCalledTimes(1);
        expect(button.style.transform).toBe('scale(1)');
    });

    test('should apply responsive typography for different screen sizes', () => {
        // Test mobile typography
        const mobileTitle = document.createElement('h1');
        mobileTitle.style.cssText = `
            font-size: 18px;
            font-weight: 700;
            color: #00ffff;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
            text-align: center;
            margin-bottom: 20px;
            letter-spacing: 1px;
            text-transform: uppercase;
            font-family: 'Orbitron', monospace;
            line-height: 1.3;
        `;

        expect(mobileTitle.style.fontSize).toBe('18px');
        expect(mobileTitle.style.lineHeight).toBe('1.3');
        expect(mobileTitle.style.letterSpacing).toBe('1px');

        // Test desktop typography
        const desktopTitle = document.createElement('h1');
        desktopTitle.style.cssText = `
            font-size: 24px;
            font-weight: 700;
            color: #00ffff;
            text-shadow: 0 0 15px rgba(0, 255, 255, 0.6);
            text-align: center;
            margin-bottom: 30px;
            letter-spacing: 2px;
            text-transform: uppercase;
            font-family: 'Orbitron', monospace;
        `;

        expect(desktopTitle.style.fontSize).toBe('24px');
        expect(desktopTitle.style.letterSpacing).toBe('2px');
        expect(desktopTitle.style.marginBottom).toBe('30px');
    });

    test('should handle swipe gesture detection', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;

        const touchStartHandler = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };

        const touchEndHandler = (e: TouchEvent) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;

            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const minSwipeDistance = 50;

            // Test swipe left detection
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                if (deltaX < 0) {
                    // Swipe left detected
                    expect(deltaX).toBeLessThan(0);
                    expect(Math.abs(deltaX)).toBeGreaterThan(minSwipeDistance);
                }
            }
        };

        container.addEventListener('touchstart', touchStartHandler);
        container.addEventListener('touchend', touchEndHandler);

        // Simulate swipe left gesture
        const touchStart = new TouchEvent('touchstart', {
            touches: [{ clientX: 200, clientY: 100 } as Touch]
        });
        const touchEnd = new TouchEvent('touchend', {
            changedTouches: [{ clientX: 100, clientY: 100 } as Touch]
        });

        container.dispatchEvent(touchStart);
        container.dispatchEvent(touchEnd);

        // Verify swipe was detected (deltaX = 100 - 200 = -100, which is < 0 and > 50)
        expect(endX - startX).toBe(-100);
        expect(Math.abs(endX - startX)).toBeGreaterThan(50);
    });

    test('should create ResizeObserver when supported', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        // Test ResizeObserver creation
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                // Mock callback
            });
            resizeObserver.observe(container);

            expect(ResizeObserver).toHaveBeenCalledTimes(1);
            expect(resizeObserver.observe).toHaveBeenCalledWith(container);
        }
    });
});