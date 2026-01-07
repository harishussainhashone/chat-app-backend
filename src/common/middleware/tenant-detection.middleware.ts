import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TenantDetectionMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extract subdomain from host
    const host = req.get('host') || '';
    const subdomain = this.extractSubdomain(host);

    if (subdomain) {
      // Find company by subdomain (slug)
      const company = await this.prisma.company.findUnique({
        where: { slug: subdomain },
        select: {
          id: true,
          slug: true,
          isActive: true,
        },
      });

      if (!company) {
        throw new NotFoundException(`Company with subdomain "${subdomain}" not found`);
      }

      if (!company.isActive) {
        throw new NotFoundException(`Company "${subdomain}" is inactive`);
      }

      // Attach tenant context to request
      (req as any).tenant = {
        companyId: company.id,
        subdomain: company.slug,
        schemaName: `tenant_${company.id.replace(/-/g, '_')}`, // For schema-per-tenant
      };
    }

    // If no subdomain but user is authenticated, use their companyId
    if (!subdomain && (req as any).user?.companyId) {
      (req as any).tenant = {
        companyId: (req as any).user.companyId,
        subdomain: null,
        schemaName: `tenant_${(req as any).user.companyId.replace(/-/g, '_')}`,
      };
    }

    next();
  }

  private extractSubdomain(host: string): string | null {
    // Remove port if present
    const hostWithoutPort = host.split(':')[0];
    
    // Split by dots
    const parts = hostWithoutPort.split('.');
    
    // If localhost or IP, no subdomain
    if (hostWithoutPort === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostWithoutPort)) {
      return null;
    }

    // For subdomain.yourapp.com format
    // parts.length >= 3 means subdomain exists
    if (parts.length >= 3) {
      return parts[0];
    }

    // For yourapp.localhost (development)
    if (parts.length === 2 && parts[1] === 'localhost') {
      return parts[0];
    }

    return null;
  }
}

