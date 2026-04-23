import { ConnectorConfig, ConnectorResult } from "./types";

export class WorkdayConnector {
  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const fetchedAt = new Date();
    if (!config.entity) throw new Error("Workday: entity (reportName) required");

    // entity format: "tenantName/reportOwner/reportName"
    const url = `${config.baseUrl.replace(/\/$/, "")}/ccx/service/customreport2/${config.entity}?format=json`;

    let authHeader: string;
    if (config.authType === "OAUTH2_CLIENT") {
      if (!config.tokenUrl || !config.clientId || !config.clientSecret) {
        throw new Error("Workday OAuth2: tokenUrl, clientId, clientSecret required");
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
      if (!res.ok) throw new Error(`Workday token failed: ${res.status}`);
      const json = await res.json() as { access_token?: string };
      authHeader = `Bearer ${json.access_token ?? ""}`;
    } else {
      if (!config.username || !config.password) throw new Error("Workday: username and password required");
      authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
    }

    const response = await fetch(url, { headers: { Authorization: authHeader, Accept: "application/json" } });
    if (!response.ok) throw new Error(`Workday RaaS request failed: ${response.status}`);

    const data = await response.json() as { Report_Entry?: unknown[] };
    const records = data.Report_Entry ?? [data];
    const content = JSON.stringify(records, null, 2);

    return { content, rawBytes: Buffer.byteLength(content), recordCount: records.length, fetchedAt };
  }
}
