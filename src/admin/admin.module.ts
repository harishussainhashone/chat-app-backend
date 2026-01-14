import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminAuthController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

