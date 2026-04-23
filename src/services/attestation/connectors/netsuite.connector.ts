import { ConnectorConfig, ConnectorResult } from "./types";
import crypto from "crypto";

export class NetsuiteConnector {
  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    const fetchedAt = new Date();
    if (!config.clientId || !config.clientSecret || !config.username || !config.password) {
      throw new Error("NetSuite: clientId (consumerKey), clientSecret (consumerSecret), username (token), password (tokenSecret) required");
    }

    // SuiteQL via REST API with OAuth 1.0a
    const suiteql = config.entity?.toUpperCase().startsWith("SELECT")
      ? config.entity
      : `SELECT ${config.selectFields?.join(",") ?? "id, tranid, amount"} FROM ${config.entity ?? "transaction"}${config.filter ? ` WHERE ${config.filter}` : ""}`;

    const url = `${config.baseUrl.replace(/\/$/, "")}/services/rest/query/v1/suiteql?limit=100`;
    const method = "POST";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString("hex");

    // OAuth 1.0a signature
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: config.clientId,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA256",
      oauth_timestamp: timestamp,
      oauth_token: config.username,
      oauth_version: "1.0",
    };

    const baseString = [
      method,
      encodeURIComponent(url),
      encodeURIComponent(Object.entries(oauthParams).sort().map(([k, v]) => `${k}=${v}`).join("&")),
    ].join("&");

    const signingKey = `${encodeURIComponent(config.clientSecret)}&${encodeURIComponent(config.password)}`;
    const signature = crypto.createHmac("sha256", signingKey).update(baseString).digest("base64");
    oauthParams.oauth_signature = signature;

    const authHeader = "OAuth " + Object.entries(oauthParams).map(([k, v]) => `${k}="${encodeURIComponent(v)}"`).join(", ");

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "Prefer": "transient",
      },
      body: JSON.stringify({ q: suiteql }),
    });
    if (!response.ok) throw new Error(`NetSuite SuiteQL failed: ${response.status}`);

    const data = await response.json() as { items?: unknown[]; count?: number };
    const records = data.items ?? [];
    const content = JSON.stringify({ count: data.count, items: records }, null, 2);

    return { content, rawBytes: Buffer.byteLength(content), recordCount: records.length, fetchedAt };
  }
}
