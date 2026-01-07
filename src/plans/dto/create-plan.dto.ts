import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Basic' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'basic' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'Perfect for small teams', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 29.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'monthly' })
  @IsString()
  @IsNotEmpty()
  billingCycle: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  maxUsers: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  maxAgents: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  maxDepartments: number;

  @ApiProperty({ example: ['roles', 'reports'] })
  @IsArray()
  @IsString({ each: true })
  allowedFeatures: string[];

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  chatHistoryRetentionDays: number;

  @ApiProperty({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

