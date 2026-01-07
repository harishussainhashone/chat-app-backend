import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create subscription (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async create(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(createSubscriptionDto);
  }

  @Get()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get all subscriptions (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'List of subscriptions' })
  async findAll() {
    return this.subscriptionsService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current company subscription' })
  @ApiResponse({ status: 200, description: 'Subscription details' })
  async getMySubscription(@CurrentUser() user: any) {
    return this.subscriptionsService.findByCompanyId(user.companyId);
  }

  @Get(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get subscription by ID (Super Admin only)' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription details' })
  async findOne(@Param('id') id: string) {
    return this.subscriptionsService.findOne(id);
  }

  @Patch(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update subscription (Super Admin only)' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.update(id, updateSubscriptionDto);
  }

  @Post('me/cancel')
  @RequirePermissions('billing_access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel current company subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled successfully' })
  async cancel(@CurrentUser() user: any) {
    return this.subscriptionsService.cancel(user.companyId);
  }

  @Post('me/upgrade')
  @RequirePermissions('billing_access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upgrade subscription plan' })
  @ApiResponse({ status: 200, description: 'Subscription upgraded successfully' })
  async upgrade(@CurrentUser() user: any, @Body() body: { planId: string }) {
    return this.subscriptionsService.upgrade(user.companyId, body.planId);
  }
}

