import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'analyst@organization.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ayesha Rahman' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters long.' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must include uppercase, lowercase, number, and special character.',
  })
  password!: string;

  @ApiPropertyOptional({ enum: ['web', 'android'] })
  @IsOptional()
  @IsIn(['web', 'android'])
  clientType?: 'web' | 'android';

  @ApiPropertyOptional({ example: 'Pixel 8 Pro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@sisfortress.local' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ enum: ['web', 'android'] })
  @IsOptional()
  @IsIn(['web', 'android'])
  clientType?: 'web' | 'android';

  @ApiPropertyOptional({ example: 'Chrome on Windows' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Optional Firebase Cloud Messaging registration token for mobile push' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcmToken?: string;
}

export class MfaVerifyLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'TOTP code must be 6 digits.' })
  code!: string;

  @ApiPropertyOptional({ enum: ['web', 'android'] })
  @IsOptional()
  @IsIn(['web', 'android'])
  clientType?: 'web' | 'android';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcmToken?: string;
}

export class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'TOTP code must be 6 digits.' })
  code!: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Required for native mobile clients; web uses HttpOnly cookie' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class RequestPasswordResetDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must include uppercase, lowercase, number, and special character.',
  })
  newPassword!: string;
}

export class RegisterPasskeyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  credentialId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  publicKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transports?: string[];

  @ApiProperty({ example: 'MacBook Touch ID / Android Passkey' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  deviceLabel!: string;
}

export class BreachPrefixCheckDto {
  @ApiProperty({
    description: 'Privacy-preserving 5-character uppercase/lowercase SHA-1 hex prefix (k-anonymity). Never send plaintext passwords.',
    example: '5BAA6',
  })
  @IsString()
  @Matches(/^[0-9A-Fa-f]{5}$/, {
    message: 'Provide only a 5-character SHA-1 hex prefix; plaintext passwords are never accepted.',
  })
  sha1Prefix!: string;
}
