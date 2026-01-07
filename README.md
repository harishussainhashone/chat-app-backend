# Multi-Tenant SaaS Chat Application Backend

A production-ready NestJS backend for a multi-tenant SaaS chat application (Zendesk/Intercom style).

## Features

- **Multi-tenancy**: Complete data isolation per company
- **RBAC**: Role-based access control with custom roles
- **Plan-based subscriptions**: Basic, Pro, Enterprise plans with feature limits
- **Real-time chat**: WebSocket-based chat using Socket.IO
- **Chat widget**: Embeddable JavaScript widget for websites
- **Analytics**: Event tracking and reporting
- **Swagger documentation**: Complete API documentation at `/api/docs`

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis
- **Real-time**: Socket.IO
- **Authentication**: JWT + Refresh Tokens
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL and Redis)
- npm or yarn

## Setup

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start PostgreSQL and Redis**:
```bash
docker-compose up -d
```

4. **Run Prisma migrations**:
```bash
npm run prisma:generate
npm run prisma:migrate
```

5. **Seed initial data** (optional):
```bash
npm run prisma:seed
```

6. **Start the development server**:
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api`
Swagger documentation at `http://localhost:3000/api/docs`

## Project Structure

```
src/
├── auth/              # Authentication module (JWT, refresh tokens)
├── companies/        # Company management
├── users/            # User management
├── roles/            # Role management
├── permissions/      # Permission management
├── plans/            # Subscription plans
├── subscriptions/    # Company subscriptions
├── chat/             # Chat management (REST + WebSocket)
├── messages/         # Message management
├── departments/      # Department management
├── widget/           # Chat widget endpoints
├── analytics/        # Analytics and reports
├── admin/            # Super admin endpoints
├── common/           # Shared utilities, guards, decorators
├── config/           # Configuration files
├── database/         # Prisma service
└── redis/            # Redis service
```

## User Hierarchy

- **Super Admin**: Platform owner
- **Company Admin**: Client company owner
- **Manager**: Custom role (can be created by Company Admin)
- **Agent**: Chat support agent
- **Visitor**: Website user (via widget)

## Plans

- **Basic**: Limited users, agents, and features
- **Pro**: More users, agents, and advanced features
- **Enterprise**: Unlimited with all features

## Security

- JWT authentication with refresh tokens
- Role and permission-based access control
- Company-level data isolation
- Rate limiting
- Input validation and sanitization
- Secure password hashing (bcrypt)

## License

Private - All rights reserved

