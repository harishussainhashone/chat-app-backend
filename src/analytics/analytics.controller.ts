import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  @RequirePermissions('view_reports')
  @ApiOperation({ summary: 'Track an analytics event' })
  @ApiResponse({ status: 201, description: 'Event tracked successfully' })
  async trackEvent(
    @Body() body: { eventType: string; eventData: any },
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.trackEvent(
      user.companyId,
      body.eventType,
      body.eventData,
      user.userId,
    );
  }

  @Get('chats')
  @RequirePermissions('view_reports')
  @ApiOperation({ summary: 'Get chat statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiResponse({ status: 200, description: 'Chat statistics' })
  async getChatStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getChatStats(
      user.companyId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('agents')
  @RequirePermissions('view_reports')
  @ApiOperation({ summary: 'Get agent statistics' })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiResponse({ status: 200, description: 'Agent statistics' })
  async getAgentStats(
    @Query('agentId') agentId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getAgentStats(
      user.companyId,
      agentId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('events')
  @RequirePermissions('view_reports')
  @ApiOperation({ summary: 'Get analytics events' })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiResponse({ status: 200, description: 'List of events' })
  async getEvents(
    @Query() pagination: PaginationDto,
    @Query('eventType') eventType: string,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.getEvents(
      user.companyId,
      eventType,
      pagination.page || 1,
      pagination.limit || 50,
    );
  }
}

