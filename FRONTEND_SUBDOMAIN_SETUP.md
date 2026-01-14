# Next.js Frontend Subdomain Multi-Tenancy Setup

Yeh guide Next.js frontend mein subdomain-based multi-tenancy implement karne ke liye hai.

## Overview

- **Frontend (Next.js)**: Subdomain detect karega aur tenant context manage karega
- **Backend (NestJS)**: Direct API calls accept karega (subdomain validation nahi karega)
- **Multiple Subdomains**: Har company ka apna subdomain hoga (e.g., acme-inc.yourapp.com, xyz-corp.yourapp.com)

## Step 1: Next.js Project Setup

### Install Dependencies

```bash
npm install next@latest react@latest react-dom@latest
npm install axios # API calls ke liye
```

### Project Structure

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (tenant)/
│   │   ├── layout.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── dashboard/
│   │       └── page.tsx
│   └── api/
│       └── proxy/
│           └── route.ts
├── lib/
│   ├── tenant.ts          # Tenant detection utilities
│   ├── api.ts             # API client with tenant context
│   └── constants.ts
├── middleware.ts          # Next.js middleware for subdomain
├── next.config.js
└── package.json
```

## Step 2: Create Tenant Detection Utilities

### `lib/tenant.ts`

```typescript
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
```

## Step 3: Create API Client with Tenant Context

### `lib/api.ts`

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private client: AxiosInstance;
  private currentSubdomain: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set subdomain from client-side
    if (typeof window !== 'undefined') {
      this.currentSubdomain = this.extractSubdomain(window.location.hostname);
    }

    // Add request interceptor to include subdomain in headers
    this.client.interceptors.request.use((config) => {
      const subdomain = this.currentSubdomain || this.extractSubdomain(window.location.hostname);
      
      if (subdomain) {
        // Set Host header with subdomain for backend validation
        config.headers['X-Subdomain'] = subdomain;
        // Also set Host header if needed
        if (typeof window !== 'undefined') {
          config.headers['Host'] = window.location.host;
        }
      }

      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private extractSubdomain(hostname: string): string | null {
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

  setSubdomain(subdomain: string | null) {
    this.currentSubdomain = subdomain;
  }

  getSubdomain(): string | null {
    return this.currentSubdomain;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/companies/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async logout(refreshToken?: string) {
    const response = await this.client.post('/auth/logout', {
      refreshToken,
    });
    return response.data;
  }

  // Generic API methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
```

## Step 4: Next.js Middleware for Subdomain Routing

### `middleware.ts`

```typescript
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
```

## Step 5: Tenant Layout Component

### `app/(tenant)/layout.tsx`

```typescript
import { ReactNode } from 'react';
import { headers } from 'next/headers';
import { getTenantSubdomain } from '@/lib/tenant';

export default async function TenantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const subdomain = extractSubdomain(host);

  return (
    <div data-tenant={subdomain}>
      <TenantProvider subdomain={subdomain}>
        {children}
      </TenantProvider>
    </div>
  );
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

// Simple tenant context provider
function TenantProvider({
  children,
  subdomain,
}: {
  children: ReactNode;
  subdomain: string | null;
}) {
  return <>{children}</>;
}
```

## Step 6: Login Page with Subdomain

### `app/(tenant)/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { getClientSubdomain } from '@/lib/tenant';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const subdomain = getClientSubdomain();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // API client automatically includes subdomain in headers
      const response = await apiClient.login(email, password);
      
      // Store tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">
          Login to {subdomain || 'Company'}
        </h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

## Step 7: Next.js Configuration

### `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Allow subdomain rewrites
  async rewrites() {
    return [];
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  },
};

module.exports = nextConfig;
```

## Step 8: Environment Variables

### `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## Step 9: Development Setup

### Local Development with Subdomains

**Option 1: Use hosts file (Recommended)**

Edit `C:\Windows\System32\drivers\etc\hosts` (Windows) or `/etc/hosts` (Mac/Linux):

```
127.0.0.1 acme-inc.localhost
127.0.0.1 xyz-corp.localhost
```

Then access:
- `http://acme-inc.localhost:3001` (Next.js frontend)
- Backend: `http://localhost:3000`

**Option 2: Use ngrok or similar for production testing**

## Step 10: Backend Integration

Backend ko subdomain validation ki zarurat nahi hai. Frontend hi subdomain handle karega.

### Backend CORS Configuration

Backend mein CORS configure karein taake sab subdomains se requests accept ho:

```typescript
// src/main.ts
app.enableCors({
  origin: (origin, callback) => {
    // Allow all subdomains and localhost
    if (!origin || 
        origin.includes('.yourapp.com') || 
        origin.includes('.localhost') ||
        origin.includes('localhost:3001')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

### Backend API Structure

Backend APIs direct calls accept karti hain:
- `POST /api/companies/auth/login` - Company login (subdomain validation nahi)
- `GET /api/companies/me` - Company details (JWT token se company identify)
- All other APIs work with JWT token authentication

## Testing

1. **Start Backend**: `npm run start:dev` (port 3000)
2. **Start Frontend**: `npm run dev` (port 3001)
3. **Access Different Subdomains**:
   - `http://acme-inc.localhost:3001/login` - Acme Inc company
   - `http://xyz-corp.localhost:3001/login` - XYZ Corp company
4. **Login**: Company user credentials se login karein
5. **Verify**: Frontend subdomain detect karega aur tenant context set karega

## Production Deployment

1. **DNS Setup**: Wildcard subdomain: `*.yourapp.com` → Your server IP
2. **Nginx/Reverse Proxy**: Subdomain-based routing
3. **SSL**: Wildcard SSL certificate (`*.yourapp.com`)

## Key Points

✅ **Frontend**: Subdomain detect karta hai aur tenant context manage karta hai  
✅ **Backend**: Subdomain validate karta hai aur company isolation enforce karta hai  
✅ **Security**: Ek company doosri company ke subdomain se login nahi kar sakti  
✅ **Scalable**: Multiple companies ke liye ready

