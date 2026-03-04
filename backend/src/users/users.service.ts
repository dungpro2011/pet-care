import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { UserDto } from './dto/user.dto';
import { User } from './interfaces/user.interface';

@Injectable()
export class UsersService {
  constructor(@Inject('USER_MODEL') private readonly userModel: Model<User>) {}

  async create(UserDto: UserDto): Promise<User> {
    const createUser = this.userModel.create(UserDto);
    return createUser;
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }
}
