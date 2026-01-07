import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private plansService: PlansService,
  ) {}

  async create(createSubscriptionDto: CreateSubscriptionDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: createSubscriptionDto.companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const existingSubscription = await this.prisma.subscription.findUnique({
      where: { companyId: createSubscriptionDto.companyId },
    });

    if (existingSubscription) {
      throw new ConflictException('Company already has a subscription');
    }

    const plan = await this.plansService.findOne(createSubscriptionDto.planId);

    const now = new Date();
    const periodEnd = createSubscriptionDto.currentPeriodEnd
      ? new Date(createSubscriptionDto.currentPeriodEnd)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    return this.prisma.subscription.create({
      data: {
        companyId: createSubscriptionDto.companyId,
        planId: createSubscriptionDto.planId,
        status: createSubscriptionDto.status || 'active',
        currentPeriodStart: createSubscriptionDto.currentPeriodStart
          ? new Date(createSubscriptionDto.currentPeriodStart)
          : now,
        currentPeriodEnd: periodEnd,
      },
      include: {
        plan: true,
      },
    });
  }

  async findAll() {
    return this.prisma.subscription.findMany({
      include: {
        company: true,
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        company: true,
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async findByCompanyId(companyId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async update(id: string, updateSubscriptionDto: UpdateSubscriptionDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // If changing plan, update period dates
    if (updateSubscriptionDto.planId && updateSubscriptionDto.planId !== subscription.planId) {
      const plan = await this.plansService.findOne(updateSubscriptionDto.planId);
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      return this.prisma.subscription.update({
        where: { id },
        data: {
          ...updateSubscriptionDto,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        include: {
          plan: true,
        },
      });
    }

    return this.prisma.subscription.update({
      where: { id },
      data: updateSubscriptionDto,
      include: {
        plan: true,
      },
    });
  }

  async cancel(companyId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.subscription.update({
      where: { companyId },
      data: {
        status: 'cancelled',
        cancelAtPeriodEnd: true,
      },
    });
  }

  async upgrade(companyId: string, newPlanId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const newPlan = await this.plansService.findOne(newPlanId);

    if (newPlan.price <= subscription.plan.price) {
      throw new ForbiddenException('New plan must have higher price than current plan');
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.update({
      where: { companyId },
      data: {
        planId: newPlanId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: 'active',
      },
      include: {
        plan: true,
      },
    });
  }
}

