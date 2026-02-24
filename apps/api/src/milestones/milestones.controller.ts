import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  MilestonesService,
  CreateMilestoneDto,
  UpdateMilestoneDto,
} from './milestones.service';

@UseGuards(AuthGuard('jwt'))
@Controller('milestones')
export class MilestonesController {
  constructor(private readonly svc: MilestonesService) {}

  @Post()
  create(@Body() body: CreateMilestoneDto) {
    return this.svc.create(body);
  }

  @Get('household/:householdId')
  findByHousehold(@Param('householdId') householdId: string) {
    return this.svc.findByHousehold(householdId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateMilestoneDto) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
