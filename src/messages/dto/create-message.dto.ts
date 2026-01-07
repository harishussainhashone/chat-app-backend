import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'chat-uuid' })
  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ example: 'Hello, I need help!' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: 'text', default: 'text', required: false })
  @IsOptional()
  @IsString()
  messageType?: string;

  @ApiProperty({ example: 'visitor', required: false })
  @IsOptional()
  @IsString()
  senderType?: string;

  @ApiProperty({ example: 'user-uuid', required: false })
  @IsOptional()
  @IsUUID()
  senderId?: string;
}

