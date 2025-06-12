import { OSRS_WIKI_IMG_BASE_URL } from './config.js';

const CACHE_PREFIX = 'imgcache_';
const MAX_CACHE_SIZE_BYTES = 100 * 1024; // 100KB

function buildIconUrl(iconPath) {
    return `${OSRS_WIKI_IMG_BASE_URL}${iconPath.replace(/ /g, '_')}`;
}

/**
 * Synchronously retrieves a cached image data URL from localStorage.
 * @param {string} iconPath - The path of the icon file (e.g., "Dragon_claws.png").
 * @returns {string|null} The base64 data URL if cached, otherwise null.
 */
export function getCachedImage(iconPath) {
    if (!iconPath) return null;
    return localStorage.getItem(`${CACHE_PREFIX}${iconPath}`);
}

/**
 * Asynchronously fetches an image, converts it to a data URL, and stores it in localStorage.
 * This is designed to be run in the background ("fire-and-forget").
 * @param {string} iconPath - The path of the icon file.
 */
async function cacheAndStoreImage(iconPath) {
    if (!iconPath) return;
    const key = `${CACHE_PREFIX}${iconPath}`;

    // Double-check if the image was cached by another process while this was queued
    if (localStorage.getItem(key)) return;

    try {
        const url = buildIconUrl(iconPath);
        const response = await fetch(url);
        if (!response.ok) return; // Don't cache errors

        const blob = await response.blob();
        if (blob.size > MAX_CACHE_SIZE_BYTES) {
            console.warn(`Image for ${iconPath} is too large (${blob.size} bytes) to cache.`);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            try {
                // Ensure reader.result is a string before storing
                if (typeof reader.result === 'string') {
                    localStorage.setItem(key, reader.result);
                }
            } catch (e) {
                console.warn(`Failed to cache image for ${iconPath}. LocalStorage might be full.`, e);
                // Optional: A cache-clearing strategy could be implemented here.
            }
        };
        reader.readAsDataURL(blob);

    } catch (error) {
        console.error(`Error caching image ${iconPath}:`, error);
    }
}

/**
 * Iterates through a list of items and triggers background caching for any images
 * that are not already in the localStorage cache.
 * @param {Array<Object>} items - An array of item objects, each expected to have an `icon` property.
 */
export function updateImageCache(items) {
    if (!items || !Array.isArray(items)) return;
    
    // Get unique icon paths to avoid redundant checks
    const uniqueIcons = [...new Set(items.map(item => item.icon).filter(Boolean))];
    
    for (const iconPath of uniqueIcons) {
        if (!getCachedImage(iconPath)) {
            // This is "fire-and-forget" - it runs in the background without being awaited
            cacheAndStoreImage(iconPath);
        }
    }
} 