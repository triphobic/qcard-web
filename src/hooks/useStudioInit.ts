/**
 * Hook to silently initialize studio profile if needed
 * Call this when you get a 404 "Studio not found" error
 */

export async function initStudioIfNeeded(): Promise<boolean> {
  try {
    const response = await fetch('/api/profile-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userType: 'STUDIO' })
    });
    return response.ok;
  } catch (error) {
    console.error('Studio init failed:', error);
    return false;
  }
}

/**
 * Wrapper for fetch that automatically initializes studio on 404
 * and retries the request
 */
export async function fetchWithStudioInit(
  url: string,
  options?: RequestInit
): Promise<Response> {
  let response = await fetch(url, options);

  if (response.status === 404) {
    try {
      const data = await response.clone().json();
      if (data.error === 'Studio not found') {
        // Initialize studio and retry
        const initSuccess = await initStudioIfNeeded();
        if (initSuccess) {
          response = await fetch(url, options);
        }
      }
    } catch {
      // Not JSON or parsing failed, return original response
    }
  }

  return response;
}
