"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

type Lang = "de" | "en";

export function TermsContent() {
  const [lang, setLang] = useState<Lang>("de");
  const de = lang === "de";

  return (
    <>
    <main
      className="min-h-screen px-4 pt-32 pb-16"
      style={{ background: "hsl(24 14% 4%)", color: "#EDE6DD" }}
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
            style={{ fontWeight: 300 }}
          >
            {de ? "Nutzungsbedingungen" : "Terms of Use"}
          </h1>
          <p className="text-sm" style={{ color: "#A89B8C" }}>
            {de ? "Zuletzt aktualisiert: April 2026" : "Last updated: April 2026"}
          </p>
        </div>

        {/* Section 1 */}
        <Section title={de ? "1. Geltungsbereich und Vertragspartner" : "1. Scope and Contracting Party"}>
          <p>
            {de
              ? "Diese Nutzungsbedingungen regeln die Nutzung der Plattform cascrow (cascrow.com), die einen KI-gestützten Meilenstein-Escrow-Dienst auf Basis der XRPL EVM Sidechain und des XRP Ledgers anbietet."
              : "These Terms of Use govern the use of the cascrow platform (cascrow.com), which provides an AI-powered milestone-based escrow service built on the XRPL EVM Sidechain and the XRP Ledger."}
          </p>
          <p className="mt-3">
            {de ? "Betreiber und Vertragspartner:" : "Operator and contracting party:"}{" "}
            <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
          <p className="mt-3 text-xs" style={{ color: "#6b7280" }}>
            {de
              ? "Hinweis: Cascrow befindet sich im Aufbau. Die vollständigen Angaben (Firmenname, Adresse, Handelsregisternummer) werden nach Gründung des Unternehmens ergänzt."
              : "Note: Cascrow is currently in development. Full details (company name, address, registration number) will be added after formal incorporation."}
          </p>
        </Section>

        {/* Section 2 */}
        <Section title={de ? "2. Leistungsbeschreibung" : "2. Description of Service"}>
          <p>
            {de
              ? "Cascrow ermöglicht es Investoren (Grant Givers) und Startups (Receivers), meilensteinbasierte Escrow-Verträge abzuschließen. Kernfunktionen der Plattform:"
              : "Cascrow enables investors (Grant Givers) and startups (Receivers) to enter into milestone-based escrow agreements. Core platform features:"}
          </p>
          <ul className="flex flex-col gap-2 mt-3">
            <Li>
              {de
                ? "Erstellung und Verwaltung von Meilensteinverträgen mit definierten Beträgen (USD) und Fristen"
                : "Creation and management of milestone contracts with defined amounts (USD) and deadlines"}
            </Li>
            <Li>
              {de
                ? "Sperrung von RLUSD (Ripple USD) in einem Smart Contract auf der XRPL EVM Sidechain"
                : "Locking RLUSD (Ripple USD) in a smart contract on the XRPL EVM Sidechain"}
            </Li>
            <Li>
              {de
                ? "KI-gestützte Meilensteinprüfung (5-Modell-Mehrheitsvotum: 3 von 5 KI-Modellen müssen zustimmen)"
                : "AI-assisted milestone verification (5-model majority vote: 3 of 5 AI models must approve)"}
            </Li>
            <Li>
              {de
                ? "Automatische Freigabe oder Rückerstattung der Mittel nach dem KI-Votum"
                : "Automatic release or refund of funds following the AI verdict"}
            </Li>
            <Li>
              {de
                ? "Ausstellung von nicht-übertragbaren NFT-Zertifikaten auf dem XRP Ledger Mainnet bei Abschluss"
                : "Issuance of non-transferable NFT certificates on the XRP Ledger Mainnet upon completion"}
            </Li>
            <Li>
              {de
                ? "Prüfpfad (Audit Trail) auf zwei Blockchains (XRPL EVM + XRP Ledger Mainnet)"
                : "Dual-chain audit trail (XRPL EVM + XRP Ledger Mainnet)"}
            </Li>
          </ul>
          <p className="mt-3">
            {de
              ? "Die Plattform befindet sich im Beta-Stadium. Funktionen können sich ohne vorherige Ankündigung ändern."
              : "The platform is in beta. Features may change without prior notice."}
          </p>
        </Section>

        {/* Section 3 */}
        <Section title={de ? "3. Registrierung und Zugangsbedingungen" : "3. Registration and Access Requirements"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Mindestalter:" : "Minimum age:"}</strong>{" "}
              {de
                ? "Du musst mindestens 18 Jahre alt sein, um die Plattform nutzen zu dürfen."
                : "You must be at least 18 years old to use the platform."}
            </Li>
            <Li>
              <strong>{de ? "Sanktionen:" : "Sanctions:"}</strong>{" "}
              {de
                ? "Personen, die auf OFAC- oder EU-Sanktionslisten stehen, ist die Nutzung der Plattform untersagt. Wir prüfen bei der Registrierung automatisch gegen diese Listen."
                : "Persons appearing on OFAC or EU sanctions lists are prohibited from using the platform. We automatically screen against these lists at registration."}
            </Li>
            <Li>
              <strong>{de ? "Korrekte Angaben:" : "Accurate information:"}</strong>{" "}
              {de
                ? "Du bist verpflichtet, bei der Registrierung korrekte Angaben zu machen. Falschangaben können zur sofortigen Kontosperrung führen."
                : "You are required to provide accurate information at registration. False information may result in immediate account suspension."}
            </Li>
            <Li>
              <strong>{de ? "Kontosicherheit:" : "Account security:"}</strong>{" "}
              {de
                ? "Du bist allein verantwortlich für die Sicherheit deines Passworts und die Aktivitäten unter deinem Konto. Cascrow haftet nicht für Schäden durch unbefugte Kontonutzung."
                : "You are solely responsible for the security of your password and all activity under your account. Cascrow is not liable for damages resulting from unauthorized account use."}
            </Li>
            <Li>
              <strong>{de ? "Ein Konto pro Person:" : "One account per person:"}</strong>{" "}
              {de
                ? "Die Erstellung mehrerer Konten für dieselbe natürliche oder juristische Person ist nicht gestattet."
                : "Creating multiple accounts for the same natural or legal person is not permitted."}
            </Li>
          </ul>
        </Section>

        {/* Section 4 */}
        <Section title={de ? "4. Pflichten der Nutzer" : "4. User Obligations"}>
          <p className="mb-3">
            {de ? "Du verpflichtest dich, die Plattform ausschließlich für rechtmäßige Zwecke zu nutzen. Insbesondere ist es untersagt:" : "You agree to use the platform for lawful purposes only. In particular, the following are prohibited:"}
          </p>
          <ul className="flex flex-col gap-2">
            <Li>
              {de
                ? "Eingabe falscher, manipulativer oder betrügerischer Meilenstein-Nachweise"
                : "Submitting false, manipulated, or fraudulent milestone proof documents"}
            </Li>
            <Li>
              {de
                ? "Versuch, das KI-Prüfsystem durch gezielte Prompt-Manipulation zu umgehen"
                : "Attempting to circumvent the AI verification system through deliberate prompt manipulation"}
            </Li>
            <Li>
              {de
                ? "Nutzung der Plattform zur Geldwäsche, Terrorismusfinanzierung oder Sanktionsumgehung"
                : "Using the platform for money laundering, terrorist financing, or sanctions evasion"}
            </Li>
            <Li>
              {de
                ? "Automatisierte Zugriffe (Scraping, Bots) ohne ausdrückliche schriftliche Genehmigung"
                : "Automated access (scraping, bots) without explicit written permission"}
            </Li>
            <Li>
              {de
                ? "Weitergabe von Zugangs-Tokens oder Einladungslinks an unberechtigte Dritte"
                : "Sharing access tokens or invite links with unauthorized third parties"}
            </Li>
            <Li>
              {de
                ? "Missbrauch des Rate-Limit-Systems oder Versuche, Sicherheitsmechanismen zu umgehen"
                : "Abusing the rate-limiting system or attempting to bypass security mechanisms"}
            </Li>
            <Li>
              {de
                ? "Hochladen von Inhalten, die Rechte Dritter verletzen (Urheberrecht, Datenschutz)"
                : "Uploading content that infringes third-party rights (copyright, privacy)"}
            </Li>
          </ul>
        </Section>

        {/* Section 5 */}
        <Section title={de ? "5. KI-Verifikation und manuelle Überprüfung" : "5. AI Verification and Manual Review"}>
          <p>
            {de
              ? "Die Freigabe oder Ablehnung von Escrow-Mitteln erfolgt primär durch ein automatisiertes Mehrheitsvotum von 5 KI-Modellen. Cascrow übernimmt keine Garantie für die Richtigkeit einzelner KI-Entscheidungen."
              : "The release or rejection of escrowed funds is primarily determined by an automated majority vote of 5 AI models. Cascrow does not guarantee the accuracy of individual AI decisions."}
          </p>
          <p className="mt-3">
            {de
              ? "Jede Partei hat das Recht, binnen 14 Tagen nach einer KI-Entscheidung eine manuelle Überprüfung durch den Plattformbetreiber anzufordern. Kontakt:"
              : "Either party has the right to request a manual review by the platform operator within 14 days of an AI decision. Contact:"}{" "}
            <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
          <p className="mt-3">
            {de
              ? "Der Betreiber behält sich vor, offensichtlich fehlerhafte KI-Entscheidungen zu korrigieren. Es besteht kein Rechtsanspruch auf eine bestimmte KI-Entscheidung oder ein bestimmtes Ergebnis der manuellen Überprüfung."
              : "The operator reserves the right to correct clearly erroneous AI decisions. There is no legal entitlement to a particular AI decision or outcome of a manual review."}
          </p>
        </Section>

        {/* Section 6 */}
        <Section title={de ? "6. Blockchain und Smart Contracts" : "6. Blockchain and Smart Contracts"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Unveränderlichkeit:" : "Immutability:"}</strong>{" "}
              {de
                ? "Blockchain-Transaktionen sind technisch unveränderlich und können nicht rückgängig gemacht werden. Cascrow kann keine Transaktionen stornieren, sobald diese auf der Blockchain bestätigt wurden."
                : "Blockchain transactions are technically immutable and cannot be reversed. Cascrow cannot cancel transactions once they are confirmed on the blockchain."}
            </Li>
            <Li>
              <strong>{de ? "Smart-Contract-Risiken:" : "Smart contract risks:"}</strong>{" "}
              {de
                ? "Smart Contracts können trotz sorgfältiger Entwicklung Fehler enthalten. Cascrow haftet nicht für Verluste durch Smart-Contract-Bugs, soweit keine grobe Fahrlässigkeit oder Vorsatz vorliegt."
                : "Smart contracts may contain bugs despite careful development. Cascrow is not liable for losses caused by smart contract bugs unless gross negligence or intent is established."}
            </Li>
            <Li>
              <strong>{de ? "Wallet-Verantwortung:" : "Wallet responsibility:"}</strong>{" "}
              {de
                ? "Du bist allein verantwortlich für die Sicherung deiner Wallet-Schlüssel und MetaMask-Konfiguration. Cascrow hat keinen Zugriff auf private Wallet-Schlüssel."
                : "You are solely responsible for securing your wallet keys and MetaMask configuration. Cascrow has no access to private wallet keys."}
            </Li>
            <Li>
              <strong>{de ? "Testnet-Betrieb:" : "Testnet operation:"}</strong>{" "}
              {de
                ? "Cascrow betreibt derzeit Escrow-Funktionen auf der XRPL EVM Testnet (Chain ID 1449000). NFT-Zertifikate werden auf dem XRP Ledger Mainnet ausgestellt. Werte und Transaktionen auf dem Testnet haben keine reale Geldwertigkeit."
                : "Cascrow currently operates escrow functions on the XRPL EVM Testnet (Chain ID 1449000). NFT certificates are issued on the XRP Ledger Mainnet. Testnet values and transactions have no real monetary value."}
            </Li>
            <Li>
              <strong>{de ? "Öffentliche Sichtbarkeit:" : "Public visibility:"}</strong>{" "}
              {de
                ? "Wallet-Adressen und Transaktionsdaten sind auf öffentlichen Blockchains weltweit einsehbar und unterliegen nicht dem Datenschutzrecht."
                : "Wallet addresses and transaction data are publicly visible on public blockchains worldwide and are not subject to data protection law."}
            </Li>
          </ul>
        </Section>

        {/* Section 7 */}
        <Section title={de ? "7. Gebühren" : "7. Fees"}>
          <p>
            {de
              ? "Die Nutzung der Plattform ist derzeit in der Beta-Phase kostenlos. Cascrow plant, in einer späteren Version eine Protokollgebühr von 0,5 % auf freigegebene Escrow-Beträge zu erheben. Nutzer werden mindestens 30 Tage im Voraus per E-Mail über die Einführung von Gebühren informiert."
              : "Use of the platform is currently free during the beta phase. Cascrow plans to introduce a protocol fee of 0.5% on released escrow amounts in a future version. Users will be notified by email at least 30 days in advance of any fee introduction."}
          </p>
          <p className="mt-3">
            {de
              ? "Netzwerkgebühren (Gas Fees) für Blockchain-Transaktionen sind vom Nutzer selbst zu tragen und werden nicht von Cascrow erstattet."
              : "Network fees (gas fees) for blockchain transactions are the responsibility of the user and are not reimbursed by Cascrow."}
          </p>
        </Section>

        {/* Section 8 */}
        <Section title={de ? "8. Geistiges Eigentum" : "8. Intellectual Property"}>
          <p>
            {de
              ? "Alle Rechte an der Plattform (Design, Code, Marke, Texte) liegen beim Betreiber von Cascrow, soweit nicht anders angegeben. Die Nutzung dieser Inhalte außerhalb der bestimmungsgemäßen Plattformnutzung ist ohne ausdrückliche Genehmigung nicht gestattet."
              : "All rights to the platform (design, code, brand, content) belong to the operator of Cascrow unless otherwise stated. Use of this content outside of intended platform use is not permitted without explicit authorization."}
          </p>
          <p className="mt-3">
            {de
              ? "Hochgeladene Nachweisdokumente (PDFs, GitHub-Links) verbleiben im Eigentum der jeweiligen Nutzer. Du räumst Cascrow das Recht ein, diese Inhalte ausschließlich zum Zweck der KI-Verifikation zu verarbeiten."
              : "Uploaded proof documents (PDFs, GitHub links) remain the property of the respective users. You grant Cascrow the right to process this content solely for the purpose of AI verification."}
          </p>
        </Section>

        {/* Section 9 */}
        <Section title={de ? "9. Haftungsbeschränkung" : "9. Limitation of Liability"}>
          <p>
            {de
              ? "Cascrow haftet unbegrenzt für Schäden, die durch Vorsatz oder grobe Fahrlässigkeit verursacht werden, sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit."
              : "Cascrow is liable without limitation for damages caused by intent or gross negligence, and for damages from injury to life, body, or health."}
          </p>
          <p className="mt-3">
            {de
              ? "Für einfache Fahrlässigkeit haftet Cascrow nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und nur in Höhe des vorhersehbaren, vertragstypischen Schadens."
              : "For ordinary negligence, Cascrow is only liable for breach of material contractual obligations (cardinal obligations) and only up to the amount of foreseeable, typical contractual damage."}
          </p>
          <p className="mt-3">
            {de
              ? "Cascrow haftet nicht für:"
              : "Cascrow is not liable for:"}
          </p>
          <ul className="flex flex-col gap-2 mt-2">
            <Li>
              {de
                ? "Fehlerhafte oder falsch-positive/negative KI-Entscheidungen (solange kein grobe Fahrlässigkeit vorliegt)"
                : "Incorrect or false-positive/negative AI decisions (absent gross negligence)"}
            </Li>
            <Li>
              {de
                ? "Verluste durch Smart-Contract-Bugs, soweit keine grobe Fahrlässigkeit vorliegt"
                : "Losses from smart contract bugs, absent gross negligence"}
            </Li>
            <Li>
              {de
                ? "Ausfälle der XRPL EVM Sidechain, des XRP Ledgers oder von MetaMask"
                : "Outages of the XRPL EVM Sidechain, XRP Ledger, or MetaMask"}
            </Li>
            <Li>
              {de
                ? "Verluste durch Verlust oder Diebstahl von Wallet-Schlüsseln"
                : "Losses from loss or theft of wallet keys"}
            </Li>
            <Li>
              {de
                ? "Schäden durch höhere Gewalt (Naturkatastrophen, Cyberangriffe auf Infrastrukturanbieter, etc.)"
                : "Damages from force majeure (natural disasters, cyberattacks on infrastructure providers, etc.)"}
            </Li>
          </ul>
        </Section>

        {/* Section 10 */}
        <Section title={de ? "10. Verfügbarkeit und Betrieb" : "10. Availability and Operations"}>
          <p>
            {de
              ? "Cascrow strebt eine hohe Verfügbarkeit der Plattform an, übernimmt aber keine Garantie für unterbrechungsfreien Betrieb. Wartungsarbeiten können zu vorübergehenden Ausfällen führen. Cascrow wird Nutzer bei geplanten Wartungsfenstern nach Möglichkeit vorab informieren."
              : "Cascrow aims for high platform availability but does not guarantee uninterrupted operation. Maintenance work may cause temporary outages. Cascrow will notify users of planned maintenance windows in advance where possible."}
          </p>
          <p className="mt-3">
            {de
              ? "Die Plattform befindet sich in der Beta-Phase. Funktionen, APIs und Vertragsstrukturen können sich ändern. Cascrow ist nicht verpflichtet, bestehende Schnittstellen dauerhaft zu erhalten."
              : "The platform is in beta phase. Features, APIs, and contract structures may change. Cascrow is not obligated to maintain existing interfaces indefinitely."}
          </p>
        </Section>

        {/* Section 11 */}
        <Section title={de ? "11. Kündigung und Sperrung" : "11. Termination and Suspension"}>
          <p>
            {de
              ? "Nutzer können ihr Konto jederzeit in den Profileinstellungen löschen. Aktive Escrow-Verträge müssen vor der Kontolöschung abgewickelt werden."
              : "Users may delete their account at any time in Profile Settings. Active escrow contracts must be settled before account deletion."}
          </p>
          <p className="mt-3">
            {de
              ? "Cascrow behält sich das Recht vor, Konten bei Verstößen gegen diese Nutzungsbedingungen, bei Verdacht auf Betrug oder auf behördliche Anordnung hin zu sperren oder zu löschen. Bei einer Sperrung werden die betroffenen Nutzer soweit möglich per E-Mail informiert."
              : "Cascrow reserves the right to suspend or delete accounts in case of violations of these Terms, suspected fraud, or upon official order. Affected users will be notified by email where possible."}
          </p>
          <p className="mt-3">
            {de
              ? "Blockchain-Einträge (Transaktionen, NFTs, Audit-Memos) bleiben nach Kontolöschung dauerhaft auf der Blockchain erhalten und können technisch nicht gelöscht werden."
              : "Blockchain entries (transactions, NFTs, audit memos) remain permanently on the blockchain after account deletion and cannot technically be removed."}
          </p>
        </Section>

        {/* Section 12 */}
        <Section title={de ? "12. Datenschutz" : "12. Privacy"}>
          <p>
            {de
              ? "Die Verarbeitung personenbezogener Daten ist in unserer Datenschutzerklärung geregelt, die Bestandteil dieser Nutzungsbedingungen ist:"
              : "The processing of personal data is governed by our Privacy Policy, which forms part of these Terms of Use:"}
          </p>
          <p className="mt-2">
            <Link href="/datenschutz" style={{ color: "#C4704B" }}>
              {de ? "Datenschutzerklärung / Privacy Policy →" : "Privacy Policy / Datenschutzerklärung →"}
            </Link>
          </p>
        </Section>

        {/* Section 13 */}
        <Section title={de ? "13. Anwendbares Recht und Gerichtsstand" : "13. Governing Law and Jurisdiction"}>
          <p>
            {de
              ? "Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts (CISG). Als Gerichtsstand wird – soweit gesetzlich zulässig – der Sitz des Betreibers vereinbart."
              : "German law applies, excluding the UN Convention on Contracts for the International Sale of Goods (CISG). The registered office of the operator is agreed as the place of jurisdiction, to the extent permitted by law."}
          </p>
          <p className="mt-3">
            {de
              ? "Für Verbraucher innerhalb der EU gilt: Wenn du als Verbraucher in einem anderen EU-Mitgliedstaat ansässig bist, bleiben die zwingenden Verbraucherschutzvorschriften deines Wohnsitzstaats anwendbar."
              : "For consumers within the EU: If you are a consumer residing in another EU member state, the mandatory consumer protection provisions of your country of residence remain applicable."}
          </p>
          <p className="mt-3">
            {de
              ? "Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: "
              : "The EU Commission provides a platform for online dispute resolution (ODR): "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#C4704B" }}
            >
              ec.europa.eu/consumers/odr
            </a>
            {de
              ? ". Cascrow ist nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."
              : ". Cascrow is not obligated and not willing to participate in dispute resolution proceedings before a consumer arbitration board."}
          </p>
        </Section>

        {/* Section 14 */}
        <Section title={de ? "14. Änderungen der Nutzungsbedingungen" : "14. Changes to These Terms"}>
          <p>
            {de
              ? "Cascrow behält sich vor, diese Nutzungsbedingungen anzupassen. Bei wesentlichen Änderungen informieren wir registrierte Nutzer mindestens 30 Tage im Voraus per E-Mail. Die weitere Nutzung der Plattform nach Ablauf dieser Frist gilt als Zustimmung zu den geänderten Bedingungen."
              : "Cascrow reserves the right to amend these Terms of Use. For material changes, we will notify registered users at least 30 days in advance by email. Continued use of the platform after this period constitutes acceptance of the amended terms."}
          </p>
          <p className="mt-3">
            {de
              ? "Die jeweils aktuelle Version dieser Nutzungsbedingungen ist stets unter cascrow.com/terms abrufbar."
              : "The current version of these Terms of Use is always available at cascrow.com/terms."}
          </p>
        </Section>

        {/* Section 15 — Widerrufsrecht */}
        <Section title={de ? "15. Widerrufsrecht (Verbraucher)" : "15. Right of Withdrawal (Consumers)"}>
          <p>
            {de
              ? "Wenn du als Verbraucher (§ 13 BGB) einen Nutzungsvertrag mit Cascrow abschließt, steht dir grundsätzlich ein gesetzliches Widerrufsrecht von 14 Tagen zu. Die vollständige Widerrufsbelehrung sowie das Muster-Widerrufsformular findest du unter "
              : "If you enter into a user agreement with Cascrow as a consumer (§ 13 BGB), you generally have a statutory right of withdrawal of 14 days. The full withdrawal notice and model withdrawal form are available at "}
            <Link href="/widerruf" style={{ color: "#C4704B" }}>
              {de ? "cascrow.com/widerruf" : "cascrow.com/widerruf"}
            </Link>
            {"."}
          </p>
          <p className="mt-3">
            {de
              ? "Durch die Registrierung und aktive Nutzung der Plattform (z.B. Erstellung eines Escrow-Vertrags) stimmst du ausdrücklich zu, dass Cascrow mit der Ausführung des Dienstes sofort beginnt. Du nimmst zur Kenntnis, dass du dein Widerrufsrecht mit Beginn der Ausführung des Dienstes verlierst (§ 356 Abs. 5 BGB)."
              : "By registering and actively using the platform (e.g. creating an escrow contract), you expressly agree that Cascrow begins performing the service immediately. You acknowledge that you lose your right of withdrawal once performance of the service has begun (§ 356(5) BGB)."}
          </p>
          <p className="mt-3">
            {de
              ? "Dieses Widerrufsrecht gilt ausschließlich für Verbraucher im Sinne des § 13 BGB. Gewerbliche Nutzer haben kein gesetzliches Widerrufsrecht."
              : "This right of withdrawal applies exclusively to consumers within the meaning of § 13 BGB. Business users do not have a statutory right of withdrawal."}
          </p>
        </Section>

        {/* Section 16 — Vertragssprache + Textspeicherung */}
        <Section title={de ? "16. Vertragssprache und Textspeicherung" : "16. Contract Language and Text Storage"}>
          <p>
            {de
              ? "Die Vertragssprache ist Deutsch. Diese Nutzungsbedingungen werden zusätzlich auf Englisch bereitgestellt; im Falle von Widersprüchen gilt die deutsche Fassung."
              : "The contract language is German. These Terms of Use are additionally provided in English; in the event of discrepancies, the German version prevails."}
          </p>
          <p className="mt-3">
            {de
              ? "Der Vertragstext wird nicht gesondert gespeichert und ist nach Vertragsschluss nicht über dein Konto abrufbar. Die jeweils gültige Fassung dieser Nutzungsbedingungen ist jederzeit unter cascrow.com/terms einsehbar (§ 312i Abs. 1 Nr. 4 BGB)."
              : "The contract text is not stored separately and is not accessible via your account after conclusion of the contract. The current version of these Terms of Use is available at all times at cascrow.com/terms (§ 312i(1) No. 4 BGB)."}
          </p>
        </Section>

        {/* Section 17 — Salvatorische Klausel */}
        <Section title={de ? "17. Salvatorische Klausel" : "17. Severability"}>
          <p>
            {de
              ? "Sollten einzelne Bestimmungen dieser Nutzungsbedingungen ganz oder teilweise unwirksam oder undurchführbar sein oder werden, berührt dies die Wirksamkeit der übrigen Bestimmungen nicht. An die Stelle der unwirksamen oder undurchführbaren Bestimmung tritt die gesetzliche Regelung. Dies gilt entsprechend bei Regelungslücken."
              : "Should individual provisions of these Terms of Use be or become wholly or partially invalid or unenforceable, this shall not affect the validity of the remaining provisions. The statutory provision shall replace the invalid or unenforceable provision. The same applies in the event of any gaps."}
          </p>
        </Section>

        {/* Section 18 — Kontakt */}
        <Section title={de ? "18. Kontakt" : "18. Contact"}>
          <p>
            {de
              ? "Bei Fragen zu diesen Nutzungsbedingungen oder Meldung von Verstößen:"
              : "For questions about these Terms of Use or to report violations:"}
          </p>
          <p className="mt-2">
            <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
        </Section>

        <div className="text-sm mt-4 pt-6" style={{ borderTop: "1px solid rgba(196,112,75,0.15)", color: "#A89B8C" }}>
          <Link href="/" style={{ color: "#C4704B" }}>
            ← {de ? "Zurück zu Cascrow" : "Back to Cascrow"}
          </Link>
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
      <h2 className="text-lg font-medium" style={{ color: "#EDE6DD" }}>
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
