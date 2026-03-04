import { Document } from 'mongoose';

export interface User extends Document {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly phoneNumber: string;
  readonly avatarUrl: string;
  readonly fcmTokens: string[];
}
