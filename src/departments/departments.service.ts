import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PlanCheckService } from '../common/services/plan-check.service';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private planCheckService: PlanCheckService,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto, companyId: string) {
    // Check plan limits
    await this.planCheckService.checkLimit(companyId, 'departments');

    // Check if department name already exists for this company
    const existing = await this.prisma.department.findFirst({
      where: {
        companyId,
        name: createDepartmentDto.name,
      },
    });

    if (existing) {
      throw new ConflictException('Department name already exists');
    }

    return this.prisma.department.create({
      data: {
        ...createDepartmentDto,
        companyId,
      },
      include: {
        _count: {
          select: {
            chats: true,
            userDepartments: true,
          },
        },
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId },
      include: {
        _count: {
          select: {
            chats: true,
            userDepartments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        userDepartments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            chats: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Enforce company isolation
    if (department.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    return department;
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto, companyId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Enforce company isolation
    if (department.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Check name conflict if name is being updated
    if (updateDepartmentDto.name && updateDepartmentDto.name !== department.name) {
      const existing = await this.prisma.department.findFirst({
        where: {
          companyId,
          name: updateDepartmentDto.name,
        },
      });

      if (existing) {
        throw new ConflictException('Department name already exists');
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
    });
  }

  async remove(id: string, companyId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            chats: true,
            userDepartments: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Enforce company isolation
    if (department.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    if (department._count.chats > 0) {
      throw new ConflictException('Cannot delete department with active chats');
    }

    await this.prisma.department.delete({
      where: { id },
    });

    return { message: 'Department deleted successfully' };
  }
}

