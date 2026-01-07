import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const refreshToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        token: payload.token,
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

    if (!refreshToken || !refreshToken.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!refreshToken.user.company.isActive) {
      throw new UnauthorizedException('Company is inactive');
    }

    return {
      userId: refreshToken.user.id,
      email: refreshToken.user.email,
      companyId: refreshToken.user.companyId,
      roleId: refreshToken.user.roleId,
      roleName: refreshToken.user.role.name,
      refreshToken: payload.token,
    };
  }
}

