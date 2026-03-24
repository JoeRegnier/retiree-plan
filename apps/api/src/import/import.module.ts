import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  providers:   [ImportService],
  controllers: [ImportController],
  exports:     [ImportService],
})
export class ImportModule {}
