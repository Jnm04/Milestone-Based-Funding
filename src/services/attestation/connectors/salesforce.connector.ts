import { ConnectorConfig, ConnectorResult } from "./types";

export class SalesforceConnector {
  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const fetchedAt = new Date();
    if (!config.tokenUrl || !config.clientId || !config.clientSecret) {
      throw new Error("Salesforce: tokenUrl, clientId, clientSecret required");
    }

    // OAuth2 token
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!tokenRes.ok) throw new Error(`Salesforce token failed: ${tokenRes.status}`);
    const tokenData = await tokenRes.json() as { access_token?: string; instance_url?: string };
    const accessToken = tokenData.access_token;
    const instanceUrl = tokenData.instance_url ?? config.baseUrl;

    // SOQL query — entity is the SOQL SELECT statement or object name
    const soql = config.entity?.startsWith("SELECT")
      ? config.entity
      : `SELECT ${config.selectFields?.join(",") ?? "Id,Name"} FROM ${config.entity ?? "Account"}${config.filter ? ` WHERE ${config.filter}` : ""}`;

    const queryUrl = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
    const response = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Salesforce query failed: ${response.status}`);

    const data = await response.json() as { records?: unknown[]; totalSize?: number };
    const records = data.records ?? [];
    const content = JSON.stringify({ totalSize: data.totalSize, records }, null, 2);

    return { content, rawBytes: Buffer.byteLength(content), recordCount: records.length, fetchedAt };
  }
}
