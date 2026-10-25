type Reset = () => void | Promise<void>;

const resets = new Set<Reset>();

export function onSessionReset(reset: Reset): () => void {
  resets.add(reset);
  return () => {
    resets.delete(reset);
  };
}

export async function resetSessionState(): Promise<void> {
  await Promise.all([...resets].map((reset) => reset()));
}
