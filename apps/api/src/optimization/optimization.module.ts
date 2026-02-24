import { Module } from '@nestjs/common';
import { OptimizationController } from './optimization.controller';

@Module({
  controllers: [OptimizationController],
})
export class OptimizationModule {}
