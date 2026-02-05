import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PlanCheckService } from '../common/services/plan-check.service';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private planCheckService: PlanCheckService,
  ) {}

  async create(createRoleDto: CreateRoleDto, companyId: string) {
    // Check if plan allows role management
    const hasFeature = await this.planCheckService.checkFeatureAccess(companyId, 'roles');
    if (!hasFeature) {
      throw new ForbiddenException('Role management not available in your plan');
    }

    // Check if role name already exists for this company
    const existingRole = await this.prisma.role.findFirst({
      where: {
        name: createRoleDto.name,
        companyId,
      },
    });

    if (existingRole) {
      throw new ConflictException('Role name already exists');
    }

    // Create role with permissions
    const role = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newRole = await tx.role.create({
        data: {
          name: createRoleDto.name,
          description: createRoleDto.description,
          companyId,
          isSystem: false,
        },
      });

      // Assign permissions if provided
      if (createRoleDto.permissionIds && createRoleDto.permissionIds.length > 0) {
        // Verify permissions exist
        const permissions = await tx.permission.findMany({
          where: {
            id: { in: createRoleDto.permissionIds },
          },
        });

        if (permissions.length !== createRoleDto.permissionIds.length) {
          throw new NotFoundException('Some permissions not found');
        }

        await tx.rolePermission.createMany({
          data: createRoleDto.permissionIds.map((permissionId) => ({
            roleId: newRole.id,
            permissionId,
          })),
        });
      }

      return newRole;
    });

    return this.findOne(role.id, companyId);
  }

  async findAll(companyId: string) {
    return this.prisma.role.findMany({
      where: {
        OR: [
          { companyId },
          { isSystem: true, companyId: null },
        ],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string, companyId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Enforce company isolation (system roles are accessible to all)
    if (!role.isSystem && role.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, companyId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Cannot update system roles
    if (role.isSystem) {
      throw new ForbiddenException('Cannot update system roles');
    }

    // Enforce company isolation
    if (role.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Check if new name conflicts
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          name: updateRoleDto.name,
          companyId,
        },
      });

      if (existingRole) {
        throw new ConflictException('Role name already exists');
      }
    }

    // Update role
    const updatedRole = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const roleUpdate: any = {};

      if (updateRoleDto.name) {
        roleUpdate.name = updateRoleDto.name;
      }

      if (updateRoleDto.description !== undefined) {
        roleUpdate.description = updateRoleDto.description;
      }

      const updated = await tx.role.update({
        where: { id },
        data: roleUpdate,
      });

      // Update permissions if provided
      if (updateRoleDto.permissionIds !== undefined) {
        // Remove existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        // Add new permissions
        if (updateRoleDto.permissionIds.length > 0) {
          // Verify permissions exist
          const permissions = await tx.permission.findMany({
            where: {
              id: { in: updateRoleDto.permissionIds },
            },
          });

          if (permissions.length !== updateRoleDto.permissionIds.length) {
            throw new NotFoundException('Some permissions not found');
          }

          await tx.rolePermission.createMany({
            data: updateRoleDto.permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }

      return updated;
    });

    return this.findOne(updatedRole.id, companyId);
  }

  async remove(id: string, companyId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Cannot delete system roles
    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    // Enforce company isolation
    if (role.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Cannot delete role if users are assigned
    if (role._count.users > 0) {
      throw new ConflictException('Cannot delete role with assigned users');
    }

    await this.prisma.role.delete({
      where: { id },
    });

    return { message: 'Role deleted successfully' };
  }
}

