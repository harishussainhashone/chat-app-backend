import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WidgetService } from './widget.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('widget')
@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Get('config/:widgetKey')
  @Public()
  @ApiOperation({ summary: 'Get widget configuration (Public)' })
  @ApiParam({ name: 'widgetKey', description: 'Widget key' })
  @ApiResponse({ status: 200, description: 'Widget configuration' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getConfig(@Param('widgetKey') widgetKey: string) {
    return this.widgetService.getWidgetConfig(widgetKey);
  }

  @Get('online-agents')
  @Public()
  @ApiOperation({ summary: 'Get online agents for widget (Public)' })
  @ApiQuery({ name: 'widgetKey', description: 'Widget key' })
  @ApiResponse({ status: 200, description: 'List of online agents' })
  async getOnlineAgents(@Query('widgetKey') widgetKey: string) {
    const config = await this.widgetService.getWidgetConfig(widgetKey);
    return this.widgetService.getOnlineAgents(config.companyId);
  }
}

