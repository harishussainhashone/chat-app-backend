import 'dotenv/config';

if (process.env.PRISMA_CLIENT_ENGINE_TYPE === 'client') {
  // Avoid "client" engine unless an adapter/accelerate URL is configured.
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
}

