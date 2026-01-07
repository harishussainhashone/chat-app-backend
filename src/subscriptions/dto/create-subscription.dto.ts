import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'company-uuid' })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({ example: 'plan-uuid' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ example: 'active', required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  currentPeriodStart?: string;

  @ApiProperty({ example: '2024-02-01T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;
}

