import { Module } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { MilestonesController } from './milestones.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MilestonesService],
  controllers: [MilestonesController],
})
export class MilestonesModule {}
