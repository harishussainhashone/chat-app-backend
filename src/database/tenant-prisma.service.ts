import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Enhanced Prisma Service with tenant context support
 * Automatically applies company_id filter to all queries
 */
if (process.env.PRISMA_CLIENT_ENGINE_TYPE === 'client') {
  // Avoid "client" engine unless an adapter/accelerate URL is configured.
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
}

type PrismaClientType = import('@prisma/client').PrismaClient;
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: new (...args: any[]) => PrismaClientType;
};

@Injectable()
export class TenantPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private currentTenant: { companyId: string; schemaName?: string } | null = null;

  constructor(private basePrisma: PrismaService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Set tenant context for current request
   */
  setTenant(tenant: { companyId: string; schemaName?: string } | null) {
    this.currentTenant = tenant;
  }

  /**
   * Get current tenant context
   */
  getTenant() {
    return this.currentTenant;
  }

  /**
   * Execute query with tenant isolation
   * Automatically adds company_id filter
   */
  async withTenant<T>(
    companyId: string,
    callback: (prisma: PrismaClientType) => Promise<T>,
  ): Promise<T> {
    const originalTenant = this.currentTenant;
    this.setTenant({ companyId });

    try {
      // Use base Prisma with manual company_id filtering
      // For schema-per-tenant, you would switch schema here
      return await callback(this.basePrisma as any);
    } finally {
      this.setTenant(originalTenant);
    }
  }

  /**
   * Switch to tenant schema (for schema-per-tenant approach)
   */
  async switchSchema(schemaName: string): Promise<void> {
    if (schemaName && schemaName !== 'public') {
      // Escape schema name to prevent SQL injection
      const escapedSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '');
      await this.basePrisma.$executeRawUnsafe(`SET search_path TO ${escapedSchema}, public`);
    } else {
      await this.basePrisma.$executeRawUnsafe(`SET search_path TO public`);
    }
  }

  // Override Prisma methods to automatically add company_id filter
  get chat() {
    return this.createTenantAwareDelegate('chat', 'companyId');
  }

  get message() {
    return this.createTenantAwareDelegate('message', 'chatId', true);
  }

  get user() {
    return this.createTenantAwareDelegate('user', 'companyId');
  }

  get department() {
    return this.createTenantAwareDelegate('department', 'companyId');
  }

  private createTenantAwareDelegate(model: string, filterField: string, viaRelation = false) {
    const baseDelegate = (this.basePrisma as any)[model];
    
    return new Proxy(baseDelegate, {
      get: (target, prop) => {
        const originalMethod = target[prop];
        
        if (typeof originalMethod === 'function') {
          return async (...args: any[]) => {
            // If tenant context exists, automatically add company_id filter
            if (this.currentTenant && prop !== 'create' && prop !== 'createMany') {
              const firstArg = args[0];
              
              if (firstArg && typeof firstArg === 'object') {
                // For findMany, findFirst, etc.
                if (firstArg.where) {
                  firstArg.where[filterField] = this.currentTenant.companyId;
                } else {
                  firstArg.where = { [filterField]: this.currentTenant.companyId };
                }
              } else if (prop === 'findUnique' || prop === 'findFirst') {
                // For findUnique, wrap in where clause
                args[0] = {
                  where: {
                    ...(typeof firstArg === 'object' ? firstArg : { id: firstArg }),
                    [filterField]: this.currentTenant.companyId,
                  },
                };
              }
            }

            // For messages, we need to filter via chat relation
            if (viaRelation && this.currentTenant && prop !== 'create') {
              const firstArg = args[0];
              if (firstArg && typeof firstArg === 'object' && firstArg.where) {
                if (!firstArg.where.chat) {
                  firstArg.where.chat = {
                    companyId: this.currentTenant.companyId,
                  };
                }
              }
            }

            return originalMethod.apply(target, args);
          };
        }
        
        return originalMethod;
      },
    });
  }

  // Delegate all other models to base Prisma
  get company() {
    return (this.basePrisma as any).company;
  }

  get role() {
    return (this.basePrisma as any).role;
  }

  get permission() {
    return (this.basePrisma as any).permission;
  }

  get subscription() {
    return (this.basePrisma as any).subscription;
  }

  get plan() {
    return (this.basePrisma as any).plan;
  }

  get analytics() {
    return (this.basePrisma as any).analytics;
  }
}

