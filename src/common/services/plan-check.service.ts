import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PlanCheckService {
  constructor(private prisma: PrismaService) {}

  async checkFeatureAccess(companyId: string, feature: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'active') {
      throw new ForbiddenException('Active subscription required');
    }

    return subscription.plan.allowedFeatures.includes(feature);
  }

  async checkLimit(companyId: string, limitType: 'users' | 'agents' | 'departments'): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'active') {
      throw new ForbiddenException('Active subscription required');
    }

    const plan = subscription.plan;
    let currentCount = 0;
    let maxLimit = 0;

    switch (limitType) {
      case 'users':
        currentCount = await this.prisma.user.count({
          where: { companyId, isActive: true },
        });
        maxLimit = plan.maxUsers;
        break;
      case 'agents':
        currentCount = await this.prisma.user.count({
          where: {
            companyId,
            isActive: true,
            role: {
              name: 'agent',
            },
          },
        });
        maxLimit = plan.maxAgents;
        break;
      case 'departments':
        currentCount = await this.prisma.department.count({
          where: { companyId, isActive: true },
        });
        maxLimit = plan.maxDepartments;
        break;
    }

    if (currentCount >= maxLimit) {
      throw new ForbiddenException(
        `Plan limit reached for ${limitType}. Current: ${currentCount}/${maxLimit}. Please upgrade your plan.`,
      );
    }
  }

  async getPlanLimits(companyId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new ForbiddenException('No active subscription found');
    }

    const plan = subscription.plan;

    const [userCount, agentCount, departmentCount] = await Promise.all([
      this.prisma.user.count({
        where: { companyId, isActive: true },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          isActive: true,
          role: {
            name: 'agent',
          },
        },
      }),
      this.prisma.department.count({
        where: { companyId, isActive: true },
      }),
    ]);

    return {
      plan: {
        name: plan.name,
        slug: plan.slug,
      },
      limits: {
        users: {
          current: userCount,
          max: plan.maxUsers,
          remaining: Math.max(0, plan.maxUsers - userCount),
        },
        agents: {
          current: agentCount,
          max: plan.maxAgents,
          remaining: Math.max(0, plan.maxAgents - agentCount),
        },
        departments: {
          current: departmentCount,
          max: plan.maxDepartments,
          remaining: Math.max(0, plan.maxDepartments - departmentCount),
        },
      },
      features: plan.allowedFeatures,
    };
  }
}

