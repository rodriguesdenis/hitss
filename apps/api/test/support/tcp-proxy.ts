import { createServer, connect, type Server, type Socket } from 'node:net';

/**
 * A TCP forwarder in front of the test database, so a test can make the database "go away" and
 * "come back" (refused connections, reset sessions) without touching the shared container.
 */
export class TcpProxy {
  private server: Server | undefined;
  private readonly sockets = new Set<Socket>();
  port = 0;
  private blackholed = false;

  constructor(private readonly target: { host: string; port: number }) {}

  /** Listens on the previous port when there was one, so the same URL works again. */
  async start(): Promise<void> {
    this.server = createServer((client) => {
      this.sockets.add(client);
      client.on('close', () => this.sockets.delete(client));
      client.on('error', () => client.destroy());
      if (this.blackholed) {
        // Accepted and then silence: the client waits like on a dropped network path.
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

  /**
   * Silently drops everything from now on: open sessions get no answer and new connections are
   * accepted but never served (a black-holed network path, unlike the instant refusal of stop()).
   */
  blackhole(): void {
    this.blackholed = true;
    for (const socket of this.sockets) {
      socket.unpipe();
      socket.on('data', () => undefined);
    }
  }

  /** Serves new connections again; sessions swallowed by blackhole() stay stuck until they time out. */
  restore(): void {
    this.blackholed = false;
  }

  /** Refuses new connections and resets the open ones. */
  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve) =>
      server ? server.close(() => resolve()) : resolve(),
    );
  }
}
