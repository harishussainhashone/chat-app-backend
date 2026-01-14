import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = extractSubdomain(hostname);

  // If subdomain exists, rewrite to tenant routes
  if (subdomain) {
    const url = request.nextUrl.clone();
    
    // Rewrite to tenant-specific routes
    // Example: acme-inc.yourapp.com/login -> /(tenant)/login
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/_next')) {
      url.pathname = `/(tenant)${url.pathname === '/' ? '/dashboard' : url.pathname}`;
      
      // Add subdomain to headers for API calls
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-subdomain', subdomain);
      requestHeaders.set('x-tenant-slug', subdomain);
      
      return NextResponse.rewrite(url, {
        request: {
          headers: requestHeaders,
        },
      });
    }
  }

  // No subdomain - allow normal routing (for main domain)
  return NextResponse.next();
}

function extractSubdomain(hostname: string): string | null {
  const hostWithoutPort = hostname.split(':')[0];
  const parts = hostWithoutPort.split('.');
  
  if (parts.length >= 3) {
    return parts[0];
  }
  
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }
  
  return null;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

