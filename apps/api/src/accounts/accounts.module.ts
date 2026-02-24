import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

@Module({
  providers: [AccountsService],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}
