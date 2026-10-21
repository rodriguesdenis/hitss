import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE = 'raw-response';

/**
 * The response is sent as returned, without the `{ data }` envelope: health checks keep the
 * format of their tooling (ADR-0005 exclusions). Applies to a handler or a whole controller.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);
