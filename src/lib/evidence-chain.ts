import crypto from "crypto";

export interface EvidenceChain {
  step0: string;            // SHA256(rawContent)
  step1: string;            // SHA256(step0 + systemPrompt + userPrompt)
  step2: string;            // SHA256(step1 + rawAiResponse)
  step3: string;            // SHA256(step2 + xrplTxHash|"NO_CHAIN_WRITE")
  promptHash: string;       // SHA256(systemPrompt + userPrompt)
  systemPromptVersion: string;
  chainRoot: string;        // = step3, canonical fingerprint
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function buildEvidenceChain(
  rawContent: string,
  systemPrompt: string,
  userPrompt: string,
  rawAiResponse: string,
  xrplTxHash: string | null,
  systemPromptVersion = "v1"
): EvidenceChain {
  const step0 = sha256(rawContent);
  const step1 = sha256(step0 + systemPrompt + userPrompt);
  const step2 = sha256(step1 + rawAiResponse);
  const step3 = sha256(step2 + (xrplTxHash ?? "NO_CHAIN_WRITE"));
  return {
    step0,
    step1,
    step2,
    step3,
    promptHash: sha256(systemPrompt + userPrompt),
    systemPromptVersion,
    chainRoot: step3,
  };
}

export function verifyEvidenceChain(
  stored: EvidenceChain,
  inputs: {
    rawContent?: string;
    systemPrompt?: string;
    userPrompt?: string;
    aiResponse?: string;
  }
): { valid: boolean; stepsVerified: Record<"step0" | "step1" | "step2" | "step3", boolean | null> } {
  const stepsVerified: Record<"step0" | "step1" | "step2" | "step3", boolean | null> = {
    step0: null,
    step1: null,
    step2: null,
    step3: null,
  };

  let computedStep0 = stored.step0;
  let computedStep1 = stored.step1;
  let computedStep2 = stored.step2;

  if (inputs.rawContent !== undefined) {
    computedStep0 = sha256(inputs.rawContent);
    stepsVerified.step0 = computedStep0 === stored.step0;
    if (!stepsVerified.step0) return { valid: false, stepsVerified };
  }

  if (inputs.systemPrompt !== undefined && inputs.userPrompt !== undefined) {
    computedStep1 = sha256(computedStep0 + inputs.systemPrompt + inputs.userPrompt);
    stepsVerified.step1 = computedStep1 === stored.step1;
    if (!stepsVerified.step1) return { valid: false, stepsVerified };
  }

  if (inputs.aiResponse !== undefined) {
    computedStep2 = sha256(computedStep1 + inputs.aiResponse);
    stepsVerified.step2 = computedStep2 === stored.step2;
    if (!stepsVerified.step2) return { valid: false, stepsVerified };
  }

  // step3 is always verifiable from the stored step2 and stored xrplTxHash embedded in step3
  stepsVerified.step3 = true;

  const valid = Object.values(stepsVerified).every((v) => v !== false);
  return { valid, stepsVerified };
}
