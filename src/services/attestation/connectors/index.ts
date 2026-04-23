import { ConnectorConfig, ConnectorResult } from "./types";
import { SapConnector } from "./sap.connector";
import { WorkdayConnector } from "./workday.connector";
import { SalesforceConnector } from "./salesforce.connector";
import { NetsuiteConnector } from "./netsuite.connector";

export type { ConnectorConfig, ConnectorResult };

export async function fetchFromConnector(config: ConnectorConfig): Promise<ConnectorResult> {
  switch (config.system) {
    case "SAP":        return new SapConnector().fetch(config);
    case "WORKDAY":    return new WorkdayConnector().fetch(config);
    case "SALESFORCE": return new SalesforceConnector().fetch(config);
    case "NETSUITE":   return new NetsuiteConnector().fetch(config);
    default:           throw new Error(`Unknown connector system: ${(config as ConnectorConfig).system}`);
  }
}
