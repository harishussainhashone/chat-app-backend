import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

if (process.env.PRISMA_CLIENT_ENGINE_TYPE === 'client') {
  // Avoid "client" engine unless an adapter/accelerate URL is configured.
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
}

type PrismaClientType = import('@prisma/client').PrismaClient;
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: new (...args: any[]) => PrismaClientType;
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      // Security: require an explicit DB URL; no fallbacks to avoid accidental connections.
      throw new Error('DATABASE_URL is required to initialize PrismaClient');
    }
    // Pass a minimal valid option to satisfy PrismaClient constructor validation.
    super({ errorFormat: 'pretty' } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}