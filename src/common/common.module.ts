import { Module } from '@nestjs/common';
import { PlanCheckService } from './services/plan-check.service';

@Module({
  providers: [PlanCheckService],
  exports: [PlanCheckService],
})
export class CommonModule {}

