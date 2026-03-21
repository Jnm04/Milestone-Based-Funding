import { Client } from "xrpl";

const WSS_URL =
  process.env.NEXT_PUBLIC_XRPL_WSS_URL ?? "wss://s.altnet.rippletest.net:51233";

let client: Client | null = null;

export async function getXRPLClient(): Promise<Client> {
  if (client && client.isConnected()) {
    return client;
  }
  client = new Client(WSS_URL);
  await client.connect();
  return client;
}

export async function disconnectXRPLClient(): Promise<void> {
  if (client && client.isConnected()) {
    await client.disconnect();
    client = null;
  }
}
