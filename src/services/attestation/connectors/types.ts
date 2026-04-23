export interface ConnectorConfig {
  system: "SAP" | "WORKDAY" | "SALESFORCE" | "NETSUITE";
  baseUrl: string;
  authType: "BASIC" | "OAUTH2_CLIENT" | "OAUTH1";
  clientId?: string;
  clientSecret?: string;   // decrypted before passing in
  username?: string;
  password?: string;       // decrypted before passing in
  tokenUrl?: string;
  entity?: string;
  filter?: string;
  selectFields?: string[];
  responseField?: string;
}

export interface ConnectorResult {
  content: string;         // JSON string of the fetched data
  rawBytes: number;
  recordCount?: number;
  fetchedAt: Date;
}
