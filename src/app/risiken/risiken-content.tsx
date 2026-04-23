"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

type Lang = "de" | "en";

export function RisikenContent() {
  const [lang, setLang] = useState<Lang>("de");
  const de = lang === "de";

  return (
    <>
    <main
      className="min-h-screen px-4 py-16"
      style={{ background: "#171311", color: "#EDE6DD" }}
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm hover:underline" style={{ color: "#C4704B" }}>
              ← {de ? "Zurück zu Cascrow" : "Back to Cascrow"}
            </Link>
            <button
              onClick={() => setLang(de ? "en" : "de")}
              className="text-xs px-3 py-1.5 rounded border transition-colors"
              style={{
                borderColor: "rgba(196,112,75,0.4)",
                color: "#C4704B",
                background: "rgba(196,112,75,0.06)",
              }}
            >
              {de ? "🇬🇧 English" : "🇩🇪 Deutsch"}
            </button>
          </div>
          <h1
            className="text-3xl mt-6 mb-2"
            style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300 }}
          >
            {de ? "Risikohinweise" : "Risk Disclosure"}
          </h1>
          <p className="text-sm" style={{ color: "#A89B8C" }}>
            {de ? "Zuletzt aktualisiert: April 2026" : "Last updated: April 2026"}
          </p>

          {/* Warning box */}
          <div
            className="mt-5 p-4 rounded-lg"
            style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.3)" }}
          >
            <p className="text-sm font-medium" style={{ color: "#C4704B" }}>
              {de
                ? "Wichtiger Hinweis — bitte vollständig lesen"
                : "Important Notice — please read in full"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#A89B8C" }}>
              {de
                ? "Die Nutzung von Cascrow ist mit erheblichen Risiken verbunden. Setzen Sie keine Mittel ein, deren Verlust Sie sich nicht leisten können. Diese Risikohinweise sind kein abschließendes Verzeichnis aller Risiken."
                : "Using Cascrow involves significant risks. Do not use funds you cannot afford to lose. These risk disclosures are not an exhaustive list of all risks."}
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <Section title={de ? "1. Kein Anlage- oder Rechtsberatung" : "1. No Investment or Legal Advice"}>
          <p>
            {de
              ? "Cascrow ist eine technische Plattform, kein Finanz- oder Rechtsberater. Die auf der Plattform bereitgestellten Informationen stellen keine Anlageberatung, Rechtsberatung oder sonstige regulierte Dienstleistung dar. Vor dem Einsatz größerer Beträge empfehlen wir die Konsultation qualifizierter Fachkräfte."
              : "Cascrow is a technical platform, not a financial or legal adviser. Information provided on the platform does not constitute investment advice, legal advice, or any other regulated service. We recommend consulting qualified professionals before committing significant funds."}
          </p>
        </Section>

        {/* Section 2 */}
        <Section title={de ? "2. Smart-Contract-Risiken" : "2. Smart Contract Risks"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Code-Fehler:" : "Code errors:"}</strong>{" "}
              {de
                ? "Smart Contracts sind Software. Trotz sorgfältiger Entwicklung können Bugs, Sicherheitslücken oder Logikfehler vorhanden sein, die zu einem vollständigen oder teilweisen Verlust gesperrter Mittel führen können."
                : "Smart contracts are software. Despite careful development, bugs, security vulnerabilities, or logic errors may exist that can result in partial or total loss of locked funds."}
            </Li>
            <Li>
              <strong>{de ? "Keine formellen Audits:" : "No formal audits:"}</strong>{" "}
              {de
                ? "Der Escrow Smart Contract von Cascrow wurde bisher nicht durch ein unabhängiges Sicherheitsaudit geprüft. Die Nutzung erfolgt auf eigenes Risiko."
                : "Cascrow's escrow smart contract has not yet been reviewed by an independent security audit. Use is at your own risk."}
            </Li>
            <Li>
              <strong>{de ? "Unveränderlichkeit:" : "Immutability:"}</strong>{" "}
              {de
                ? "Einmal auf der Blockchain bestätigte Transaktionen können nicht rückgängig gemacht werden. Fehler bei Wallet-Adressen oder Beträgen sind nach Bestätigung nicht korrigierbar."
                : "Transactions once confirmed on the blockchain cannot be reversed. Errors in wallet addresses or amounts cannot be corrected after confirmation."}
            </Li>
            <Li>
              <strong>{de ? "Upgrade-Risiken:" : "Upgrade risks:"}</strong>{" "}
              {de
                ? "Smart Contracts können nach dem Deployment grundsätzlich nicht verändert werden. Cascrow kann bekannte Fehler in einem bestehenden Contract nicht beheben und würde in einem solchen Fall einen neuen Contract deployen."
                : "Smart contracts generally cannot be changed after deployment. Cascrow cannot fix known bugs in an existing contract and would deploy a new contract in such a case."}
            </Li>
          </ul>
        </Section>

        {/* Section 3 */}
        <Section title={de ? "3. Blockchain- und Netzwerkrisiken" : "3. Blockchain and Network Risks"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Netzwerkausfälle:" : "Network outages:"}</strong>{" "}
              {de
                ? "Die XRPL EVM Sidechain und der XRP Ledger sind dezentrale Netzwerke. Cascrow hat keinen Einfluss auf deren Betrieb, Verfügbarkeit oder Ausfälle."
                : "The XRPL EVM Sidechain and XRP Ledger are decentralised networks. Cascrow has no influence over their operation, availability, or outages."}
            </Li>
            <Li>
              <strong>{de ? "Netzwerkgebühren (Gas Fees):" : "Network fees (gas fees):"}</strong>{" "}
              {de
                ? "Transaktionen auf der Blockchain erfordern Netzwerkgebühren, die sich unvorhersehbar ändern können. Hohe Gas-Preise können Transaktionen verzögern oder verteuern."
                : "Blockchain transactions require network fees that can change unpredictably. High gas prices can delay or increase the cost of transactions."}
            </Li>
            <Li>
              <strong>{de ? "Fork-Risiken:" : "Fork risks:"}</strong>{" "}
              {de
                ? "Blockchains können Hard Forks erleiden, die zu unerwarteten Verhaltensänderungen oder Inkompatibilitäten mit Smart Contracts führen."
                : "Blockchains can undergo hard forks that lead to unexpected behavioural changes or incompatibilities with smart contracts."}
            </Li>
            <Li>
              <strong>{de ? "Dezentralisierungsrisiken:" : "Decentralisation risks:"}</strong>{" "}
              {de
                ? "Bei geringer Netzwerkteilnahme (insbesondere auf Testnetzwerken) bestehen erhöhte Risiken durch 51%-Angriffe oder Validator-Ausfälle."
                : "With low network participation (especially on testnets), there are increased risks from 51% attacks or validator failures."}
            </Li>
          </ul>
        </Section>

        {/* Section 4 */}
        <Section title={de ? "4. Testnet-Status" : "4. Testnet Status"}>
          <div className="p-3 rounded mb-3" style={{ background: "rgba(196,112,75,0.07)", border: "1px solid rgba(196,112,75,0.15)" }}>
            <p style={{ color: "#C4704B" }} className="font-medium text-sm">
              {de ? "Aktueller Stand (April 2026)" : "Current status (April 2026)"}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            <Li>
              {de
                ? "Die Escrow-Funktionen von Cascrow laufen derzeit auf der XRPL EVM Testnet (Chain ID 1449000). RLUSD auf dem Testnet hat keinen realen Geldwert."
                : "Cascrow's escrow functions currently run on the XRPL EVM Testnet (Chain ID 1449000). RLUSD on the testnet has no real monetary value."}
            </Li>
            <Li>
              {de
                ? "Testnet-Netzwerke können jederzeit zurückgesetzt werden, wodurch alle Transaktionshistorien und Smart-Contract-Zustände verloren gehen könnten."
                : "Testnet networks can be reset at any time, potentially losing all transaction histories and smart contract states."}
            </Li>
            <Li>
              {de
                ? "NFT-Zertifikate werden auf dem XRP Ledger Mainnet ausgestellt und sind dauerhaft. Die Escrow-Funktionen werden bei Verfügbarkeit der XRPL EVM Mainnet auf das Mainnet migriert."
                : "NFT certificates are issued on the XRP Ledger Mainnet and are permanent. Escrow functions will be migrated to the XRPL EVM Mainnet when it becomes available."}
            </Li>
            <Li>
              {de
                ? "Nutzer sollten Maßnahmen und Entscheidungen, die auf Testnet-Transaktionen basieren, mit besonderer Vorsicht treffen."
                : "Users should exercise particular caution with actions and decisions based on testnet transactions."}
            </Li>
          </ul>
        </Section>

        {/* Section 5 */}
        <Section title={de ? "5. KI-Verifikationsrisiken" : "5. AI Verification Risks"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Keine Garantie auf Richtigkeit:" : "No guarantee of accuracy:"}</strong>{" "}
              {de
                ? "Das 5-Modell-Mehrheitsvotum kann zu falschen Entscheidungen führen (Falsch-Positiv: Freigabe obwohl Meilenstein nicht erfüllt; Falsch-Negativ: Ablehnung obwohl Meilenstein erfüllt). Kein KI-System ist fehlerfrei."
                : "The 5-model majority vote can result in incorrect decisions (false positive: release despite milestone not being met; false negative: rejection despite milestone being met). No AI system is error-free."}
            </Li>
            <Li>
              <strong>{de ? "Abhängigkeit von KI-Anbietern:" : "Dependence on AI providers:"}</strong>{" "}
              {de
                ? "Cascrow nutzt externe KI-Anbieter (Anthropic, Google, OpenAI, Mistral, Cerebras). Ausfälle, API-Änderungen oder Modellwechsel dieser Anbieter können die Verifikation beeinflussen."
                : "Cascrow uses external AI providers (Anthropic, Google, OpenAI, Mistral, Cerebras). Outages, API changes, or model changes by these providers can affect verification."}
            </Li>
            <Li>
              <strong>{de ? "Prompt-Manipulation:" : "Prompt manipulation:"}</strong>{" "}
              {de
                ? "Böswillige Akteure könnten versuchen, durch manipulierte Nachweise oder Dokumente die KI-Entscheidung zu beeinflussen. Cascrow setzt Schutzmaßnahmen ein, kann aber keinen vollständigen Schutz garantieren."
                : "Malicious actors may attempt to manipulate AI decisions through falsified proofs or documents. Cascrow implements safeguards but cannot guarantee complete protection."}
            </Li>
            <Li>
              <strong>{de ? "Automatisierte Entscheidung:" : "Automated decision:"}</strong>{" "}
              {de
                ? "Die KI-Entscheidung hat direkte finanzielle Auswirkungen. Du hast das Recht auf manuelle Überprüfung innerhalb von 14 Tagen (Kontakt: hello@cascrow.com)."
                : "The AI decision has direct financial consequences. You have the right to request a manual review within 14 days (contact: hello@cascrow.com)."}
            </Li>
          </ul>
        </Section>

        {/* Section 6 */}
        <Section title={de ? "6. Token- und Währungsrisiken (RLUSD)" : "6. Token and Currency Risks (RLUSD)"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Stabilität:" : "Stability:"}</strong>{" "}
              {de
                ? "RLUSD ist ein Stablecoin, der auf 1 USD pegged ist. Es besteht jedoch kein garantierter Wechselkurs. Im Fall eines De-Pegging können gesperrte Mittel an Wert verlieren."
                : "RLUSD is a stablecoin pegged to 1 USD. However, there is no guaranteed exchange rate. In the event of de-pegging, locked funds may lose value."}
            </Li>
            <Li>
              <strong>{de ? "Emittentenrisiko:" : "Issuer risk:"}</strong>{" "}
              {de
                ? "RLUSD wird von Ripple Labs emittiert. Änderungen in der Unternehmenspolitik, regulatorische Eingriffe oder Insolvenz des Emittenten könnten den Wert beeinflussen."
                : "RLUSD is issued by Ripple Labs. Changes in company policy, regulatory intervention, or insolvency of the issuer could affect its value."}
            </Li>
            <Li>
              <strong>{de ? "Smart-Contract-Risiken des RLUSD-Tokens:" : "RLUSD token smart contract risks:"}</strong>{" "}
              {de
                ? "Der RLUSD ERC-20 Vertrag auf der XRPL EVM Sidechain wird von Ripple betrieben. Cascrow hat keinen Einfluss auf dessen Betrieb."
                : "The RLUSD ERC-20 contract on the XRPL EVM Sidechain is operated by Ripple. Cascrow has no influence over its operation."}
            </Li>
          </ul>
        </Section>

        {/* Section 7 */}
        <Section title={de ? "7. Wallet- und Sicherheitsrisiken" : "7. Wallet and Security Risks"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Private-Key-Verlust:" : "Private key loss:"}</strong>{" "}
              {de
                ? "Der Verlust des privaten Schlüssels oder der MetaMask-Zugangsdaten bedeutet den dauerhaften Verlust des Zugriffs auf deine Wallet und die darin enthaltenen Mittel. Cascrow kann keine Wallets wiederherstellen."
                : "Losing your private key or MetaMask credentials means permanent loss of access to your wallet and the funds it contains. Cascrow cannot recover wallets."}
            </Li>
            <Li>
              <strong>{de ? "Phishing und Social Engineering:" : "Phishing and social engineering:"}</strong>{" "}
              {de
                ? "Achte darauf, dass du nur die offizielle Cascrow-Domain (cascrow.com) nutzt. Cascrow wird dich niemals nach deinem privaten Schlüssel oder deiner Seed Phrase fragen."
                : "Ensure you only use the official Cascrow domain (cascrow.com). Cascrow will never ask for your private key or seed phrase."}
            </Li>
            <Li>
              <strong>{de ? "MetaMask-Risiken:" : "MetaMask risks:"}</strong>{" "}
              {de
                ? "MetaMask ist eine Browser-Erweiterung eines Drittanbieters. Sicherheitslücken in MetaMask oder deinem Browser könnten zu Wallet-Kompromittierungen führen."
                : "MetaMask is a third-party browser extension. Security vulnerabilities in MetaMask or your browser could lead to wallet compromise."}
            </Li>
            <Li>
              <strong>{de ? "Transaktionsbestätigung:" : "Transaction confirmation:"}</strong>{" "}
              {de
                ? "Prüfe bei jeder MetaMask-Transaktion sorgfältig Empfängeradresse und Betrag, bevor du bestätigst. Einmal gesendete Transaktionen sind nicht rückholbar."
                : "Carefully verify the recipient address and amount in every MetaMask transaction before confirming. Sent transactions cannot be recalled."}
            </Li>
          </ul>
        </Section>

        {/* Section 8 */}
        <Section title={de ? "8. Regulatorische Risiken" : "8. Regulatory Risks"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Unklare Rechtslage:" : "Unclear legal landscape:"}</strong>{" "}
              {de
                ? "Die Regulierung von Krypto-Assets, Stablecoins und KI-gestützten Finanzdiensten ist in vielen Jurisdiktionen noch im Entstehen. Änderungen der Rechtslage können die Nutzbarkeit der Plattform einschränken oder beenden."
                : "Regulation of crypto assets, stablecoins, and AI-assisted financial services is still evolving in many jurisdictions. Changes in law may restrict or terminate platform usability."}
            </Li>
            <Li>
              <strong>{de ? "MiCA und künftige EU-Regulierung:" : "MiCA and future EU regulation:"}</strong>{" "}
              {de
                ? "Die EU-Verordnung über Märkte für Kryptowerte (MiCA) und verwandte Regulierungen können zukünftige Anforderungen an Cascrow stellen. Cascrow wird diese Anforderungen nach Kräften erfüllen."
                : "The EU Markets in Crypto-Assets Regulation (MiCA) and related regulations may impose future requirements on Cascrow. Cascrow will fulfil these requirements to the best of its ability."}
            </Li>
            <Li>
              <strong>{de ? "Keine BaFin-Lizenz:" : "No BaFin licence:"}</strong>{" "}
              {de
                ? "Cascrow ist kein zugelassenes Zahlungsinstitut, keine Bank und kein regulierter Finanzdienstleister im Sinne des KWG oder ZAG. Die Plattform bietet keinen regulierten Zahlungsdienst an."
                : "Cascrow is not a licensed payment institution, bank, or regulated financial service provider under the KWG or ZAG. The platform does not provide regulated payment services."}
            </Li>
            <Li>
              <strong>{de ? "Sanktions- und AML-Risiken:" : "Sanctions and AML risks:"}</strong>{" "}
              {de
                ? "Cascrow prüft Nutzer bei der Registrierung gegen Sanktionslisten. Bei nachträglicher Einstufung auf eine Sanktionsliste kann ein Konto gesperrt werden. In diesem Fall können Mittel eingefroren werden."
                : "Cascrow screens users against sanctions lists at registration. If a user is subsequently added to a sanctions list, an account may be suspended. In such cases, funds may be frozen."}
            </Li>
          </ul>
        </Section>

        {/* Section 9 */}
        <Section title={de ? "9. Plattform- und Betriebsrisiken" : "9. Platform and Operational Risks"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Beta-Status:" : "Beta status:"}</strong>{" "}
              {de
                ? "Cascrow befindet sich in der Beta-Phase. Die Plattform kann Bugs enthalten, ungeplant offline gehen oder Funktionen ohne Vorankündigung ändern."
                : "Cascrow is in beta. The platform may contain bugs, go offline unexpectedly, or change features without prior notice."}
            </Li>
            <Li>
              <strong>{de ? "Drittanbieter-Abhängigkeiten:" : "Third-party dependencies:"}</strong>{" "}
              {de
                ? "Cascrow ist von Drittanbieter-Diensten abhängig (Vercel, Neon, Resend, AI-Anbieter etc.). Ausfälle dieser Anbieter können die Plattformverfügbarkeit beeinträchtigen."
                : "Cascrow depends on third-party services (Vercel, Neon, Resend, AI providers, etc.). Outages of these providers can affect platform availability."}
            </Li>
            <Li>
              <strong>{de ? "Plattformeinstellung:" : "Platform discontinuation:"}</strong>{" "}
              {de
                ? "Cascrow kann als Plattform eingestellt werden. In diesem Fall würden aktive Smart Contracts auf der Blockchain weiterhin bestehen, die Plattformoberfläche und -unterstützung würde jedoch wegfallen. Blockchain-Transaktionen bleiben dauerhaft bestehen."
                : "Cascrow may be discontinued as a platform. Active smart contracts on the blockchain would continue to exist, but the platform interface and support would be unavailable. Blockchain transactions remain permanently."}
            </Li>
            <Li>
              <strong>{de ? "Datenverlust:" : "Data loss:"}</strong>{" "}
              {de
                ? "Obwohl Cascrow regelmäßige Backups durchführt, besteht ein Restrisiko für Datenverlust. Auf öffentlichen Blockchains gespeicherte Daten sind davon ausgenommen."
                : "Although Cascrow performs regular backups, a residual risk of data loss exists. Data stored on public blockchains is exempt from this."}
            </Li>
          </ul>
        </Section>

        {/* Section 10 */}
        <Section title={de ? "10. CSRD- und ESG-spezifische Risiken" : "10. CSRD- and ESG-Specific Risks"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Keine Prüfungsleistung:" : "No audit service:"}</strong>{" "}
              {de
                ? "Die CSRD/ESG-Funktionen von Cascrow (Materialitätsanalyse, XBRL-Reports) sind technische Hilfsmittel und ersetzen keine gesetzlich vorgeschriebene Nachhaltigkeits-Prüfung durch zugelassene Wirtschaftsprüfer."
                : "Cascrow's CSRD/ESG features (materiality analysis, XBRL reports) are technical tools and do not replace legally required sustainability audits by licensed auditors."}
            </Li>
            <Li>
              <strong>{de ? "KI-generierte Einschätzungen:" : "AI-generated assessments:"}</strong>{" "}
              {de
                ? "Materialitätsmatrizen und ESRS-Zuordnungen werden KI-unterstützt generiert und müssen von qualifizierten Fachkräften überprüft werden, bevor sie für Compliance-Zwecke verwendet werden."
                : "Materiality matrices and ESRS mappings are AI-generated and must be reviewed by qualified professionals before being used for compliance purposes."}
            </Li>
            <Li>
              <strong>{de ? "Änderung von Regulierungen:" : "Regulatory changes:"}</strong>{" "}
              {de
                ? "CSRD, ESRS und verwandte ESG-Regulierungen befinden sich im Wandel. Cascrow versucht, aktuell zu bleiben, kann aber keine Garantie für die Konformität mit der jeweils gültigen Fassung geben."
                : "CSRD, ESRS, and related ESG regulations are evolving. Cascrow endeavours to stay current but cannot guarantee conformity with the most recent version in force."}
            </Li>
          </ul>
        </Section>

        <div className="text-sm mt-4 pt-6" style={{ borderTop: "1px solid rgba(196,112,75,0.15)", color: "#A89B8C" }}>
          <div className="flex gap-6 flex-wrap">
            <Link href="/terms" style={{ color: "#C4704B" }}>
              {de ? "Nutzungsbedingungen" : "Terms of Use"}
            </Link>
            <Link href="/datenschutz" style={{ color: "#C4704B" }}>
              {de ? "Datenschutzerklärung" : "Privacy Policy"}
            </Link>
            <Link href="/" style={{ color: "#C4704B" }}>
              ← {de ? "Zurück zu Cascrow" : "Back to Cascrow"}
            </Link>
          </div>
        </div>
      </div>
    </main>
    <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium" style={{ color: "#EDE6DD", fontFamily: "var(--font-libre-franklin)" }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
        {children}
      </div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2" style={{ listStyle: "none", paddingLeft: 0 }}>
      <span style={{ color: "#C4704B", marginTop: 2, flexShrink: 0 }}>–</span>
      <span>{children}</span>
    </li>
  );
}
