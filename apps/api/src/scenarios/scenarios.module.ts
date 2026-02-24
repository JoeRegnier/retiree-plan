import { Module } from '@nestjs/common';
import { ScenariosService } from './scenarios.service';
import { ScenariosController } from './scenarios.controller';

@Module({
  providers: [ScenariosService],
  controllers: [ScenariosController],
  exports: [ScenariosService],
})
export class ScenariosModule {}
