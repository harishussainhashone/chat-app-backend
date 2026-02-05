import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        company: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    if (!user.company.isActive) {
      throw new UnauthorizedException('Company account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        companyId: user.companyId,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if company name/slug already exists
    const slug = registerDto.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existingCompany = await this.prisma.company.findUnique({
      where: { slug },
    });

    if (existingCompany) {
      throw new ConflictException('Company name already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Get company_admin role (system role)
    const companyAdminRole = await this.prisma.role.findFirst({
      where: {
        name: 'company_admin',
        isSystem: true,
        companyId: null,
      },
    });

    if (!companyAdminRole) {
      throw new BadRequestException('System role not found');
    }

    // Get Basic plan (default)
    const basicPlan = await this.prisma.plan.findUnique({
      where: { slug: 'basic' },
    });

    if (!basicPlan) {
      throw new BadRequestException('Default plan not found');
    }

    // Create company and user in transaction
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create company
      const company = await tx.company.create({
        data: {
          name: registerDto.companyName,
          slug,
          email: registerDto.email,
          widgetKey: `widget_${uuidv4()}`,
          isActive: true,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          companyId: company.id,
          roleId: companyAdminRole.id,
          isActive: true,
          isEmailVerified: false,
        },
        include: {
          role: true,
        },
      });

      // Create subscription (trial)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

      await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: basicPlan.id,
          status: 'trial',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
        },
      });

      return { user, company };
    });

    const tokens = await this.generateTokens(result.user.id, result.user.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role.name,
        companyId: result.user.companyId,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            role: true,
            company: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!tokenRecord.user.isActive || !tokenRecord.user.company.isActive) {
      throw new UnauthorizedException('User or company is inactive');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    // Generate new tokens
    const tokens = await this.generateTokens(
      tokenRecord.user.id,
      tokenRecord.user.email,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          token: refreshToken,
        },
        data: {
          isRevoked: true,
        },
      });
    } else {
      // Revoke all user tokens
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
        },
      });
    }
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const refreshTokenPayload = {
      ...payload,
      token: uuidv4(),
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenPayload.token,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenPayload.token,
    };
  }
}

