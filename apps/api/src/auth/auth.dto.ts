import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class UpdateProfileRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}

export class VerifyMfaLoginRequestDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  verificationCode!: string;
}

export class VerifyMfaCodeRequestDto {
  @IsString()
  verificationCode!: string;
}

export class MfaPasswordChallengeRequestDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  verificationCode!: string;
}
