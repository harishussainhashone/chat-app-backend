import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Platform statistics' })
  async getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('companies')
  @ApiOperation({ summary: 'Get all companies (Super Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of companies' })
  async getAllCompanies(@Query() pagination: PaginationDto) {
    return this.adminService.getAllCompanies(pagination.page || 1, pagination.limit || 10);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users (Super Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of users' })
  async getAllUsers(@Query() pagination: PaginationDto) {
    return this.adminService.getAllUsers(pagination.page || 1, pagination.limit || 10);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions (Super Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'List of subscriptions' })
  async getAllSubscriptions(@Query() pagination: PaginationDto) {
    return this.adminService.getAllSubscriptions(pagination.page || 1, pagination.limit || 10);
  }
}

