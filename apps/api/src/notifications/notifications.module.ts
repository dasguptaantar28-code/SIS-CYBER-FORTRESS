import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SocEventsGateway } from './soc-events.gateway';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService, SocEventsGateway],
  exports: [NotificationsService, SocEventsGateway],
})
export class NotificationsModule {}
