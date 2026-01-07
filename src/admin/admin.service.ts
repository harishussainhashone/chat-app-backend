import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const [
      totalCompanies,
      activeCompanies,
      totalUsers,
      totalChats,
      totalMessages,
      totalSubscriptions,
      activeSubscriptions,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.chat.count(),
      this.prisma.message.count(),
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { status: 'active' } }),
    ]);

    return {
      companies: {
        total: totalCompanies,
        active: activeCompanies,
      },
      users: {
        total: totalUsers,
      },
      chats: {
        total: totalChats,
      },
      messages: {
        total: totalMessages,
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
      },
    };
  }

  async getAllCompanies(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        skip,
        take: limit,
        include: {
          subscriptions: {
            include: {
              plan: true,
            },
            take: 1,
          },
          _count: {
            select: {
              users: true,
              chats: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count(),
    ]);

    // Map subscriptions array to subscription object for backward compatibility
    const companiesWithSubscription = companies.map((company) => ({
      ...company,
      subscription: company.subscriptions[0] || null,
    }));

    return {
      data: companiesWithSubscription,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllUsers(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    // Remove passwords
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);

    return {
      data: usersWithoutPasswords,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllSubscriptions(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        skip,
        take: limit,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.count(),
    ]);

    return {
      data: subscriptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

