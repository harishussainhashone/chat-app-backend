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

@ApiTags('companies')
@Controller('companies/auth')
export class CompaniesAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Company user login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);

    // Verify user is NOT super admin (super admin should use /admin/auth/login)
    if (result.user.role === 'super_admin') {
      throw new UnauthorizedException('Super admin must use /admin/auth/login endpoint');
    }

    return result;
  }
}

