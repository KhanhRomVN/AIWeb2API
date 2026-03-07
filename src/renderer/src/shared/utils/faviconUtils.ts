// src/renderer/src/shared/utils/faviconUtils.ts
import React, { useState, useEffect } from 'react';

/**
 * Get favicon URL from various sources
 */
export const getFaviconUrl = (url?: string, size: number = 32): string => {
  if (!url) return '/favicon-fallback.png';

  try {
    const domain = new URL(url).hostname;
    // Google's favicon service - most reliable
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch {
    return '/favicon-fallback.png';
  }
};

/**
 * Get multiple favicon sources for fallback
 */
export const getFaviconSources = (url?: string, size: number = 32): string[] => {
  if (!url) return ['/favicon-fallback.png'];

  try {
    const domain = new URL(url).hostname;
    return [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://favicon.yandex.net/favicon/${domain}`,
      `https://${domain}/favicon.ico`,
      `https://${domain}/favicon.png`,
      `https://${domain}/apple-touch-icon.png`,
      '/favicon-fallback.png',
    ];
  } catch {
    return ['/favicon-fallback.png'];
  }
};

/**
 * Check if an image URL is valid and loads successfully
 */
export const validateImageUrl = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(false);
    }, 5000); // 5 second timeout

    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    img.src = url;
  });
};

const FAVICON_CACHE_KEY = 'elara_favicon_cache';

/**
 * Get favicon from local storage cache
 */
const getCachedFavicon = (domain: string, size: number): string | null => {
  try {
    const cacheStr = localStorage.getItem(FAVICON_CACHE_KEY);
    if (!cacheStr) return null;
    const cache = JSON.parse(cacheStr);
    const item = cache[`${domain}:${size}`];
    if (item && Date.now() - item.timestamp < 7 * 24 * 60 * 60 * 1000) {
      // 7 days cache
      return item.url;
    }
  } catch (e) {
    console.warn('Failed to read favicon cache:', e);
  }
  return null;
};

/**
 * Set favicon to local storage cache
 */
const setCachedFavicon = (domain: string, size: number, faviconUrl: string) => {
  try {
    const cacheStr = localStorage.getItem(FAVICON_CACHE_KEY) || '{}';
    const cache = JSON.parse(cacheStr);
    cache[`${domain}:${size}`] = {
      url: faviconUrl,
      timestamp: Date.now(),
    };
    localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to write favicon cache:', e);
  }
};

/**
 * Hook for loading favicon with fallback sources and caching
 */
export const useFavicon = (url?: string, size: number = 32) => {
  const [faviconUrl, setFaviconUrl] = useState<string>('/favicon-fallback.png');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setIsLoading(false);
      setError('No URL provided');
      return;
    }

    const domain = new URL(url).hostname;
    const cached = getCachedFavicon(domain, size);

    if (cached) {
      setFaviconUrl(cached);
      setIsLoading(false);
      return;
    }

    const loadFavicon = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const sources = getFaviconSources(url, size);

        for (const src of sources) {
          try {
            const isValid = await validateImageUrl(src);
            if (isValid) {
              setFaviconUrl(src);
              setCachedFavicon(domain, size, src);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.warn(`Failed to load favicon from ${src}:`, err);
            continue;
          }
        }

        // If we get here, all sources failed
        setFaviconUrl('/favicon-fallback.png');
        setError('All favicon sources failed');
      } catch (err) {
        setFaviconUrl('/favicon-fallback.png');
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadFavicon();
  }, [url, size]);

  return { faviconUrl, isLoading, error };
};

/**
 * React component props for favicon
 */
export interface FaviconProps {
  url?: string;
  size?: number;
  className?: string;
  alt?: string;
  fallbackIcon?: React.ReactNode;
  onError?: () => void;
  onLoad?: () => void;
}

/**
 * React component for displaying favicons with fallback
 */
export const Favicon: React.FC<FaviconProps> = ({
  url,
  size = 32,
  className = '',
  alt,
  fallbackIcon,
  onError,
  onLoad,
}) => {
  const { faviconUrl, isLoading } = useFavicon(url, size);
  const [hasErrored, setHasErrored] = useState(false);

  const handleError = () => {
    setHasErrored(true);
    onError?.();
  };

  const handleLoad = () => {
    setHasErrored(false);
    onLoad?.();
  };

  if (isLoading) {
    return React.createElement('div', {
      className: `animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`,
      style: { width: size, height: size },
    });
  }

  if (hasErrored || !faviconUrl) {
    return React.createElement(
      'div',
      {
        className: `flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded ${className}`,
        style: { width: size, height: size },
      },
      fallbackIcon ||
        React.createElement(
          'svg',
          {
            className: 'w-1/2 h-1/2 text-gray-400',
            fill: 'currentColor',
            viewBox: '0 0 20 20',
          },
          React.createElement('path', {
            fillRule: 'evenodd',
            d: 'M10 2L3 7v11a1 1 0 001 1h12a1 1 0 001-1V7l-7-5zM10 4.414L5 8.586V16h10V8.586L10 4.414z',
          }),
        ),
    );
  }

  return React.createElement('img', {
    src: faviconUrl,
    alt: alt || `Favicon for ${url}`,
    className: `object-contain ${className}`,
    style: { width: size, height: size },
    onError: handleError,
    onLoad: handleLoad,
    loading: 'lazy',
  });
};
