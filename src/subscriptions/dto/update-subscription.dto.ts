import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ example: 'plan-uuid' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({ example: 'stripe_subscription_id' })
  @IsOptional()
  @IsString()
  stripeSubscriptionId?: string;

  @ApiPropertyOptional({ example: 'stripe_customer_id' })
  @IsOptional()
  @IsString()
  stripeCustomerId?: string;
}

