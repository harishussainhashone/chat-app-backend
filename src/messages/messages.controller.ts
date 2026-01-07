import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('messages')
@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @RequirePermissions('view_all_chats')
  @ApiOperation({ summary: 'Create a new message' })
  @ApiResponse({ status: 201, description: 'Message created successfully' })
  async create(@Body() createMessageDto: CreateMessageDto, @CurrentUser() user: any) {
    return this.messagesService.create(createMessageDto, user.companyId);
  }

  @Get('chat/:chatId')
  @RequirePermissions('view_all_chats')
  @ApiOperation({ summary: 'Get all messages for a chat' })
  @ApiParam({ name: 'chatId', description: 'Chat ID' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  async findAll(
    @Param('chatId') chatId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.findAll(
      chatId,
      user.companyId,
      pagination.page || 1,
      pagination.limit || 50,
    );
  }

  @Get(':id')
  @RequirePermissions('view_all_chats')
  @ApiOperation({ summary: 'Get message by ID' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message details' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.messagesService.findOne(id, user.companyId);
  }

  @Post('chat/:chatId/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('view_all_chats')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiParam({ name: 'chatId', description: 'Chat ID' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(@Param('chatId') chatId: string, @CurrentUser() user: any) {
    return this.messagesService.markAsRead(chatId, user.userId, user.companyId);
  }
}

