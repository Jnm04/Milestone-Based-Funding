declare module "node-saml" {
  export interface SamlOptions {
    entryPoint: string;
    issuer: string;
    callbackUrl: string;
    idpCert: string;
    wantAssertionsSigned?: boolean;
    disableRequestedAuthnContext?: boolean;
  }

  export interface SamlProfile {
    nameID?: string;
    email?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: unknown;
  }

  export class SAML {
    constructor(options: SamlOptions);
    getAuthorizeUrl(options?: { RelayState?: string; additionalParams?: Record<string, string> }): Promise<string>;
    validatePostResponseAsync(
      body: Record<string, string>
    ): Promise<{ profile: SamlProfile | null; loggedOut: boolean }>;
  }
}
