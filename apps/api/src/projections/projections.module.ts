import { Module } from '@nestjs/common';
import { ProjectionsService } from './projections.service';
import { ProjectionsController } from './projections.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ProjectionsService],
  controllers: [ProjectionsController],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
