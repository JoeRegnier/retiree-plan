import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GoalsService, CreateGoalDto, UpdateGoalDto } from './goals.service';

@UseGuards(AuthGuard('jwt'))
@Controller('goals')
export class GoalsController {
  constructor(private readonly svc: GoalsService) {}

  @Post()
  create(@Body() body: CreateGoalDto) {
    return this.svc.create(body);
  }

  @Get('household/:householdId')
  findByHousehold(@Param('householdId') householdId: string) {
    return this.svc.findByHousehold(householdId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('householdId') householdId: string) {
    return this.svc.findOne(id, householdId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Query('householdId') householdId: string,
    @Body() body: UpdateGoalDto,
  ) {
    return this.svc.update(id, householdId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('householdId') householdId: string) {
    return this.svc.remove(id, householdId);
  }
}
