import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TenantPrismaService } from '../../database/tenant-prisma.service';

/**
 * Interceptor to automatically set tenant context for Prisma queries
 * This ensures all queries are automatically filtered by company_id
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private tenantPrisma: TenantPrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenant = (request as any).tenant;

    // Set tenant context for this request
    if (tenant) {
      this.tenantPrisma.setTenant({
        companyId: tenant.companyId,
        schemaName: tenant.schemaName,
      });

      // For schema-per-tenant approach, switch schema
      if (tenant.schemaName) {
        try {
          await this.tenantPrisma.switchSchema(tenant.schemaName);
        } catch (error) {
          // If schema doesn't exist, fall back to public schema with company_id filtering
          console.warn(`Schema ${tenant.schemaName} not found, using public schema with company_id filter`);
        }
      }
    }

    return next.handle().pipe(
      tap({
        complete: () => {
          // Clear tenant context after request completes
          this.tenantPrisma.setTenant(null);
          try {
            this.tenantPrisma.switchSchema('public');
          } catch (error) {
            // Ignore errors when resetting schema
          }
        },
      }),
    );
  }
}

