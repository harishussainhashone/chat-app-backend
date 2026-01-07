import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Sales' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Sales department', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

