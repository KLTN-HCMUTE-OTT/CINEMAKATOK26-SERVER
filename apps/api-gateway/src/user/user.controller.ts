import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserSession } from '@app/common/decorators';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@UserSession('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(
    @UserSession('id') userId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.userService.updateProfile(userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  getById(@Param('id') id: string) {
    return this.userService.getById(id);
  }
}
