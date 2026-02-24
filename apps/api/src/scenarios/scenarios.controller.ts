import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ScenariosService } from './scenarios.service';

@Controller('scenarios')
@UseGuards(AuthGuard('jwt'))
export class ScenariosController {
  constructor(private scenariosService: ScenariosService) {}

  @Post()
  create(@Body() body: { name: string; description?: string; householdId: string; parameters: Record<string, unknown> }) {
    return this.scenariosService.create(body);
  }

  @Get('household/:householdId')
  findByHousehold(@Param('householdId') householdId: string) {
    return this.scenariosService.findByHousehold(householdId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scenariosService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; description?: string; parameters?: Record<string, unknown> }) {
    return this.scenariosService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scenariosService.remove(id);
  }
}
