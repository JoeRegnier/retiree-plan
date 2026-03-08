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
import {
  RealEstateService,
  CreateRealEstateDto,
  UpdateRealEstateDto,
} from './real-estate.service';

@UseGuards(AuthGuard('jwt'))
@Controller('real-estate')
export class RealEstateController {
  constructor(private readonly svc: RealEstateService) {}

  @Post()
  create(@Body() body: CreateRealEstateDto) {
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
    @Body() body: UpdateRealEstateDto,
  ) {
    return this.svc.update(id, householdId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('householdId') householdId: string) {
    return this.svc.remove(id, householdId);
  }
}
