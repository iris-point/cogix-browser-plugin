/**
 * Content Script Wrapper for Cogix Eye Tracking Extension
 * This wrapper ensures compatibility with Chrome's content script execution
 */

(async function() {
  'use strict';
  
  console.log('[Cogix Content] Initializing content script...');
  
  // Dynamic import to handle ES modules
  try {
    await import('./content-script');
    console.log('[Cogix Content] Content script module loaded');
  } catch (error) {
    console.error('[Cogix Content] Failed to load content script:', error);
  }
})();