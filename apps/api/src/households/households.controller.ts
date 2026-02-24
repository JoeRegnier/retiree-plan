import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HouseholdsService } from './households.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('households')
@UseGuards(AuthGuard('jwt'))
export class HouseholdsController {
  constructor(private householdsService: HouseholdsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() body: { name: string; members: { name: string; dateOfBirth: string; province: string }[] },
  ) {
    return this.householdsService.create(user.id, body);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.householdsService.findAllByUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.householdsService.findOne(id, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { name?: string },
  ) {
    return this.householdsService.update(id, user.id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.householdsService.remove(id, user.id);
  }

  @Post('import')
  importData(
    @CurrentUser() user: { id: string },
    @Body() body: any[],
  ) {
    return this.householdsService.importHousehold(user.id, body);
  }
}
