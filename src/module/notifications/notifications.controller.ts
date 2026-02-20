import { Controller, Get, Patch, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    // Мої повідомлення
    @Get()
    findAll(@Req() req) {
        return this.notificationsService.findAll(req.user.id);
    }

    // Кількість непрочитаних
    @Get('unread-count')
    countUnread(@Req() req) {
        return this.notificationsService.countUnread(req.user.id);
    }

    // Позначити як прочитане
    @Patch(':id/read')
    markAsRead(@Req() req, @Param('id', ParseIntPipe) id: number) {
        return this.notificationsService.markAsRead(req.user.id, id);
    }

    // Позначити всі як прочитані
    @Patch('read-all')
    markAllAsRead(@Req() req) {
        return this.notificationsService.markAllAsRead(req.user.id);
    }
}
