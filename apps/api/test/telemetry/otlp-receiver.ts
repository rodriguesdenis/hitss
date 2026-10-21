import { createServer, IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ReceivedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  attributes: { key: string; value: Record<string, unknown> }[];
}

export interface ReceivedResource {
  attributes: { key: string; value: { stringValue?: string } }[];
}

interface TracePayload {
  resourceSpans?: {
    resource?: ReceivedResource;
    scopeSpans?: { spans?: ReceivedSpan[] }[];
  }[];
}

/** Minimal OTLP/HTTP (JSON) collector standing in for SigNoz; records what the API exports. */
export class OtlpReceiver {
  readonly spans: ReceivedSpan[] = [];
  readonly resources: ReceivedResource[] = [];
  requests = 0;
  private server!: Server;

  async start(): Promise<string> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', resolve),
    );
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop(): Promise<void> {
    this.server.closeAllConnections();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async handle(
    req: IncomingMessage,
    res: import('node:http').ServerResponse,
  ) {
    this.requests += 1;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    if (req.url === '/v1/traces') {
      const body = JSON.parse(Buffer.concat(chunks).toString()) as TracePayload;
      for (const rs of body.resourceSpans ?? []) {
        if (rs.resource) this.resources.push(rs.resource);
        for (const ss of rs.scopeSpans ?? [])
          this.spans.push(...(ss.spans ?? []));
      }
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  }

  async waitForSpans(
    predicate: (spans: ReceivedSpan[]) => boolean,
    timeoutMs = 15_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate(this.spans)) {
      if (Date.now() > deadline) throw new Error('timed out waiting for spans');
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}
