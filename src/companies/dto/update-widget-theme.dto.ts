import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateWidgetThemeDto {
  @ApiPropertyOptional({
    example: {
      primaryColor: '#007bff',
      position: 'bottom-right',
      logo: 'https://example.com/logo.png',
    },
  })
  @IsOptional()
  @IsObject()
  widgetTheme?: {
    primaryColor?: string;
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    logo?: string;
    welcomeMessage?: string;
  };
}

