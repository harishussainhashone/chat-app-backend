import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private isConnected = false;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    // Monitor connection status
    // Note: Event handlers are already set up in RedisModule,
    // but we add additional handlers here for service-level tracking
    
    this.redis.on('connect', () => {
      this.isConnected = true;
      this.logger.debug('Redis connection established');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      this.logger.debug('Redis is ready');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      // Don't log ECONNREFUSED errors as they're expected when Redis is down
      if (error.message && !error.message.includes('ECONNREFUSED')) {
        this.logger.debug(`Redis error in service: ${error.message}`);
      }
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.debug('Redis connection closed');
    });

    // Check initial connection status
    this.isConnected = this.redis.status === 'ready' || this.redis.status === 'connecting';
  }

  private async safeExecute<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    if (!this.isConnected && this.redis.status !== 'ready') {
      this.logger.warn('Redis is not connected. Operation skipped.');
      return fallback;
    }

    try {
      return await operation();
    } catch (error) {
      this.logger.warn(`Redis operation failed: ${error.message}. Using fallback value.`);
      return fallback;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.safeExecute(() => this.redis.get(key), null);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.safeExecute(async () => {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    }, undefined);
  }

  async del(key: string): Promise<void> {
    await this.safeExecute(() => this.redis.del(key), undefined);
  }

  async exists(key: string): Promise<number> {
    return this.safeExecute(() => this.redis.exists(key), 0);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.safeExecute(() => this.redis.expire(key, seconds), undefined);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.safeExecute(() => this.redis.sadd(key, ...members), 0);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.safeExecute(() => this.redis.srem(key, ...members), 0);
  }

  async smembers(key: string): Promise<string[]> {
    return this.safeExecute(() => this.redis.smembers(key), []);
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.safeExecute(() => this.redis.sismember(key, member), 0);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.safeExecute(() => this.redis.hset(key, field, value), 0);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.safeExecute(() => this.redis.hget(key, field), null);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.safeExecute(() => this.redis.hgetall(key), {});
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.safeExecute(() => this.redis.hdel(key, ...fields), 0);
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      try {
        await this.redis.quit();
      } catch (error) {
        this.logger.warn(`Error closing Redis connection: ${error.message}`);
      }
    }
  }
}

