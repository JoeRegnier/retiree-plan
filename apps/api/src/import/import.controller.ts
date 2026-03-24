import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import path from 'path';
import { ImportService, ApplyOFXAccount } from './import.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Allowed file extensions per endpoint type ────────────────────────────────
const OFX_EXTS  = new Set(['.ofx', '.qfx']);
const CSV_EXTS  = new Set(['.csv']);

function ofxFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (err: Error | null, accept: boolean) => void,
) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!OFX_EXTS.has(ext)) {
    cb(new BadRequestException(`Only .ofx and .qfx files are accepted`), false);
  } else {
    cb(null, true);
  }
}

function csvFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (err: Error | null, accept: boolean) => void,
) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!CSV_EXTS.has(ext)) {
    cb(new BadRequestException(`Only .csv files are accepted`), false);
  } else {
    cb(null, true);
  }
}

// ── Valid account types (mirrors shared AccountType enum) ────────────────────
const VALID_ACCOUNT_TYPES = new Set([
  'RRSP', 'TFSA', 'RRIF', 'LIRA', 'LIF', 'RESP', 'CASH', 'NON_REGISTERED', 'CORPORATE',
]);

@Controller('import')
@UseGuards(AuthGuard('jwt'))
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  // ── Ownership guard ────────────────────────────────────────────────────────

  /** Throws ForbiddenException if the authenticated user does not own the household. */
  private async assertHouseholdOwnership(req: Request, householdId: string): Promise<void> {
    const userId: string = (req.user as any)?.id ?? (req.user as any)?.sub;
    if (!userId) throw new ForbiddenException('User identity could not be determined');
    await this.importService.assertHouseholdOwnership(userId, householdId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OFX / QFX
  // ══════════════════════════════════════════════════════════════════════════

  @Post('ofx/preview')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      storage: undefined,   // MemoryStorage — files are never written to disk
      fileFilter: ofxFileFilter,
    }),
  )
  async previewOFX(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('householdId') householdId: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file received. Upload the OFX/QFX file in a multipart field named "file".',
      );
    }
    if (!householdId) throw new BadRequestException('householdId is required');
    await this.assertHouseholdOwnership(req, householdId);
    return this.importService.previewOFX(householdId, file.buffer);
  }

  @Post('ofx/apply')
  @HttpCode(200)
  async applyOFX(
    @Req() req: Request,
    @Body()
    body: {
      householdId: string;
      accounts: ApplyOFXAccount[];
    },
  ) {
    if (!body?.householdId) throw new BadRequestException('householdId is required');
    if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
      throw new BadRequestException('accounts array is required and must not be empty');
    }
    await this.assertHouseholdOwnership(req, body.householdId);

    // Validate each account entry before calling the service
    for (const acc of body.accounts) {
      if (acc.skip) continue;
      if (acc.localAccountType && !VALID_ACCOUNT_TYPES.has(acc.localAccountType)) {
        throw new BadRequestException(`Invalid account type: ${acc.localAccountType}`);
      }
      if (acc.balance != null && !Number.isFinite(acc.balance)) {
        throw new BadRequestException('balance must be a finite number');
      }
      if (acc.balance != null && (acc.balance < -1e9 || acc.balance > 1e9)) {
        throw new BadRequestException('balance is out of permitted range');
      }
    }

    return this.importService.applyOFX(body.householdId, body.accounts);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Wealthsimple Activity CSV
  // ══════════════════════════════════════════════════════════════════════════

  @Post('csv/wealthsimple/preview')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      storage: undefined,
      fileFilter: csvFileFilter,
    }),
  )
  async previewWealthsimpleCSV(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('householdId') householdId: string,
  ) {
    if (!file) throw new BadRequestException('No file received');
    if (!householdId) throw new BadRequestException('householdId is required');
    await this.assertHouseholdOwnership(req, householdId);
    return this.importService.previewWealthsimpleCSV(householdId, file.buffer);
  }

  @Post('csv/wealthsimple/apply')
  @HttpCode(200)
  async applyWealthsimpleCSV(
    @Req() req: Request,
    @Body()
    body: {
      householdId: string;
      accounts: ApplyOFXAccount[];
    },
  ) {
    if (!body?.householdId) throw new BadRequestException('householdId is required');
    if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
      throw new BadRequestException('accounts array is required and must not be empty');
    }
    await this.assertHouseholdOwnership(req, body.householdId);

    for (const acc of body.accounts) {
      if (acc.skip) continue;
      if (acc.localAccountType && !VALID_ACCOUNT_TYPES.has(acc.localAccountType)) {
        throw new BadRequestException(`Invalid account type: ${acc.localAccountType}`);
      }
      if (acc.balance != null && !Number.isFinite(acc.balance)) {
        throw new BadRequestException('balance must be a finite number');
      }
    }

    return this.importService.applyOFX(body.householdId, body.accounts);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Monarch Money Transaction CSV
  // ══════════════════════════════════════════════════════════════════════════

  @Post('csv/monarch/preview')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      storage: undefined,
      fileFilter: csvFileFilter,
    }),
  )
  async previewMonarchCSV(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('householdId') householdId: string,
  ) {
    if (!file) throw new BadRequestException('No file received');
    if (!householdId) throw new BadRequestException('householdId is required');
    await this.assertHouseholdOwnership(req, householdId);
    return this.importService.previewMonarchCSV(householdId, file.buffer);
  }

  @Post('csv/monarch/apply')
  @HttpCode(200)
  async applyMonarchCSV(
    @Req() req: Request,
    @Body()
    body: {
      householdId: string;
      expenses: Array<{ category: string; annualAmount: number }>;
    },
  ) {
    if (!body?.householdId) throw new BadRequestException('householdId is required');
    if (!Array.isArray(body.expenses) || body.expenses.length === 0) {
      throw new BadRequestException('expenses array is required and must not be empty');
    }
    await this.assertHouseholdOwnership(req, body.householdId);

    for (const e of body.expenses) {
      if (!Number.isFinite(e.annualAmount) || e.annualAmount < 0 || e.annualAmount > 1e8) {
        throw new BadRequestException('annualAmount must be a positive finite number (max 100,000,000)');
      }
    }

    return this.importService.applyMonarchCSV(body.householdId, body.expenses);
  }
}

