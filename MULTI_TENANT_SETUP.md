# Multi-Tenant Database Setup Guide

This guide explains how to configure and optimize your NestJS SaaS project for multi-tenancy with proper data isolation and performance.

## Overview

Two approaches are available:
1. **Single Database with Enhanced Indexing** (Recommended for most cases)
2. **Schema-Per-Tenant** (For maximum isolation)

## Approach 1: Single Database with Enhanced Indexing (Recommended)

This approach uses a single PostgreSQL database with optimized indexes and automatic `company_id` filtering.

### Step 1: Apply Database Indexes

Run the index migration:

```bash
psql -U your_user -d chat_app_db -f prisma/migrations/add_chat_indexes.sql
```

Or manually via Prisma:

```bash
npm run prisma:migrate dev --name add_chat_indexes
```

### Step 2: Verify Indexes

Check that indexes were created:

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('chats', 'messages') 
ORDER BY tablename, indexname;
```

### Step 3: Middleware Configuration

The `TenantDetectionMiddleware` is already configured in `app.module.ts`. It:
- Extracts subdomain from request host
- Finds company by slug
- Attaches tenant context to request

### Step 4: Automatic Tenant Filtering

All queries automatically filter by `company_id` through:
- `TenantContextInterceptor` - Sets tenant context
- `TenantPrismaService` - Automatically adds `company_id` to queries

## Approach 2: Schema-Per-Tenant (Advanced)

This approach creates a separate PostgreSQL schema for each company.

### Step 1: Enable Schema Creation

In `src/companies/companies.service.ts`, uncomment:

```typescript
await this.tenantSchemaService.createTenantSchema(company.id);
```

### Step 2: Create Initial Schema Functions

Run the schema creation script:

```bash
psql -U your_user -d chat_app_db -f prisma/migrations/create_tenant_schema.sql
```

### Step 3: Update Prisma Service

When using schema-per-tenant, queries automatically switch to the tenant schema via `TenantPrismaService.switchSchema()`.

## Indexing Strategy

### Chat Table Indexes

```sql
-- Composite indexes for common query patterns
CREATE INDEX chats_company_id_status_idx ON chats (company_id, status);
CREATE INDEX chats_company_id_created_at_desc_idx ON chats (company_id, created_at DESC);
CREATE INDEX chats_company_id_department_id_idx ON chats (company_id, department_id);

-- Partial index for active chats (faster)
CREATE INDEX chats_company_id_active_idx ON chats (company_id, created_at DESC) 
WHERE status IN ('pending', 'assigned', 'active');
```

### Message Table Indexes

```sql
-- Composite indexes for message history
CREATE INDEX messages_chat_id_created_at_asc_idx ON messages (chat_id, created_at ASC);
CREATE INDEX messages_chat_id_is_read_idx ON messages (chat_id, is_read);

-- Partial index for unread messages
CREATE INDEX messages_chat_id_unread_idx ON messages (chat_id, created_at DESC) 
WHERE is_read = false;
```

## Table Partitioning (For Millions of Messages)

If you expect millions of messages, consider table partitioning:

```bash
psql -U your_user -d chat_app_db -f prisma/migrations/create_table_partitioning.sql
```

**Note**: This requires dropping and recreating tables. Backup first!

## Tenant Detection

### Subdomain Format

- Production: `abc.yourapp.com` → Company slug: `abc`
- Development: `abc.localhost` → Company slug: `abc`

### Request Flow

1. Request arrives: `abc.yourapp.com/api/chats`
2. `TenantDetectionMiddleware` extracts subdomain `abc`
3. Finds company with `slug = 'abc'`
4. Attaches `tenant` object to request:
   ```typescript
   {
     companyId: 'uuid',
     subdomain: 'abc',
     schemaName: 'tenant_uuid' // if using schema-per-tenant
   }
   ```
5. `TenantContextInterceptor` sets tenant context
6. All Prisma queries automatically filter by `company_id`

## Plan Enforcement

Plan limits are enforced at the service level:

- `PlanCheckService.checkLimit()` - Checks user/agent/department limits
- `PlanCheckService.checkFeatureAccess()` - Checks feature availability

All existing plan logic remains unchanged and is automatically enforced per tenant.

## Performance Optimization

### Query Optimization

1. **Always use composite indexes** for common query patterns:
   ```typescript
   // This query uses: chats_company_id_status_idx
   await prisma.chat.findMany({
     where: {
       companyId: tenant.companyId,
       status: 'active'
     }
   });
   ```

2. **Use partial indexes** for filtered queries:
   ```typescript
   // This query uses: chats_company_id_active_idx
   await prisma.chat.findMany({
     where: {
       companyId: tenant.companyId,
       status: { in: ['pending', 'assigned', 'active'] }
     }
   });
   ```

### Monitoring

Check query performance:

```sql
-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%chats%' OR query LIKE '%messages%'
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

## Security

### Data Isolation

- All queries automatically include `company_id` filter
- No cross-tenant data access possible
- Schema-per-tenant provides additional isolation layer

### Validation

Test isolation:

```typescript
// This will fail - cannot access other company's data
const chat = await prisma.chat.findUnique({
  where: { id: 'other-company-chat-id' }
  // Automatically filtered by tenant.companyId
});
```

## Migration Checklist

- [ ] Run `add_chat_indexes.sql` migration
- [ ] Verify indexes are created
- [ ] Test subdomain detection
- [ ] Verify tenant context is set correctly
- [ ] Test plan enforcement
- [ ] Monitor query performance
- [ ] (Optional) Enable schema-per-tenant if needed

## Troubleshooting

### Subdomain Not Detected

Check:
1. Request includes `Host` header
2. Subdomain format is correct
3. Company exists with matching slug

### Slow Queries

1. Check if indexes are being used:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM chats WHERE company_id = 'xxx' AND status = 'active';
   ```
2. Verify composite indexes exist
3. Consider table partitioning for very large datasets

### Schema Creation Fails

1. Ensure PostgreSQL user has `CREATE SCHEMA` permission
2. Check for naming conflicts
3. Verify company ID format (UUID)

## Best Practices

1. **Always use tenant context** - Never hardcode `company_id`
2. **Monitor index usage** - Remove unused indexes
3. **Partition large tables** - For millions of rows per company
4. **Use composite indexes** - For multi-column queries
5. **Test isolation** - Regularly verify cross-tenant access is blocked

