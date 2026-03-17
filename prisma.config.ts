import path from 'path';
import { defineConfig } from '@prisma/config';
import { PrismaLibSql } from '@prisma/adapter-libsql';

export default defineConfig({
  schema: path.resolve(__dirname, 'prisma/schema.prisma'),
  migrate: {
    async adapter() {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL is required');
      return new PrismaLibSql({ url });
    },
  },
});
