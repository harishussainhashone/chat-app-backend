import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async create(createMessageDto: CreateMessageDto, companyId: string) {
    // Verify chat belongs to company
    const chat = await this.prisma.chat.findUnique({
      where: { id: createMessageDto.chatId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Verify sender if agent
    if (createMessageDto.senderId) {
      const sender = await this.prisma.user.findUnique({
        where: { id: createMessageDto.senderId },
      });

      if (!sender || sender.companyId !== companyId) {
        throw new ForbiddenException('Invalid sender');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        chatId: createMessageDto.chatId,
        content: createMessageDto.content,
        messageType: createMessageDto.messageType || 'text',
        senderType: createMessageDto.senderType || 'visitor',
        senderId: createMessageDto.senderId || null,
      },
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
    });

    return message;
  }

  async findAll(chatId: string, companyId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    // Verify chat belongs to company
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { chatId },
        skip,
        take: limit,
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where: { chatId } }),
    ]);

    return {
      data: messages.reverse(), // Return in chronological order
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, companyId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        chat: true,
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
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Enforce company isolation
    if (message.chat.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    return message;
  }

  async markAsRead(chatId: string, userId: string, companyId: string) {
    // Verify chat belongs to company
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat || chat.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    // Mark all unread messages as read
    await this.prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { message: 'Messages marked as read' };
  }
}

