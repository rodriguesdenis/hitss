// Minimal OTLP/HTTP receiver for the compose smoke (T-007-18). It answers every export with an
// empty success response and logs one line per request so the smoke can read the container logs:
//   TRACE_RECEIVED service=teams-tasks-api bytes=N    a trace export that names the API service
//   METRICS_RECEIVED service=teams-tasks-api bytes=N  a metrics export that names the API service
//   OTHER_REQUEST path=/v1/... bytes=N               anything else (other services, other paths)
// The service name is looked up as a plain string in the protobuf body, where resource attributes
// are encoded as UTF-8 text. That match relies on UNCOMPRESSED bodies: with
// OTEL_EXPORTER_OTLP_COMPRESSION=gzip the name would be hidden inside the gzip stream and the smoke
// would fail, so the smoke must not enable compression. Listens on $PORT (default 4318); GET / is the health probe.
import { createServer } from 'node:http';

const SERVICE = 'teams-tasks-api';
const port = Number(process.env.PORT ?? 4318);

createServer((request, response) => {
  if (request.method !== 'POST') {
    response.writeHead(200).end('ok');
    return;
  }
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const body = Buffer.concat(chunks);
    const named = body.includes(SERVICE);
    const kind = request.url?.startsWith('/v1/traces')
      ? 'TRACE'
      : request.url?.startsWith('/v1/metrics')
        ? 'METRICS'
        : undefined;
    console.log(
      kind && named
        ? `${kind}_RECEIVED service=${SERVICE} bytes=${body.length}`
        : `OTHER_REQUEST path=${request.url} bytes=${body.length}`,
    );
    // An empty ExportServiceResponse is valid protobuf for both traces and metrics.
    response.writeHead(200, { 'content-type': 'application/x-protobuf' }).end();
  });
}).listen(port, () => console.log(`otlp sink listening on ${port}`));
