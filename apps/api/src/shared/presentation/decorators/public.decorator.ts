import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE = 'PUBLIC';

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
