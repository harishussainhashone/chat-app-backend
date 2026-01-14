'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { getClientSubdomain } from '@/lib/tenant';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const subdomain = getClientSubdomain();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    // Fetch user data or company data
    // Example: apiClient.get('/companies/me')
    setLoading(false);
  }, [router]);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await apiClient.logout(refreshToken || undefined);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">
                Dashboard - {subdomain || 'Company'}
              </h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-8">
            <h2 className="text-2xl font-bold mb-4">Welcome to Dashboard</h2>
            <p className="text-gray-600">
              This is the dashboard for company: <strong>{subdomain}</strong>
            </p>
            <p className="text-gray-600 mt-4">
              Subdomain-based routing is working! Each company has its own subdomain.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

