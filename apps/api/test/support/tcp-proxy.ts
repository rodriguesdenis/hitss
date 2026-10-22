import { createServer, connect, type Server, type Socket } from 'node:net';

export class TcpProxy {
  private server: Server | undefined;
  private readonly sockets = new Set<Socket>();
  port = 0;
  private blackholed = false;

  constructor(private readonly target: { host: string; port: number }) {}

  async start(): Promise<void> {
    this.server = createServer((client) => {
      this.sockets.add(client);
      client.on('close', () => this.sockets.delete(client));
      client.on('error', () => client.destroy());
      if (this.blackholed) {
        client.on('data', () => undefined);
        return;
      }
      const upstream = connect(this.target);
      for (const socket of [upstream]) {
        this.sockets.add(socket);
        socket.on('close', () => this.sockets.delete(socket));
        socket.on('error', () => socket.destroy());
      }
      client.pipe(upstream);
      upstream.pipe(client);
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(this.port, '127.0.0.1', resolve);
    });
    this.port = (this.server.address() as { port: number }).port;
  }

  blackhole(): void {
    this.blackholed = true;
    for (const socket of this.sockets) {
      socket.unpipe();
      socket.on('data', () => undefined);
    }
  }

  restore(): void {
    this.blackholed = false;
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve) =>
      server ? server.close(() => resolve()) : resolve(),
    );
  }
}
