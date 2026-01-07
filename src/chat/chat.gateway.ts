import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChatService } from './chat.service';
import { MessagesService } from '../messages/messages.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
    private chatService: ChatService,
    private messagesService: MessagesService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        // Widget connection - validate widget key
        const widgetKey = client.handshake.auth?.widgetKey;
        if (!widgetKey) {
          client.disconnect();
          return;
        }

        const company = await this.prisma.company.findUnique({
          where: { widgetKey },
        });

        if (!company || !company.isActive) {
          client.disconnect();
          return;
        }

        client.data.companyId = company.id;
        client.data.type = 'visitor';
        client.data.visitorId = client.handshake.auth?.visitorId;

        // Join company room
        client.join(`company:${company.id}`);
        this.logger.log(`Visitor connected: ${client.id}`);
        return;
      }

      // Authenticated user connection
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          role: true,
          company: true,
        },
      });

      if (!user || !user.isActive || !user.company.isActive) {
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.companyId = user.companyId;
      client.data.roleName = user.role.name;
      client.data.type = 'agent';

      // Join company room
      client.join(`company:${user.companyId}`);
      
      // Mark user as online
      await this.redis.sadd(`online:${user.companyId}`, user.id);

      this.logger.log(`Agent connected: ${user.email} (${client.id})`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.type === 'agent' && client.data.userId) {
      // Mark user as offline
      await this.redis.srem(`online:${client.data.companyId}`, client.data.userId);
      this.logger.log(`Agent disconnected: ${client.data.userId}`);
    } else {
      this.logger.log(`Visitor disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: string }) {
    if (!client.data.companyId) {
      return { error: 'Not authenticated' };
    }

    const chat = await this.prisma.chat.findUnique({
      where: { id: data.chatId },
    });

    if (!chat || chat.companyId !== client.data.companyId) {
      return { error: 'Chat not found' };
    }

    client.join(`chat:${data.chatId}`);
    return { success: true, chatId: data.chatId };
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; content: string; messageType?: string },
  ) {
    if (!client.data.companyId) {
      return { error: 'Not authenticated' };
    }

    const chat = await this.prisma.chat.findUnique({
      where: { id: data.chatId },
    });

    if (!chat || chat.companyId !== client.data.companyId) {
      return { error: 'Chat not found' };
    }

    // Create message
    const message = await this.messagesService.create(
      {
        chatId: data.chatId,
        content: data.content,
        messageType: data.messageType || 'text',
        senderType: client.data.type === 'agent' ? 'agent' : 'visitor',
        senderId: client.data.userId || null,
      },
      client.data.companyId,
    );

    // Broadcast to chat room
    this.server.to(`chat:${data.chatId}`).emit('new_message', message);

    // Update chat status if visitor sent first message
    if (client.data.type === 'visitor' && chat.status === 'pending') {
      await this.chatService.update(data.chatId, { status: 'active' }, client.data.companyId);
    }

    return { success: true, message };
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; isTyping: boolean },
  ) {
    if (!client.data.companyId) {
      return;
    }

    this.server.to(`chat:${data.chatId}`).emit('typing', {
      chatId: data.chatId,
      isTyping: data.isTyping,
      userId: client.data.userId || client.data.visitorId,
    });
  }
}

