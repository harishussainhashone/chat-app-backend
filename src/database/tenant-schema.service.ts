import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Service to manage tenant schemas (schema-per-tenant approach)
 */
@Injectable()
export class TenantSchemaService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create tenant schema when a new company is created
   * Call this after company creation
   */
  async createTenantSchema(companyId: string): Promise<void> {
    const schemaName = `tenant_${companyId.replace(/-/g, '_')}`;

    try {
      // Create schema
      await this.prisma.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS ${this.escapeIdentifier(schemaName)}`,
      );

      // Create tables in tenant schema (copy structure from public)
      await this.createTenantTables(schemaName);

      // Create indexes
      await this.createTenantIndexes(schemaName);
    } catch (error) {
      console.error(`Failed to create tenant schema for ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Drop tenant schema when company is deleted
   */
  async dropTenantSchema(companyId: string): Promise<void> {
    const schemaName = `tenant_${companyId.replace(/-/g, '_')}`;

    try {
      await this.prisma.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS ${this.escapeIdentifier(schemaName)} CASCADE`,
      );
    } catch (error) {
      console.error(`Failed to drop tenant schema for ${companyId}:`, error);
      throw error;
    }
  }

  private async createTenantTables(schemaName: string): Promise<void> {
    const tables = [
      'chats',
      'messages',
      'users',
      'departments',
      'chat_assignments',
      'user_departments',
    ];

    for (const table of tables) {
      await this.prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS ${this.escapeIdentifier(schemaName)}.${this.escapeIdentifier(table)} 
         (LIKE public.${this.escapeIdentifier(table)} INCLUDING ALL)`,
      );
    }
  }

  private async createTenantIndexes(schemaName: string): Promise<void> {
    const indexes = [
      // Chat indexes
      `CREATE INDEX IF NOT EXISTS ${this.escapeIdentifier('chats_company_id_status_idx')} 
       ON ${this.escapeIdentifier(schemaName)}.chats (company_id, status)`,
      `CREATE INDEX IF NOT EXISTS ${this.escapeIdentifier('chats_company_id_created_at_desc_idx')} 
       ON ${this.escapeIdentifier(schemaName)}.chats (company_id, created_at DESC)`,
      // Message indexes
      `CREATE INDEX IF NOT EXISTS ${this.escapeIdentifier('messages_chat_id_created_at_asc_idx')} 
       ON ${this.escapeIdentifier(schemaName)}.messages (chat_id, created_at ASC)`,
      `CREATE INDEX IF NOT EXISTS ${this.escapeIdentifier('messages_chat_id_is_read_idx')} 
       ON ${this.escapeIdentifier(schemaName)}.messages (chat_id, is_read)`,
    ];

    for (const indexSql of indexes) {
      await this.prisma.$executeRawUnsafe(indexSql);
    }
  }

  private escapeIdentifier(identifier: string): string {
    // Simple escaping - in production, use proper SQL identifier escaping
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}

