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

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      // Add JWT token if available
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
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
    
    // Store tokens
    if (typeof window !== 'undefined' && response.data.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    
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

