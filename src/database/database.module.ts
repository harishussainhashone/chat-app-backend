import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';
import { TenantSchemaService } from './tenant-schema.service';

@Global()
@Module({
  providers: [PrismaService, TenantPrismaService, TenantSchemaService],
  exports: [PrismaService, TenantPrismaService, TenantSchemaService],
})
export class DatabaseModule {}

