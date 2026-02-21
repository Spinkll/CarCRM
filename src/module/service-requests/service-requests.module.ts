import { Module } from '@nestjs/common';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:[NotificationsModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService]
})
export class ServiceRequestsModule {}
