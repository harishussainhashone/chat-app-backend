import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateWidgetThemeDto } from './dto/update-widget-theme.dto';
import { TenantSchemaService } from '../database/tenant-schema.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private tenantSchemaService: TenantSchemaService,
  ) {}

  async create(createCompanyDto: CreateCompanyDto) {
    const existingSlug = await this.prisma.company.findUnique({
      where: { slug: createCompanyDto.slug },
    });

    if (existingSlug) {
      throw new ForbiddenException('Company slug already exists');
    }

    const company = await this.prisma.company.create({
      data: {
        ...createCompanyDto,
        widgetKey: `widget_${uuidv4()}`,
      },
    });

    // Create tenant schema if using schema-per-tenant approach
    // Uncomment the line below if you want schema-per-tenant isolation
    // await this.tenantSchemaService.createTenantSchema(company.id);

    return company;
  }

  async findOne(id: string, companyId?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            chats: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Enforce company isolation for non-super-admin users
    if (companyId && company.id !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    return company;
  }

  async findBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async findByWidgetKey(widgetKey: string) {
    const company = await this.prisma.company.findUnique({
      where: { widgetKey },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (!company.isActive) {
      throw new ForbiddenException('Company is inactive');
    }

    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto, companyId?: string) {
    // Enforce company isolation
    if (companyId && id !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
    });
  }

  async updateWidgetTheme(companyId: string, updateWidgetThemeDto: UpdateWidgetThemeDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        widgetTheme: updateWidgetThemeDto.widgetTheme as any,
      },
    });
  }

  async getMyCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
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
            departments: true,
          },
        },
      },
    });

    if (company) {
      return {
        ...company,
        subscription: company.subscriptions[0] || null,
      };
    }

    return company;
  }
}

