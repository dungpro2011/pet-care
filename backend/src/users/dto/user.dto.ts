export class UserDto {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly phoneNumber: string;
  readonly avatarUrl: string;
  readonly fcmTokens: string[];
}
