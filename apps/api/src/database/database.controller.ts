import {
  Controller, Get, Post, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DatabaseService } from './database.service';

@UseGuards(AuthGuard('jwt'))
@Controller('database')
export class DatabaseController {
  constructor(private readonly db: DatabaseService) {}

  /** List all available backups, newest first. */
  @Get('backups')
  listBackups() {
    return this.db.listBackups();
  }

  /** Create a backup right now. Optionally pass a label. */
  @Post('backup')
  createBackup(@Body() body: { label?: string }) {
    return this.db.createBackup(body?.label);
  }

  /** Restore a specific backup by filename. Always creates a pre-restore backup first. */
  @Post('restore')
  restoreBackup(@Body() body: { filename: string }) {
    if (!body?.filename) throw new Error('filename is required');
    this.db.restoreBackup(body.filename);
    return { ok: true, message: `Restored ${body.filename}` };
  }

  /** Delete a specific backup file. */
  @Delete('backups/:filename')
  deleteBackup(@Param('filename') filename: string) {
    this.db.deleteBackup(filename);
    return { ok: true };
  }
}
