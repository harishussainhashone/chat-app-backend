import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        
        // Create Redis client with lazy connect
        const redisClient = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          lazyConnect: true, // Don't connect immediately
          maxRetriesPerRequest: null, // Disable automatic retries on failed requests
          enableOfflineQueue: false, // Don't queue commands when offline
          showFriendlyErrorStack: false, // Reduce error noise
          retryStrategy: (times) => {
            // Limit retry attempts to prevent infinite loops
            if (times > 10) {
              // Stop retrying after 10 attempts to reduce error noise
              return null; // Stop retrying
            }
            const delay = Math.min(times * 100, 3000);
            // Only log every 5th attempt to reduce noise
            if (times > 1 && times % 5 === 0) {
              logger.debug(`Redis connection attempt ${times}...`);
            }
            return delay;
          },
        });

        // CRITICAL: Set up ALL event handlers BEFORE any connection attempt
        // This prevents "Unhandled error event" warnings
        
        redisClient.on('connect', () => {
          logger.log('Redis connected successfully');
        });

        redisClient.on('ready', () => {
          logger.log('Redis is ready to accept commands');
        });

        // Handle ALL error events to prevent unhandled errors
        redisClient.on('error', (error: Error) => {
          // Suppress ECONNREFUSED errors (expected when Redis is not running)
          const errorMessage = error?.message || '';
          const isConnectionRefused = 
            errorMessage.includes('ECONNREFUSED') || 
            errorMessage.includes('connect ECONNREFUSED') ||
            (error as any)?.code === 'ECONNREFUSED';
          
          // Only log non-connection errors
          if (!isConnectionRefused) {
            logger.warn(`Redis error: ${errorMessage}`);
          }
          // Don't throw - let the app continue without Redis
        });

        redisClient.on('close', () => {
          logger.debug('Redis connection closed');
        });

        redisClient.on('reconnecting', (delay: number) => {
          logger.debug(`Redis reconnecting in ${delay}ms...`);
        });

        redisClient.on('end', () => {
          logger.debug('Redis connection ended');
        });

        // Attempt to connect asynchronously, but don't fail if it doesn't work
        // Use setTimeout to ensure event handlers are registered first
        setTimeout(() => {
          redisClient.connect().catch((error) => {
            // Only log if it's not a connection refused error
            if (!error.message || !error.message.includes('ECONNREFUSED')) {
              logger.warn(`Redis initial connection failed: ${error.message}. The app will continue without Redis.`);
            }
          });
        }, 0);

        return redisClient;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService, 'REDIS_CLIENT'],
})
export class RedisModule {}

