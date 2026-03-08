import { Module } from '@nestjs/common';
import { RealEstateController } from './real-estate.controller';
import { RealEstateService } from './real-estate.service';

@Module({
  controllers: [RealEstateController],
  providers: [RealEstateService],
  exports: [RealEstateService],
})
export class RealEstateModule {}
