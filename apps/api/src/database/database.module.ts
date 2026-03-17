import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';

@Module({
  imports: [],
  controllers: [DatabaseController],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
