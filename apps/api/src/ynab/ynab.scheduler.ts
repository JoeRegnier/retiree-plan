import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { YnabService } from './ynab.service';

/** Runs the YNAB sync for all connected users on a schedule. */
@Injectable()
export class YnabSyncScheduler {
  private readonly logger = new Logger(YnabSyncScheduler.name);

  constructor(private ynab: YnabService) {}

  /** Sync every 4 hours. */
  @Cron(CronExpression.EVERY_4_HOURS)
  async handleScheduledSync() {
    this.logger.log('Starting scheduled YNAB sync');
    await this.ynab.syncAll();
  }
}
