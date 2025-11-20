import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { DiscordNotificationService } from '../common/discord-notification.service';
import {
  CurrentUser,
  type RequestUser,
} from '../characters/decorators/current-user.decorator';

@ApiTags('support')
@ApiBearerAuth()
@Controller()
export class SupportController {
  constructor(
    private readonly discordNotification: DiscordNotificationService,
  ) {}

  @Post('support')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a support request' })
  @ApiResponse({
    status: 200,
    description: 'Support request submitted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async createSupportRequest(
    @Body() dto: CreateSupportRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    // Send to Discord
    await this.discordNotification.sendSupportRequest({
      category: dto.category,
      subject: dto.subject,
      description: dto.description,
      context: dto.context,
      user: {
        id: user.userId || `char_${user.characterId}`,
        characterName: user.name,
        email: undefined, // Email not available in RequestUser
      },
    });

    return {
      success: true,
      message: 'Support request submitted successfully',
    };
  }

  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit feedback' })
  @ApiResponse({
    status: 200,
    description: 'Feedback submitted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async createFeedback(
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() user: RequestUser,
  ) {
    // Send to Discord
    await this.discordNotification.sendFeedback({
      feedbackType: dto.feedbackType,
      subject: dto.subject,
      message: dto.message,
      rating: dto.rating,
      user: {
        id: user.userId || `char_${user.characterId}`,
        characterName: user.name,
        email: undefined, // Email not available in RequestUser
      },
    });

    return {
      success: true,
      message: 'Feedback submitted successfully',
    };
  }
}
