import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ChatModule } from './chat/chat.module';
import { MessagesModule } from './messages/messages.module';
import { DepartmentsModule } from './departments/departments.module';
import { WidgetModule } from './widget/widget.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { RedisModule } from './redis/redis.module';
import { TenantDetectionMiddleware } from './common/middleware/tenant-detection.middleware';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
      },
    ]),
    DatabaseModule,
    RedisModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    PlansModule,
    SubscriptionsModule,
    ChatModule,
    MessagesModule,
    DepartmentsModule,
    WidgetModule,
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  // Tenant detection middleware removed - frontend will handle subdomain routing
  // Backend will work with direct API calls without subdomain validation
}

