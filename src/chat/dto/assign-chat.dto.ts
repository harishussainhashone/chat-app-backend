import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignChatDto {
  @ApiProperty({ example: 'agent-uuid' })
  @IsUUID()
  @IsNotEmpty()
  agentId: string;
}

