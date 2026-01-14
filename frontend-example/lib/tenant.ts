/**
 * Extract subdomain from hostname
 * Examples:
 * - acme-inc.yourapp.com -> acme-inc
 * - acme-inc.localhost:3000 -> acme-inc
 * - localhost:3000 -> null
 */
export function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const hostWithoutPort = hostname.split(':')[0];
  
  // Split by dots
  const parts = hostWithoutPort.split('.');
  
  // For subdomain.domain.tld format (production)
  if (parts.length >= 3) {
    return parts[0];
  }
  
  // For subdomain.localhost format (development)
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }
  
  // No subdomain found
  return null;
}

/**
 * Get current tenant subdomain from request
 */
export function getTenantSubdomain(request: Request): string | null {
  const hostname = request.headers.get('host') || '';
  return extractSubdomain(hostname);
}

/**
 * Get tenant subdomain from window (client-side)
 */
export function getClientSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  return extractSubdomain(window.location.hostname);
}

/**
 * Check if current request is for a tenant subdomain
 */
export function isTenantRequest(request: Request): boolean {
  return getTenantSubdomain(request) !== null;
}

