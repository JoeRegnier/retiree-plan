import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
