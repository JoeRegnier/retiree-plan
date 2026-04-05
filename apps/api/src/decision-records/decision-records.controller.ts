import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  DecisionRecordsService,
  CreateDecisionRecordDto,
  UpdateDecisionRecordDto,
} from './decision-records.service';

@UseGuards(AuthGuard('jwt'))
@Controller('decision-records')
export class DecisionRecordsController {
  constructor(private readonly svc: DecisionRecordsService) {}

  @Post()
  create(@Body() body: CreateDecisionRecordDto) {
    return this.svc.create(body);
  }

  @Get('household/:householdId')
  findByHousehold(
    @Param('householdId') householdId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.svc.findByHousehold(householdId, { status, category });
  }

  @Get('household/:householdId/graph')
  getGraph(@Param('householdId') householdId: string) {
    return this.svc.getGraph(householdId);
  }

  @Get('household/:householdId/due-for-review')
  getDueForReview(@Param('householdId') householdId: string) {
    return this.svc.getDueForReview(householdId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('householdId') householdId: string,
  ) {
    return this.svc.findOne(id, householdId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('householdId') householdId: string,
    @Body() body: UpdateDecisionRecordDto,
  ) {
    return this.svc.update(id, householdId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @Query('householdId') householdId: string,
  ) {
    return this.svc.remove(id, householdId);
  }

  @Post(':id/supersede')
  supersede(
    @Param('id') id: string,
    @Query('householdId') householdId: string,
    @Body() body: { replacement?: CreateDecisionRecordDto },
  ) {
    return this.svc.supersede(id, householdId, body.replacement);
  }
}
