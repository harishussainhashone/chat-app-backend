import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({ example: 'visitor-uuid', required: false })
  @IsOptional()
  @IsString()
  visitorId?: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  visitorName?: string;

  @ApiProperty({ example: 'visitor@example.com', required: false })
  @IsOptional()
  @IsString()
  visitorEmail?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  visitorPhone?: string;

  @ApiProperty({ example: 'department-uuid', required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

