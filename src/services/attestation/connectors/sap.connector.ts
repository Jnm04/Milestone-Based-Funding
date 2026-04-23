import { ConnectorConfig, ConnectorResult } from "./types";

export class SapConnector {
  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const fetchedAt = new Date();
    let token: string | null = null;

    if (config.authType === "OAUTH2_CLIENT") {
      if (!config.tokenUrl || !config.clientId || !config.clientSecret) {
        throw new Error("SAP OAuth2: tokenUrl, clientId, clientSecret required");
      }
      const res = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });
      if (!res.ok) throw new Error(`SAP token fetch failed: ${res.status}`);
      const json = await res.json() as { access_token?: string };
      token = json.access_token ?? null;
    }

    const params = new URLSearchParams();
    if (config.filter) params.set("$filter", config.filter);
    if (config.selectFields?.length) params.set("$select", config.selectFields.join(","));
    params.set("$format", "json");

    const url = `${config.baseUrl.replace(/\/$/, "")}/sap/opu/odata4/${config.entity ?? ""}?${params}`;

    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (config.authType === "BASIC" && config.username && config.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`SAP OData request failed: ${response.status}`);

    const data = await response.json() as { value?: unknown[] };
    const records = data.value ?? [data];
    const content = JSON.stringify(records, null, 2);

    return { content, rawBytes: Buffer.byteLength(content), recordCount: records.length, fetchedAt };
  }
}
