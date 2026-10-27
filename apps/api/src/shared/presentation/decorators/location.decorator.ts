import { UseInterceptors } from '@nestjs/common';
import { LocationInterceptor } from '../interceptors/location.interceptor';

export const Location = () => UseInterceptors(LocationInterceptor);
