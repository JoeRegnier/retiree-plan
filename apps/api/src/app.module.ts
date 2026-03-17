import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HouseholdsModule } from './households/households.module';
import { MembersModule } from './members/members.module';
import { AccountsModule } from './accounts/accounts.module';
import { IncomesModule } from './incomes/incomes.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { ProjectionsModule } from './projections/projections.module';
import { HistoricalReturnsModule } from './historical-returns/historical-returns.module';
import { OptimizationModule } from './optimization/optimization.module';
import { MilestonesModule } from './milestones/milestones.module';
import { YnabModule } from './ynab/ynab.module';
import { AiModule } from './ai/ai.module';
import { MarketDataModule } from './market-data/market-data.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { BrokerageModule } from './brokerage/brokerage.module';
import { RealEstateModule } from './real-estate/real-estate.module';
import { GoalsModule } from './goals/goals.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // When running inside the Electron desktop app the API also serves the
    // compiled React bundle so all relative /api/* calls work seamlessly.
    ...(process.env.SERVE_STATIC === 'true'
      ? [
          ServeStaticModule.forRoot({
            rootPath: process.env.STATIC_FILES_PATH ?? '',
            // Don't intercept requests that start with our global prefix.
            // Exclude the API prefix. Use a RegExp to match '/api' and any
            // nested path under it (e.g. '/api/...'). Cast to satisfy the
            // ServeStaticModule TypeScript signature which expects strings.
            // Exclude the API prefix and any nested API paths using
            // path-to-regexp compatible string patterns.
            exclude: ['/api', '/api/*path'],
          }),
        ]
      : []),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    DatabaseModule,
    AuthModule,
    HouseholdsModule,
    MembersModule,
    AccountsModule,
    IncomesModule,
    ExpensesModule,
    ScenariosModule,
    ProjectionsModule,
    HistoricalReturnsModule,
    MarketDataModule,
    OptimizationModule,
    MilestonesModule,
    YnabModule,
    AiModule,
    BrokerageModule,
    RealEstateModule,
    GoalsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
