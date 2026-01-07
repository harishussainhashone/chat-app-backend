import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PlanRestrictionMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;

    if (!user || !user.companyId) {
      return next();
    }

    // Get company subscription
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId: user.companyId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'active') {
      throw new ForbiddenException('Active subscription required');
    }

    // Attach plan info to request
    (req as any).subscription = subscription;
    (req as any).plan = subscription.plan;

    next();
  }
}

