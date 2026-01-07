import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { AssignChatDto } from './dto/assign-chat.dto';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(createChatDto: CreateChatDto, companyId: string, visitorIp?: string, visitorUserAgent?: string) {
    // Generate visitor ID if not provided
    const visitorId = createChatDto.visitorId || `visitor_${uuidv4()}`;

    // Verify department belongs to company if provided
    if (createChatDto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: createChatDto.departmentId },
      });

      if (!department || department.companyId !== companyId) {
        throw new ForbiddenException('Department not found or does not belong to your company');
      }
    }

    const chat = await this.prisma.chat.create({
      data: {
        companyId,
        visitorId,
        visitorName: createChatDto.visitorName,
        visitorEmail: createChatDto.visitorEmail,
        visitorPhone: createChatDto.visitorPhone,
        visitorIp,
        visitorUserAgent,
        departmentId: createChatDto.departmentId,
        status: 'pending',
      },
      include: {
        company: true,
        department: true,
        assignments: {
          include: {
            agent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // Add to Redis queue
    await this.redis.sadd(`chat:queue:${companyId}`, chat.id);

    return chat;
  }

  async findAll(companyId: string, status?: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (status) {
      where.status = status;
    }

    const [chats, total] = await Promise.all([
      this.prisma.chat.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: true,
          assignments: {
            where: { isActive: true },
            include: {
              agent: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.chat.count({ where }),
    ]);

    return {
      data: chats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, companyId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      include: {
        company: true,
        department: true,
        assignments: {
          include: {
            agent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Enforce company isolation
    if (chat.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    return chat;
  }

  async update(id: string, updateChatDto: UpdateChatDto, companyId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Enforce company isolation
    if (chat.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // If closing chat, set closedAt
    const updateData: any = { ...updateChatDto };
    if (updateChatDto.status === 'closed' && chat.status !== 'closed') {
      updateData.closedAt = new Date();
    }

    return this.prisma.chat.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        assignments: {
          where: { isActive: true },
          include: {
            agent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async assign(id: string, assignChatDto: AssignChatDto, companyId: string, assignedBy: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Enforce company isolation
    if (chat.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Verify agent belongs to company
    const agent = await this.prisma.user.findUnique({
      where: { id: assignChatDto.agentId },
    });

    if (!agent || agent.companyId !== companyId) {
      throw new NotFoundException('Agent not found');
    }

    // Deactivate existing assignments
    await this.prisma.chatAssignment.updateMany({
      where: {
        chatId: id,
        isActive: true,
      },
      data: {
        isActive: false,
        unassignedAt: new Date(),
      },
    });

    // Create new assignment
    const assignment = await this.prisma.chatAssignment.create({
      data: {
        chatId: id,
        agentId: assignChatDto.agentId,
        assignedBy,
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update chat status
    await this.prisma.chat.update({
      where: { id },
      data: { status: 'assigned' },
    });

    // Remove from queue
    await this.redis.srem(`chat:queue:${companyId}`, id);

    return assignment;
  }

  async getQueue(companyId: string) {
    const queueIds = await this.redis.smembers(`chat:queue:${companyId}`);

    if (queueIds.length === 0) {
      return [];
    }

    return this.prisma.chat.findMany({
      where: {
        id: { in: queueIds },
        companyId,
        status: 'pending',
      },
      include: {
        department: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

