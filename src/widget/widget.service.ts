import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class WidgetService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getWidgetConfig(widgetKey: string) {
    const company = await this.prisma.company.findUnique({
      where: { widgetKey },
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (!company.isActive) {
      throw new ForbiddenException('Company is inactive');
    }

    const subscription = company.subscriptions;
    if (!subscription || subscription.status !== 'active') {
      throw new ForbiddenException('Company subscription is not active');
    }

    return {
      companyId: company.id,
      widgetKey: company.widgetKey,
      theme: company.widgetTheme || {
        primaryColor: '#007bff',
        position: 'bottom-right',
      },
      isActive: company.isActive,
    };
  }

  async getOnlineAgents(companyId: string) {
    const onlineAgentIds = await this.redis.smembers(`online:${companyId}`);
    
    if (onlineAgentIds.length === 0) {
      return [];
    }

    const agents = await this.prisma.user.findMany({
      where: {
        id: { in: onlineAgentIds },
        companyId,
        isActive: true,
        role: {
          name: 'agent',
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });

    return agents;
  }
}

