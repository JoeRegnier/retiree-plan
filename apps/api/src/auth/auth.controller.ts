import { Controller, Post, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import {
  LoginRequestDto,
  MfaPasswordChallengeRequestDto,
  RegisterRequestDto,
  UpdateProfileRequestDto,
  VerifyMfaCodeRequestDto,
  VerifyMfaLoginRequestDto,
} from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterRequestDto) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Post('login')
  async login(@Body() body: LoginRequestDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('mfa/verify-login')
  async verifyMfaLogin(@Body() body: VerifyMfaLoginRequestDto) {
    return this.authService.verifyMfaLogin(body.mfaToken, body.verificationCode);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Request() req: any) {
    return req.user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile(
    @Request() req: any,
    @Body() body: UpdateProfileRequestDto,
  ) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('mfa/status')
  getMfaStatus(@Request() req: any) {
    return this.authService.getMfaStatus(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/setup')
  beginMfaSetup(@Request() req: any) {
    return this.authService.beginMfaSetup(req.user.id, req.user.email);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/enable')
  enableMfa(@Request() req: any, @Body() body: VerifyMfaCodeRequestDto) {
    return this.authService.enableMfa(req.user.id, body.verificationCode);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/disable')
  disableMfa(
    @Request() req: any,
    @Body() body: MfaPasswordChallengeRequestDto,
  ) {
    return this.authService.disableMfa(req.user.id, body.currentPassword, body.verificationCode);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/recovery-codes')
  regenerateRecoveryCodes(
    @Request() req: any,
    @Body() body: MfaPasswordChallengeRequestDto,
  ) {
    return this.authService.regenerateRecoveryCodes(req.user.id, body.currentPassword, body.verificationCode);
  }
}
