import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public, UserSession } from '@app/common/decorators';
import {
  AuthRequest,
  LoginResponse,
  RegisterRequest,
  OTPResponse,
} from '@app/common/dtos/auth/auth.dto';
import { ApiResponseDto, ResponseBuilder } from '@app/common/utils/dto';
import { firstValueFrom, Observable } from 'rxjs';
import { plainToInstance } from 'class-transformer';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: AuthRequest })
  @ApiOkResponse({
    description: 'Login success',
    type: ApiResponseDto(LoginResponse),
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  async login(@Body() authRequest: AuthRequest) {
    const result = await firstValueFrom<LoginResponse>(
      this.authService.login(authRequest) as Observable<LoginResponse>,
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(LoginResponse, result, {
        excludeExtraneousValues: true,
      }),
    });
  }

  @Public()
  @Post('register')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send OTP for registration',
    description:
      'Sends a 6-digit OTP to user email for account verification during registration. OTP expires in 5 minutes.',
  })
  @ApiBody({ type: RegisterRequest })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: ApiResponseDto(OTPResponse),
  })
  @ApiResponse({
    status: 400,
    description: 'Email already exists or invalid data',
  })
  async register(@Body() registerDto: RegisterRequest) {
    const optResponse = await firstValueFrom<OTPResponse>(
      this.authService.register(registerDto) as Observable<OTPResponse>,
    );

    return ResponseBuilder.createResponse({
      data: plainToInstance(OTPResponse, optResponse, {
        excludeExtraneousValues: true,
      }),
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() body: Record<string, any>) {
    return this.authService.refresh(body);
  }

  @Delete('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and invalidate token' })
  logout(@UserSession('id') userId: string) {
    return this.authService.logout(userId);
  }
}
