import { Mongoose } from 'mongoose';
import { UserSchema } from '../schema/user.schema';

export const usersProviders = [
  {
    provide: 'USER_MODEL',
    useFactory: (mongoose: Mongoose) => mongoose.model('users', UserSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
