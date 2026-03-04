import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true }) // Tự động tạo createdAt và updatedAt
export class User {
  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  fullName: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  avatarUrl: string;

  @Prop({ type: [String], default: [] })
  fcmTokens: string[]; // Lưu token để gửi Push Notification tới Flutter
}

export const UserSchema = SchemaFactory.createForClass(User);
