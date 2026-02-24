import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MembersService, CreateMemberDto, UpdateMemberDto } from './members.service';

@Controller('members')
@UseGuards(AuthGuard('jwt'))
export class MembersController {
  constructor(private membersService: MembersService) {}

  @Post()
  create(@Body() body: CreateMemberDto) {
    return this.membersService.create(body);
  }

  @Get('household/:householdId')
  findByHousehold(@Param('householdId') householdId: string) {
    return this.membersService.findByHousehold(householdId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateMemberDto) {
    return this.membersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
