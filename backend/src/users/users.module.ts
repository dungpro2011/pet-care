import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../database/database.module';
import { UsersService } from './users.service';
import { usersProviders } from './providers/users.providers';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService, ...usersProviders],
})
export class UsersModule {}
