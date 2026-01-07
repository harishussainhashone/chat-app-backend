import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CompanyIsolationInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.companyId) {
      throw new BadRequestException('Company context required');
    }

    // Ensure company_id is set in query/body/params where applicable
    if (request.body && typeof request.body === 'object' && !request.body.companyId) {
      request.body.companyId = user.companyId;
    }

    if (request.query && !request.query.companyId) {
      request.query.companyId = user.companyId;
    }

    return next.handle();
  }
}

