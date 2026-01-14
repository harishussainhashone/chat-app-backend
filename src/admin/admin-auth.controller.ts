import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from '../auth/dto/login.dto';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { UnauthorizedException } from '@nestjs/common';

@ApiTags('admin')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login (Super Admin only)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or not a super admin' })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);

    // Verify user is super admin
    if (result.user.role !== 'super_admin') {
      throw new UnauthorizedException('Access denied. Super admin access required.');
    }

    return result;
  }
}

