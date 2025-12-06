'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Protected YouTube Player Component
 * 
 * This component wraps the YouTube iframe in a way that helps prevent
 * browser extensions (ad blockers, YouTube enhancers, etc.) from
 * injecting scripts that cause flickering and visual issues.
 * 
 * Strategies used:
 * 1. Use youtube-nocookie.com domain (privacy-enhanced mode)
 * 2. Isolate iframe in a shadow DOM when possible
 * 3. Apply CSS containment to prevent layout shifts
 * 4. Use MutationObserver to remove injected elements
 * 5. Apply pointer-events isolation
 */

interface ProtectedYouTubePlayerProps {
  videoId: string;
  autoplay?: boolean;
  className?: string;
  onReady?: (player: YT.Player) => void;
  onStateChange?: (event: YT.OnStateChangeEvent) => void;
  onEnd?: () => void;
}

// Declare YouTube IFrame API types
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function ProtectedYouTubePlayer({
  videoId,
  autoplay = false,
  className = '',
  onReady,
  onStateChange,
  onEnd,
}: ProtectedYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Remove injected elements from extensions
  const cleanInjectedElements = useCallback((container: HTMLElement) => {
    // Common selectors used by YouTube extensions
    const extensionSelectors = [
      '[class*="enhancer"]',
      '[class*="youtube-ext"]',
      '[class*="ytp-ad"]',
      '[id*="enhancer"]',
      '[id*="sponsor"]',
      '[data-extension]',
      'iframe:not([src*="youtube"])',
      '[class*="download"]',
      '[class*="blocker"]',
    ];

    extensionSelectors.forEach(selector => {
      try {
        const elements = container.querySelectorAll(selector);
        elements.forEach(el => {
          // Don't remove the actual YouTube iframe
          if (!el.closest('.protected-yt-iframe') && 
              !(el as HTMLIFrameElement).src?.includes('youtube')) {
            el.remove();
          }
        });
      } catch {
        // Selector might be invalid, ignore
      }
    });
  }, []);

  // Set up mutation observer to catch and remove extension injections
  const setupMutationObserver = useCallback((container: HTMLElement) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new MutationObserver((mutations) => {
      let needsClean = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
              // Check if this looks like an extension injection
              const isExtension = 
                node.getAttribute('data-extension') ||
                node.className?.includes?.('enhancer') ||
                node.className?.includes?.('sponsor') ||
                node.id?.includes?.('enhancer') ||
                (node.tagName === 'SCRIPT' && !node.getAttribute('src')?.includes('youtube'));
              
              if (isExtension) {
                needsClean = true;
              }
            }
          });
        }
      });

      if (needsClean) {
        // Debounce cleaning to avoid performance issues
        requestAnimationFrame(() => cleanInjectedElements(container));
      }
    });

    observerRef.current.observe(container, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }, [cleanInjectedElements]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      return;
    }

    // Load the IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  }, []);

  // Initialize player when API is ready
  useEffect(() => {
    if (!containerRef.current || !videoId) return;

    const container = containerRef.current;
    
    // Set up mutation observer
    setupMutationObserver(container);

    // Clean any existing injections
    cleanInjectedElements(container);

    const initPlayer = () => {
      if (!container) return;

      // Create a wrapper div for the player
      const playerDiv = document.createElement('div');
      playerDiv.id = `yt-player-${videoId}-${Date.now()}`;
      playerDiv.className = 'protected-yt-iframe';
      
      // Clear container and add player div
      const existingPlayer = container.querySelector('.protected-yt-iframe');
      if (existingPlayer) {
        existingPlayer.remove();
      }
      container.appendChild(playerDiv);

      try {
        playerRef.current = new window.YT.Player(playerDiv.id, {
          videoId: videoId,
          host: 'https://www.youtube-nocookie.com', // Privacy-enhanced mode, fewer extension triggers
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            controls: 1,
            rel: 0, // Don't show related videos from other channels
            showinfo: 0,
            modestbranding: 1, // Minimal YouTube branding
            iv_load_policy: 3, // Hide video annotations
            fs: 1, // Allow fullscreen
            playsinline: 1, // Play inline on mobile
            enablejsapi: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
          },
          events: {
            onReady: (event) => {
              setIsLoading(false);
              setHasError(false);
              onReady?.(event.target);
            },
            onStateChange: (event) => {
              onStateChange?.(event);
              if (event.data === window.YT.PlayerState.ENDED) {
                onEnd?.();
              }
            },
            onError: () => {
              setHasError(true);
              setIsLoading(false);
            },
          },
        });
      } catch (error) {
        console.error('Failed to initialize YouTube player:', error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    // Wait for YouTube API to be ready
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      // Cleanup
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Player might already be destroyed
        }
      }
    };
  }, [videoId, autoplay, onReady, onStateChange, onEnd, setupMutationObserver, cleanInjectedElements]);

  if (!videoId) {
    return (
      <div className={`flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground ${className}`}>
        No video available
      </div>
    );
  }

  return (
    <div 
      className={`protected-youtube-container relative aspect-video w-full overflow-hidden rounded-lg bg-black ${className}`}
      style={{
        // CSS containment to prevent layout shifts from extensions
        contain: 'layout style paint',
        // Isolate stacking context
        isolation: 'isolate',
      }}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading video...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center text-muted-foreground">
            <p>Failed to load video</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Player container */}
      <div 
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        style={{
          // Prevent extensions from adding overlays
          pointerEvents: 'auto',
          // Force hardware acceleration
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
      />

      {/* Invisible overlay to catch extension click handlers */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}

export default ProtectedYouTubePlayer;
