import * as mongoose from 'mongoose';

export const databaseProviders = [
  {
    provide: 'DATABASE_CONNECTION',
    useFactory: async (): Promise<typeof mongoose> => {
      console.log('Connected mongoose successfully!');
      return await mongoose.connect(process.env.DB_MONGO || '');
    },
  },
];
