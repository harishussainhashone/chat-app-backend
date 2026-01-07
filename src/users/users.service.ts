import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PlanCheckService } from '../common/services/plan-check.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private planCheckService: PlanCheckService,
  ) {}

  async create(createUserDto: CreateUserDto, companyId: string) {
    // Check plan limits
    await this.planCheckService.checkLimit(companyId, 'users');

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Verify role belongs to company or is system role
    const role = await this.prisma.role.findUnique({
      where: { id: createUserDto.roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!role.isSystem && role.companyId !== companyId) {
      throw new ForbiddenException('Role does not belong to your company');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user with departments
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: createUserDto.email,
          password: hashedPassword,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          phone: createUserDto.phone,
          avatar: createUserDto.avatar,
          companyId,
          roleId: createUserDto.roleId,
        },
        include: {
          role: true,
        },
      });

      // Assign departments if provided
      if (createUserDto.departmentIds && createUserDto.departmentIds.length > 0) {
        // Verify departments belong to company
        const departments = await tx.department.findMany({
          where: {
            id: { in: createUserDto.departmentIds },
            companyId,
          },
        });

        if (departments.length !== createUserDto.departmentIds.length) {
          throw new ForbiddenException('Some departments do not belong to your company');
        }

        await tx.userDepartment.createMany({
          data: createUserDto.departmentIds.map((deptId) => ({
            userId: newUser.id,
            departmentId: deptId,
          })),
        });
      }

      return newUser;
    });

    return this.findOne(user.id, companyId);
  }

  async findAll(companyId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId },
        skip,
        take: limit,
        include: {
          role: true,
          userDepartments: {
            include: {
              department: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({
        where: { companyId },
      }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        company: true,
        userDepartments: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Enforce company isolation
    if (user.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async update(id: string, updateUserDto: UpdateUserDto, companyId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Enforce company isolation
    if (user.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // If email is being updated, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }

    // If role is being updated, verify it belongs to company
    if (updateUserDto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: updateUserDto.roleId },
      });

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      if (!role.isSystem && role.companyId !== companyId) {
        throw new ForbiddenException('Role does not belong to your company');
      }
    }

    // Update user
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const userUpdate: any = {
        firstName: updateUserDto.firstName,
        lastName: updateUserDto.lastName,
        phone: updateUserDto.phone,
        avatar: updateUserDto.avatar,
        isActive: updateUserDto.isActive,
      };

      if (updateUserDto.email) {
        userUpdate.email = updateUserDto.email;
      }

      if (updateUserDto.roleId) {
        userUpdate.roleId = updateUserDto.roleId;
      }

      const updated = await tx.user.update({
        where: { id },
        data: userUpdate,
        include: {
          role: true,
        },
      });

      // Update departments if provided
      if (updateUserDto.departmentIds !== undefined) {
        // Remove existing departments
        await tx.userDepartment.deleteMany({
          where: { userId: id },
        });

        // Add new departments
        if (updateUserDto.departmentIds.length > 0) {
          // Verify departments belong to company
          const departments = await tx.department.findMany({
            where: {
              id: { in: updateUserDto.departmentIds },
              companyId,
            },
          });

          if (departments.length !== updateUserDto.departmentIds.length) {
            throw new ForbiddenException('Some departments do not belong to your company');
          }

          await tx.userDepartment.createMany({
            data: updateUserDto.departmentIds.map((deptId) => ({
              userId: id,
              departmentId: deptId,
            })),
          });
        }
      }

      return updated;
    });

    return this.findOne(updatedUser.id, companyId);
  }

  async remove(id: string, companyId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Enforce company isolation
    if (user.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Prevent deleting yourself
    // This check should be done at controller level with current user

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }
}

