import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create permissions
  const permissions = [
    { name: 'create_agent', description: 'Create new agents', category: 'user' },
    { name: 'edit_agent', description: 'Edit agent details', category: 'user' },
    { name: 'delete_agent', description: 'Delete agents', category: 'user' },
    { name: 'assign_chat', description: 'Assign chats to agents', category: 'chat' },
    { name: 'view_all_chats', description: 'View all company chats', category: 'chat' },
    { name: 'view_reports', description: 'View analytics and reports', category: 'reports' },
    { name: 'billing_access', description: 'Access billing and subscription', category: 'billing' },
    { name: 'manage_roles', description: 'Create and manage custom roles', category: 'user' },
    { name: 'manage_departments', description: 'Create and manage departments', category: 'user' },
    { name: 'api_access', description: 'Access API endpoints', category: 'api' },
    { name: 'automation', description: 'Configure automation rules', category: 'automation' },
  ];

  const createdPermissions = [];
  for (const perm of permissions) {
    const existing = await prisma.permission.findUnique({
      where: { name: perm.name },
    });
    if (!existing) {
      const created = await prisma.permission.create({ data: perm });
      createdPermissions.push(created);
      console.log(`Created permission: ${perm.name}`);
    } else {
      createdPermissions.push(existing);
    }
  }

  // Create plans
  const plans = [
    {
      name: 'Basic',
      slug: 'basic',
      description: 'Perfect for small teams',
      price: 29.00,
      currency: 'USD',
      billingCycle: 'monthly',
      maxUsers: 5,
      maxAgents: 3,
      maxDepartments: 2,
      allowedFeatures: ['roles', 'reports'],
      chatHistoryRetentionDays: 30,
    },
    {
      name: 'Pro',
      slug: 'pro',
      description: 'For growing businesses',
      price: 99.00,
      currency: 'USD',
      billingCycle: 'monthly',
      maxUsers: 20,
      maxAgents: 10,
      maxDepartments: 5,
      allowedFeatures: ['roles', 'reports', 'automation', 'api_access'],
      chatHistoryRetentionDays: 90,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For large organizations',
      price: 299.00,
      currency: 'USD',
      billingCycle: 'monthly',
      maxUsers: 100,
      maxAgents: 50,
      maxDepartments: 20,
      allowedFeatures: ['roles', 'reports', 'automation', 'api_access'],
      chatHistoryRetentionDays: 365,
    },
  ];

  const createdPlans = [];
  for (const plan of plans) {
    const existing = await prisma.plan.findUnique({
      where: { slug: plan.slug },
    });
    if (!existing) {
      const created = await prisma.plan.create({ data: plan });
      createdPlans.push(created);
      console.log(`Created plan: ${plan.name}`);
    } else {
      createdPlans.push(existing);
    }
  }

  // Create system roles
  const systemRoles = [
    {
      name: 'super_admin',
      description: 'Platform super administrator',
      isSystem: true,
      companyId: null,
    },
    {
      name: 'company_admin',
      description: 'Company administrator',
      isSystem: true,
      companyId: null,
    },
    {
      name: 'manager',
      description: 'Team manager',
      isSystem: true,
      companyId: null,
    },
    {
      name: 'agent',
      description: 'Support agent',
      isSystem: true,
      companyId: null,
    },
  ];

  const createdRoles = [];
  for (const role of systemRoles) {
    const existing = await prisma.role.findFirst({
      where: { name: role.name, companyId: null },
    });
    if (!existing) {
      const created = await prisma.role.create({ data: role });
      createdRoles.push(created);
      console.log(`Created role: ${role.name}`);
    } else {
      createdRoles.push(existing);
    }
  }

  // Assign permissions to roles
  const superAdminRole = createdRoles.find((r) => r.name === 'super_admin');
  const companyAdminRole = createdRoles.find((r) => r.name === 'company_admin');
  const managerRole = createdRoles.find((r) => r.name === 'manager');
  const agentRole = createdRoles.find((r) => r.name === 'agent');

  // Super Admin gets all permissions
  if (superAdminRole) {
    for (const perm of createdPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      });
    }
    console.log('Assigned all permissions to super_admin');
  }

  // Company Admin gets most permissions except super admin stuff
  if (companyAdminRole) {
    const companyAdminPerms = createdPermissions.filter(
      (p) => !['super_admin_access'].includes(p.name),
    );
    for (const perm of companyAdminPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: companyAdminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: companyAdminRole.id,
          permissionId: perm.id,
        },
      });
    }
    console.log('Assigned permissions to company_admin');
  }

  // Manager gets limited permissions
  if (managerRole) {
    const managerPerms = createdPermissions.filter((p) =>
      ['assign_chat', 'view_all_chats', 'view_reports'].includes(p.name),
    );
    for (const perm of managerPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: managerRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: managerRole.id,
          permissionId: perm.id,
        },
      });
    }
    console.log('Assigned permissions to manager');
  }

  // Agent gets basic permissions
  if (agentRole) {
    const agentPerms = createdPermissions.filter((p) =>
      ['assign_chat', 'view_all_chats'].includes(p.name),
    );
    for (const perm of agentPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: agentRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: agentRole.id,
          permissionId: perm.id,
        },
      });
    }
    console.log('Assigned permissions to agent');
  }

  // Create super admin user (if email provided in env)
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'ChangeThisPassword123!';

  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

  // Create a platform company for super admin
  const platformCompany = await prisma.company.upsert({
    where: { slug: 'platform' },
    update: {},
    create: {
      name: 'Platform',
      slug: 'platform',
      email: superAdminEmail,
      widgetKey: `platform_${Date.now()}`,
      isActive: true,
    },
  });

  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin && superAdminRole) {
    await prisma.user.create({
      data: {
        email: superAdminEmail,
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        isEmailVerified: true,
        companyId: platformCompany.id,
        roleId: superAdminRole.id,
      },
    });
    console.log(`Created super admin user: ${superAdminEmail}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

