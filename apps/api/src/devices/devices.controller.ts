import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@sis/shared-contracts';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/devices.dto';

@ApiTags('Devices & Endpoint Guardian')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @RequirePermissions(PERMISSIONS.DEVICES_MANAGE)
  @ApiOperation({ summary: 'Register or sync Android/client device posture (Module 03)' })
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.registerOrSync(user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.DEVICES_READ)
  @ApiOperation({ summary: 'List permitted devices and security posture scores' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.listDevices(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DEVICES_READ)
  @ApiOperation({ summary: 'Get single device details and posture findings' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.devicesService.getDevice(user, id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DEVICES_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a registered device' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.devicesService.removeDevice(user, id);
  }
}
