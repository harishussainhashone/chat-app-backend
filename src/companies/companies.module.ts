import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompaniesAuthController } from './companies-auth.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CompaniesController, CompaniesAuthController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}

