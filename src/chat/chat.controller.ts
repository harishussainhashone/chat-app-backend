import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { AssignChatDto } from './dto/assign-chat.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

@ApiTags('chats')
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Create a new chat (Widget endpoint)' })
  @ApiResponse({ status: 201, description: 'Chat created successfully' })
  async create(
    @Body() createChatDto: CreateChatDto & { widgetKey?: string },
    @Req() req: any,
  ) {
    // Widget key should be in headers or body
    const widgetKey = req.headers['x-widget-key'] || createChatDto.widgetKey;
    
    if (!widgetKey) {
      throw new BadRequestException('Widget key required');
    }

    const company = await this.prisma.company.findUnique({
      where: { widgetKey },
    });

    if (!company || !company.isActive) {
      throw new ForbiddenException('Invalid widget key');
    }

    const visitorIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const visitorUserAgent = req.headers['user-agent'];

    return this.chatService.create(createChatDto, company.id, visitorIp, visitorUserAgent);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('view_all_chats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all chats' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of chats' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.chatService.findAll(
      user.companyId,
      status,
      pagination.page || 1,
      pagination.limit || 10,
    );
  }

  @Get('queue')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('assign_chat')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get chat queue' })
  @ApiResponse({ status: 200, description: 'Chat queue' })
  async getQueue(@CurrentUser() user: any) {
    return this.chatService.getQueue(user.companyId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('view_all_chats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get chat by ID' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiResponse({ status: 200, description: 'Chat details' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.chatService.findOne(id, user.companyId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('assign_chat')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update chat' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiResponse({ status: 200, description: 'Chat updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateChatDto: UpdateChatDto,
    @CurrentUser() user: any,
  ) {
    return this.chatService.update(id, updateChatDto, user.companyId);
  }

  @Post(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('assign_chat')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Assign chat to agent' })
  @ApiParam({ name: 'id', description: 'Chat ID' })
  @ApiResponse({ status: 200, description: 'Chat assigned successfully' })
  async assign(
    @Param('id') id: string,
    @Body() assignChatDto: AssignChatDto,
    @CurrentUser() user: any,
  ) {
    return this.chatService.assign(id, assignChatDto, user.companyId, user.userId);
  }
}

