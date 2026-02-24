import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiContextBuilderService } from './context-builder.service';

@Module({
  providers: [AiService, AiContextBuilderService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
