import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as path from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Web/dev mode with no DATABASE_URL: <project-root>/data/retiree-plan.db,
    // matching database.service.ts and prisma.config.ts.
    const url =
      process.env.DATABASE_URL ||
      `file:${path.resolve(__dirname, '../../../..', 'data', 'retiree-plan.db').replace(/\\/g, '/')}`;
    const adapter = new PrismaLibSql({ url });
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
