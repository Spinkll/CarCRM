import { IsString, IsOptional, IsBoolean, IsInt, Min, IsEmail, IsUrl } from 'class-validator';

export class UpdateCompanySettingsDto {
  @IsOptional() @IsString() companyName?: string | null;
  @IsOptional() @IsString() shortName?: string | null;
  @IsOptional() @IsString() serviceProfile?: string | null;
  @IsOptional() @IsString() workSchedule?: string | null;
  @IsOptional() @IsString() workStart?: string | null;
  @IsOptional() @IsString() workEnd?: string | null;
  
  @IsOptional() @IsBoolean() lunchEnabled?: boolean | null;
  @IsOptional() @IsString() lunchStart?: string | null;
  @IsOptional() @IsString() lunchEnd?: string | null;
  
  @IsOptional() @IsInt() @Min(1) slotDuration?: number | null;
  @IsOptional() @IsBoolean() urgentOrdersEnabled?: boolean | null;
  
  @IsOptional() @IsString() publicDescription?: string | null;
  @IsOptional() @IsString() addressLine?: string | null;
  @IsOptional() @IsString() city?: string | null;
  @IsOptional() @IsString() region?: string | null;
  @IsOptional() @IsString() postalCode?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() additionalPhone?: string | null;
  
  @IsOptional() @IsEmail({}, { message: 'Невірний формат email' }) email?: string | null;
  @IsOptional() @IsUrl({}, { message: 'Невірний формат посилання на сайт' }) website?: string | null;
  @IsOptional() @IsUrl({}, { message: 'Невірний формат посилання на карту' }) mapsLink?: string | null;
  
  @IsOptional() @IsString() contactPerson?: string | null;
  @IsOptional() @IsString() clientNote?: string | null;
  @IsOptional() @IsString() companyType?: string | null;
  
  @IsOptional() @IsString() edrpou?: string | null;
  @IsOptional() @IsString() ipn?: string | null;
  @IsOptional() @IsString() iban?: string | null;
  @IsOptional() @IsString() bankName?: string | null;
  @IsOptional() @IsString() recipientName?: string | null;
  @IsOptional() @IsString() legalAddress?: string | null;
  
  @IsOptional() @IsBoolean() vatPayer?: boolean | null;
  @IsOptional() @IsString() invoiceNote?: string | null;
}