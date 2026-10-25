import fs from 'fs';
import path from 'path';
import { defineConfig } from '@prisma/config';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// The Prisma CLI does not read .env on its own. Load the repo-root .env so
// `npm run db:migrate` works from any workspace. Existing env vars win.
const envFile = path.resolve(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// Same default the API uses when DATABASE_URL is unset (see database.service.ts).
const url = process.env.DATABASE_URL || `file:${path.resolve(__dirname, 'data/retiree-plan.db').replace(/\\/g, '/')}`;

export default defineConfig({
  schema: path.resolve(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url,
  },
  migrate: {
    async adapter() {
      return new PrismaLibSql({ url });
    },
  },
});
