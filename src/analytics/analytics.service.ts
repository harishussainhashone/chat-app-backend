import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlanCheckService } from '../common/services/plan-check.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private planCheckService: PlanCheckService,
  ) {}

  async trackEvent(
    companyId: string,
    eventType: string,
    eventData: any,
    userId?: string,
  ) {
    // Check if plan allows analytics
    const hasFeature = await this.planCheckService.checkFeatureAccess(companyId, 'reports');
    if (!hasFeature) {
      return; // Silently skip if feature not available
    }

    return this.prisma.analytics.create({
      data: {
        companyId,
        userId,
        eventType,
        eventData: eventData as any,
      },
    });
  }

  async getChatStats(companyId: string, startDate?: Date, endDate?: Date) {
    // Check if plan allows reports
    const hasFeature = await this.planCheckService.checkFeatureAccess(companyId, 'reports');
    if (!hasFeature) {
      throw new ForbiddenException('Reports not available in your plan');
    }

    const where: any = { companyId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, pending, active, closed, byStatus, byDepartment] = await Promise.all([
      this.prisma.chat.count({ where }),
      this.prisma.chat.count({ where: { ...where, status: 'pending' } }),
      this.prisma.chat.count({ where: { ...where, status: 'active' } }),
      this.prisma.chat.count({ where: { ...where, status: 'closed' } }),
      this.prisma.chat.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.chat.groupBy({
        by: ['departmentId'],
        where,
        _count: true,
      }),
    ]);

    // Get average response time (time from chat creation to first agent message)
    const chatsWithFirstResponse = await this.prisma.chat.findMany({
      where: {
        ...where,
        messages: {
          some: {
            senderType: 'agent',
          },
        },
      },
      include: {
        messages: {
          where: {
            senderType: 'agent',
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    const responseTimes = chatsWithFirstResponse
      .map((chat) => {
        if (chat.messages.length > 0) {
          return (
            chat.messages[0].createdAt.getTime() - chat.createdAt.getTime()
          );
        }
        return null;
      })
      .filter((time) => time !== null) as number[];

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    return {
      total,
      pending,
      active,
      closed,
      byStatus,
      byDepartment,
      avgResponseTimeMs: avgResponseTime,
      avgResponseTimeMinutes: Math.round(avgResponseTime / 60000),
    };
  }

  async getAgentStats(companyId: string, agentId?: string, startDate?: Date, endDate?: Date) {
    const hasFeature = await this.planCheckService.checkFeatureAccess(companyId, 'reports');
    if (!hasFeature) {
      throw new ForbiddenException('Reports not available in your plan');
    }

    const where: any = {
      companyId,
      assignments: {
        some: {
          isActive: true,
        },
      },
    };

    if (agentId) {
      where.assignments = {
        some: {
          agentId,
          isActive: true,
        },
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [assignedChats, closedChats, avgRating] = await Promise.all([
      this.prisma.chat.count({ where }),
      this.prisma.chat.count({
        where: {
          ...where,
          status: 'closed',
        },
      }),
      this.prisma.chat.aggregate({
        where: {
          ...where,
          rating: { not: null },
        },
        _avg: {
          rating: true,
        },
      }),
    ]);

    return {
      assignedChats,
      closedChats,
      avgRating: avgRating._avg.rating || 0,
    };
  }

  async getEvents(companyId: string, eventType?: string, page: number = 1, limit: number = 50) {
    const hasFeature = await this.planCheckService.checkFeatureAccess(companyId, 'reports');
    if (!hasFeature) {
      throw new ForbiddenException('Reports not available in your plan');
    }

    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (eventType) {
      where.eventType = eventType;
    }

    const [events, total] = await Promise.all([
      this.prisma.analytics.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.analytics.count({ where }),
    ]);

    return {
      data: events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

