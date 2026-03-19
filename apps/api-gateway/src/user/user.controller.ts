import {Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery, ApiCreatedResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserSession, IsAdmin } from '@app/common/decorators';
import { UserDto } from '@app/common/dtos/user/user.dto';
import { plainToInstance } from 'class-transformer';
import { ApiBadRequestResponse, ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ProfileResponse, UpdateProfileRequest, ChangePasswordRequest, UpdateAvatarRequest, UploadAvatarResponse } from '@app/common/dtos/user/profile.dto';
import { ApiResponseDto, ResponseBuilder, PaginationQueryDto, PaginatedApiResponseDto } from '@app/common/utils/dto';
import { JwtAuthGuard, IsAdminGuard } from '@app/common/guards';
import {  UserDetailDto, BanUserDto, UpdateUserInfoDto, CreateUserDto, UpdateUserDto } from '@app/common/dtos/user/user.dto';
import { firstValueFrom } from 'rxjs';



@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Get the current user profile information',
  })
  @ApiOkResponse({
    description: 'Profile retrieved successfully',
    type: ProfileResponse,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async getProfile(@UserSession('id') userId: string) {
    const result = await firstValueFrom<ProfileResponse>(this.userService.getProfile(userId));
    return ResponseBuilder.createResponse({ data: plainToInstance(ProfileResponse, result, { excludeExtraneousValues: true }) });
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Update user basic information (name, gender, date of birth, address, phone)',
  })
  @ApiOkResponse({
    description: 'Profile updated successfully',
    type: ProfileResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input - Check the error message for details',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async updateProfile(
    @UserSession('id') userId: string,
    @Body() updateProfileDto: UpdateProfileRequest,
  ) {
    const result = await firstValueFrom<ProfileResponse>(this.userService.updateProfile(userId, updateProfileDto));
    return ResponseBuilder.createResponse({
      data: plainToInstance(ProfileResponse, result, { excludeExtraneousValues: true }),
      message: 'Profile updated successfully',
    });
  }

  @Post('profile/change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the current user password',
  })
  @ApiOkResponse({
    description: 'Password changed successfully',
    type: ProfileResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid current password or passwords do not match',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async changePassword(
    @UserSession('id') userId: string,
    @Body() changePasswordDto: ChangePasswordRequest,
  ) {
    const result = await this.userService.changePassword(userId, changePasswordDto);
    return ResponseBuilder.createResponse({
      data: plainToInstance(UserDto, result, { excludeExtraneousValues: true }),
      message: 'Password changed successfully',
    });
  }

  @Put('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update avatar',
    description: 'Update avatar with a new URL for the current user',
  })
  @ApiBody({ type: UpdateAvatarRequest })
  @ApiOkResponse({
    description: 'Avatar updated successfully',
    type: UploadAvatarResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid avatar URL',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async updateAvatar(
    @UserSession('id') userId: string,
    @Body() updateAvatarDto: UpdateAvatarRequest,
  ) {
    const result = await firstValueFrom<UploadAvatarResponse>(this.userService.updateAvatar(userId, updateAvatarDto));
    return ResponseBuilder.createResponse({
      data: plainToInstance(UploadAvatarResponse, result, { excludeExtraneousValues: true }),
      message: 'Avatar updated successfully',
    });
  }

  @Delete('profile/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete avatar',
    description: 'Delete the current user avatar',
  })
  @ApiOkResponse({
    description: 'Avatar deleted successfully',
  })
  @ApiBadRequestResponse({
    description: 'No avatar to delete',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing access token',
  })
  async deleteAvatar(@UserSession('id') userId: string) {
    await this.userService.deleteAvatar(userId);
    return ResponseBuilder.createResponse({ data: null, message: 'Avatar deleted successfully' });
  }

  // Admin-only user management endpoints
  @Get()
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @IsAdmin()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiOkResponse({ description: 'List of users', type: PaginatedApiResponseDto(UserDto) })
  @ApiQuery({
    name: 'page',
    required: false,
    default: 1,
    description: 'Page number for pagination',
    type: PaginationQueryDto['page'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    default: 10,
    description: 'Limit number of users per page',
    type: PaginationQueryDto['limit'],
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Sort order for users',
    type: PaginationQueryDto['sort'],
    example: '{ "createdAt": "DESC" }',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    default: 1,
    description: 'Search term for users',
    type: 'string',
    example: 'user01',
  })
  async findAll(@Query() query: PaginationQueryDto, @Query('search') search?: string) {
    const { data, total } = await firstValueFrom(this.userService.getAllUsers(query, search));
    return ResponseBuilder.createPaginatedResponse({
      data: data.map(user => plainToInstance(UserDto, user, { excludeExtraneousValues: true })),
      totalItems: total,
      currentPage: query.page || 1,
      itemsPerPage: query.limit || 10,
      message: 'Users retrieved successfully',
    });
  }

  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiOkResponse({ description: 'User details', type: ApiResponseDto(UserDto) })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await firstValueFrom(this.userService.getById(id));
    return ResponseBuilder.createResponse({ data: plainToInstance(UserDto, result, { excludeExtraneousValues: true }) });
  }
  @Post()
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({
    description: 'The user has been successfully created.',
    type: ApiResponseDto(UserDto),
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const result = await firstValueFrom(this.userService.createUser(createUserDto));
    return ResponseBuilder.createResponse({ data: plainToInstance(UserDto, result, { excludeExtraneousValues: true }) });
  }

  @Put(':id')
  @ApiOkResponse({ description: 'User updated successfully', type: ApiResponseDto(UserDto) })
  @ApiBody({ type: UpdateUserDto })
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() updateUserDto: UpdateUserDto) {
    const result = await firstValueFrom(this.userService.updateUser(id, updateUserDto));
    return ResponseBuilder.createResponse({ data: plainToInstance(UserDto, result, { excludeExtraneousValues: true }) });
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'User deleted successfully' })
  
  async delete(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.userService.deleteUser(id);
    return ResponseBuilder.createResponse({ data: null });
  }

  // Admin user management endpoints
  @Get(':id/detail')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @IsAdmin()
  @ApiOperation({ summary: 'Get user detail (Admin only)' })
  @ApiOkResponse({ description: 'User detail', type: ApiResponseDto(UserDetailDto) })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing access token' })
  async getUserDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await firstValueFrom(this.userService.getUserDetail(id));
    return ResponseBuilder.createResponse({
      data: plainToInstance(UserDetailDto, result, { excludeExtraneousValues: true }),
      message: 'User detail retrieved successfully',
    });
  }

  @Post(':id/ban')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @IsAdmin()
  @ApiOperation({ summary: 'Ban user (Admin only)' })
  @ApiOkResponse({ description: 'User banned successfully', type: ApiResponseDto(UserDetailDto) })
  @ApiBody({ type: BanUserDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing access token' })
  async banUser(@Param('id', new ParseUUIDPipe()) id: string, @Body() banUserDto: BanUserDto) {
    const result = await firstValueFrom(this.userService.banUser(id, banUserDto));
    return ResponseBuilder.createResponse({
      data: plainToInstance(UserDetailDto, result, { excludeExtraneousValues: true }),
      message: 'User banned successfully',
    });
  }

  @Delete(':id/unban')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @IsAdmin()
  @ApiOperation({ summary: 'Unban user (Admin only)' })
  @ApiOkResponse({ description: 'User unbanned successfully', type: ApiResponseDto(UserDetailDto) })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing access token' })
  async unbanUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await firstValueFrom(this.userService.unbanUser(id));
    return ResponseBuilder.createResponse({
      data: plainToInstance(UserDetailDto, result, { excludeExtraneousValues: true }),
      message: 'User unbanned successfully',
    });
  }

  @Put(':id/info')
  @UseGuards(JwtAuthGuard, IsAdminGuard)
  @IsAdmin()
  @ApiOperation({ summary: 'Update user info (Admin only)' })
  @ApiOkResponse({
    description: 'User info updated successfully',
    type: ApiResponseDto(UserDetailDto),
  })
  @ApiBody({ type: UpdateUserInfoDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing access token' })
  async updateUserInfo(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateUserInfoDto: UpdateUserInfoDto,
  ) {
    const result = await firstValueFrom(this.userService.updateUser(id, updateUserInfoDto));
    return ResponseBuilder.createResponse({
      data: plainToInstance(UserDetailDto, result, { excludeExtraneousValues: true }),
      message: 'User info updated successfully',
    });
  }
}
