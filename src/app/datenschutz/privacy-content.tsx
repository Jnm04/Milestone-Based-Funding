"use client";

import { useState } from "react";
import Link from "next/link";

type Lang = "de" | "en";

export function PrivacyContent() {
  const [lang, setLang] = useState<Lang>("de");
  const de = lang === "de";

  return (
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
            {/* Language toggle */}
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
            {de ? "Datenschutzerklärung" : "Privacy Policy"}
          </h1>
          <p className="text-sm" style={{ color: "#A89B8C" }}>
            {de ? "Zuletzt aktualisiert: April 2026" : "Last updated: April 2026"}
          </p>
        </div>

        {/* Section 1 */}
        <Section title={de ? "1. Verantwortlicher" : "1. Controller"}>
          <p>
            {de
              ? "Verantwortlicher im Sinne der DSGVO ist der Betreiber dieser Plattform (cascrow.com)."
              : "The controller within the meaning of the GDPR is the operator of this platform (cascrow.com)."}
            {" "}
            {de ? "Kontakt:" : "Contact:"}{" "}
            <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
          <p className="mt-3" style={{ color: "#A89B8C", fontSize: 13 }}>
            {de
              ? "Hinweis: Cascrow befindet sich im Aufbau. Die vollständigen Angaben zum Verantwortlichen (Firmenname, Adresse) werden nach Gründung des Unternehmens ergänzt."
              : "Note: Cascrow is currently in development. Full details about the controller (company name, address) will be added after the company is formally incorporated."}
          </p>
        </Section>

        {/* Section 2 */}
        <Section title={de ? "2. Welche Daten wir erheben" : "2. Data We Collect"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Account-Daten:" : "Account data:"}</strong>{" "}
              {de
                ? "E-Mail-Adresse (Pflicht), Name (optional), Geburtsdatum (optional – verbessert Sanktionsprüfung), XRPL-Wallet-Adresse (optional)"
                : "Email address (required), name (optional), date of birth (optional – improves sanctions screening), XRPL wallet address (optional)"}
            </Li>
            <Li>
              <strong>{de ? "Profildaten:" : "Profile data:"}</strong>{" "}
              {de
                ? "Unternehmen, Abteilung, Jobtitel, Telefon, Bio, Website (alle optional)"
                : "Company, department, job title, phone, bio, website (all optional)"}
            </Li>
            <Li>
              <strong>{de ? "Sicherheitsdaten:" : "Security data:"}</strong>{" "}
              {de
                ? "Passwort-Hash (bcrypt, nicht reversibel), Login-Versuche, Kontosperrstatus"
                : "Password hash (bcrypt, irreversible), login attempts, account lock status"}
            </Li>
            <Li>
              <strong>{de ? "Vertragsdaten:" : "Contract data:"}</strong>{" "}
              {de
                ? "Meilensteine, Beträge in USD, Fristen, Status, Einladungslinks – notwendig für die Kernfunktion der Plattform"
                : "Milestones, USD amounts, deadlines, status, invite links – necessary for the platform's core function"}
            </Li>
            <Li>
              <strong>{de ? "Nachweise (Proofs):" : "Proof documents:"}</strong>{" "}
              {de
                ? "Hochgeladene PDF-Dokumente oder GitHub-Links zur Meilensteinerfüllung"
                : "Uploaded PDF documents or GitHub links for milestone verification"}
            </Li>
            <Li>
              <strong>{de ? "Audit-Trail:" : "Audit trail:"}</strong>{" "}
              {de
                ? "Ereignisse (Vertrag erstellt, Zahlung freigegeben etc.) werden in der Datenbank sowie dauerhaft und öffentlich auf der XRP Ledger Blockchain gespeichert"
                : "Events (contract created, payment released, etc.) are stored in our database and permanently and publicly on the XRP Ledger blockchain"}
            </Li>
            <Li>
              <strong>{de ? "Blockchain-Daten:" : "Blockchain data:"}</strong>{" "}
              {de
                ? "Wallet-Adressen und Transaktionsdaten auf der XRPL EVM Sidechain (Escrow) und dem XRP Ledger Mainnet (NFT-Zertifikate, Audit-Memos) – öffentlich und unveränderlich"
                : "Wallet addresses and transaction data on the XRPL EVM Sidechain (escrow) and XRP Ledger Mainnet (NFT certificates, audit memos) – public and immutable"}
            </Li>
            <Li>
              <strong>{de ? "IP-Adresse:" : "IP address:"}</strong>{" "}
              {de
                ? "Temporär im Arbeitsspeicher für Rate Limiting und Sicherheitsschutz (max. 1 Stunde, nicht in der Datenbank gespeichert)"
                : "Temporarily in memory for rate limiting and security protection (max. 1 hour, not stored in the database)"}
            </Li>
            <Li>
              <strong>{de ? "Technische Fehlerdaten:" : "Technical error data:"}</strong>{" "}
              {de
                ? "Stack Traces, Fehlermeldungen, betroffene Seiten – über Sentry erfasst, ohne personenbezogene Kontoinformationen"
                : "Stack traces, error messages, affected pages – captured via Sentry, without personal account information"}
            </Li>
          </ul>
        </Section>

        {/* Section 3 */}
        <Section title={de ? "3. Zweck und Rechtsgrundlage" : "3. Purpose and Legal Basis"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):" : "Performance of a contract (Art. 6(1)(b) GDPR):"}</strong>{" "}
              {de
                ? "E-Mail, Passwort, Vertragsdaten – notwendig zur Erbringung des Escrow-Diensts und Verwaltung des Nutzerkontos"
                : "Email, password, contract data – necessary to provide the escrow service and manage your account"}
            </Li>
            <Li>
              <strong>{de ? "Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO):" : "Legal obligation (Art. 6(1)(c) GDPR):"}</strong>{" "}
              {de
                ? "Sanktionsprüfung gegen OFAC- und EU-Sanktionslisten; handelsrechtliche Aufbewahrung von Vertragsdaten"
                : "Sanctions screening against OFAC and EU sanctions lists; statutory retention of contract data"}
            </Li>
            <Li>
              <strong>{de ? "Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO):" : "Legitimate interests (Art. 6(1)(f) GDPR):"}</strong>{" "}
              {de
                ? "Sicherheitsmaßnahmen (Rate Limiting, Kontosperre), Betrugserkennung, Fehlerüberwachung (Sentry), Plattformbetrieb"
                : "Security measures (rate limiting, account lockout), fraud detection, error monitoring (Sentry), platform operation"}
            </Li>
            <Li>
              <strong>{de ? "Einwilligung (Art. 6 Abs. 1 lit. a DSGVO):" : "Consent (Art. 6(1)(a) GDPR):"}</strong>{" "}
              {de
                ? "Optionale E-Mail-Benachrichtigungen (einzeln abschaltbar in den Profileinstellungen), Telegram-Benachrichtigungen (nur bei aktiver Verknüpfung)"
                : "Optional email notifications (individually disableable in profile settings), Telegram notifications (only if actively linked)"}
            </Li>
          </ul>
        </Section>

        {/* Section 4 */}
        <Section title={de ? "4. E-Mail-Benachrichtigungen" : "4. Email Notifications"}>
          <p className="mb-3">
            {de
              ? "Wir unterscheiden zwischen Pflicht-E-Mails und optionalen Benachrichtigungen:"
              : "We distinguish between required emails and optional notifications:"}
          </p>
          <p className="mb-2" style={{ color: "#EDE6DD" }}>
            {de ? "Pflicht-E-Mails (können nicht deaktiviert werden):" : "Required emails (cannot be disabled):"}
          </p>
          <ul className="flex flex-col gap-1 mb-4">
            <Li>{de ? "E-Mail-Verifizierung bei Registrierung" : "Email verification on registration"}</Li>
            <Li>{de ? "Passwort-Reset-Link" : "Password reset link"}</Li>
            <Li>
              {de
                ? "Fulfillment Key bei Escrow-Abschluss (sicherheitskritisch für die Freigabe der Mittel)"
                : "Fulfillment key on escrow completion (security-critical for releasing funds)"}
            </Li>
          </ul>
          <p className="mb-2" style={{ color: "#EDE6DD" }}>
            {de
              ? "Optionale Benachrichtigungen (einzeln abschaltbar in "
              : "Optional notifications (individually disableable in "}
            <Link href="/profile" style={{ color: "#C4704B" }}>
              {de ? "Profileinstellungen → Notifications" : "Profile Settings → Notifications"}
            </Link>
            {"):"}
          </p>
          <ul className="flex flex-col gap-1">
            <Li>{de ? "Nachweis eingereicht" : "Proof submitted"}</Li>
            <Li>{de ? "Meilenstein steht zur manuellen Prüfung an" : "Milestone pending manual review"}</Li>
            <Li>{de ? "Meilenstein abgeschlossen und Zahlung freigegeben" : "Milestone completed and payment released"}</Li>
            <Li>{de ? "Escrow finanziert" : "Escrow funded"}</Li>
            <Li>{de ? "KI-Verifizierung erfolgreich" : "AI verification approved"}</Li>
            <Li>{de ? "KI-Verifizierung abgelehnt" : "AI verification rejected"}</Li>
          </ul>
          <p className="mt-3">
            {de
              ? "Alle E-Mails werden über Resend (New York, USA) versendet. Rechtsgrundlage für optionale Benachrichtigungen ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit widerrufen kannst."
              : "All emails are sent via Resend (New York, USA). The legal basis for optional notifications is your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time."}
          </p>
        </Section>

        {/* Section 5 */}
        <Section title={de ? "5. KI-Verarbeitung" : "5. AI Processing"}>
          <p>
            {de
              ? "Zur Überprüfung hochgeladener Nachweise nutzen wir ein Mehrheits-Votum von 5 KI-Modellen. Die Inhalte hochgeladener Dokumente werden an diese Dienste übermittelt. Personenbezogene Kontodaten (Name, E-Mail) werden nicht an KI-Anbieter übermittelt."
              : "To verify uploaded proof documents, we use a majority vote from 5 AI models. The content of uploaded documents is transmitted to these services. Personal account data (name, email) is not transmitted to AI providers."}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(196,112,75,0.2)" }}>
                  <th style={{ textAlign: "left", padding: "6px 12px 6px 0", color: "#EDE6DD" }}>
                    {de ? "Anbieter" : "Provider"}
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 12px", color: "#EDE6DD" }}>
                    {de ? "Standort" : "Location"}
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 0 6px 12px", color: "#EDE6DD" }}>
                    {de ? "Grundlage" : "Basis"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(de
                  ? [
                      ["Anthropic (Claude)", "USA", "SCCs"],
                      ["Google (Gemini)", "USA / EU", "EU-US DPF"],
                      ["OpenAI (GPT)", "USA", "EU-US DPF"],
                      ["Mistral AI", "Frankreich (EU)", "–"],
                      ["Cerebras", "USA", "SCCs"],
                    ]
                  : [
                      ["Anthropic (Claude)", "USA", "SCCs"],
                      ["Google (Gemini)", "USA / EU", "EU-US DPF"],
                      ["OpenAI (GPT)", "USA", "EU-US DPF"],
                      ["Mistral AI", "France (EU)", "–"],
                      ["Cerebras", "USA", "SCCs"],
                    ]
                ).map(([name, loc, basis]) => (
                  <tr key={name} style={{ borderBottom: "1px solid rgba(196,112,75,0.08)" }}>
                    <td style={{ padding: "7px 12px 7px 0" }}>{name}</td>
                    <td style={{ padding: "7px 12px" }}>{loc}</td>
                    <td style={{ padding: "7px 0 7px 12px" }}>{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs" style={{ color: "#6b7280" }}>
            {de
              ? "SCCs = EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) · EU-US DPF = EU-US Data Privacy Framework (Angemessenheitsbeschluss)"
              : "SCCs = EU Standard Contractual Clauses (Art. 46(2)(c) GDPR) · EU-US DPF = EU-US Data Privacy Framework (adequacy decision)"}
          </p>
        </Section>

        {/* Section 6 */}
        <Section title={de ? "6. Infrastruktur und Serverstandorte" : "6. Infrastructure and Server Locations"}>
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(196,112,75,0.2)" }}>
                  <th style={{ textAlign: "left", padding: "6px 12px 6px 0", color: "#EDE6DD" }}>
                    {de ? "Dienst" : "Service"}
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 12px", color: "#EDE6DD" }}>
                    {de ? "Zweck" : "Purpose"}
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 12px", color: "#EDE6DD" }}>
                    {de ? "Serverstandort" : "Server Location"}
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 0 6px 12px", color: "#EDE6DD" }}>
                    {de ? "Grundlage" : "Basis"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(de
                  ? [
                      ["Vercel", "Hosting, Datei-Speicher (PDFs, Zertifikate)", "USA (Edge global)", "EU-US DPF"],
                      ["Neon / Vercel Postgres", "Datenbank", "USA oder EU (je nach Konfig.)", "EU-US DPF / SCCs"],
                      ["Resend", "E-Mail-Versand", "USA", "SCCs"],
                      ["Cloudflare Turnstile", "Bot-Schutz", "Global (CDN)", "EU-US DPF"],
                      ["Sentry", "Fehlerüberwachung", "EU (Frankfurt)", "–"],
                      ["Telegram", "Optionale Benachrichtigungen", "Global", "SCCs"],
                      ["XRP Ledger Mainnet", "NFT-Zertifikate, Audit-Trail", "Dezentral, weltweit", "Öffentliche Blockchain"],
                      ["XRPL EVM Sidechain", "Escrow Smart Contract", "Dezentral, weltweit", "Öffentliche Blockchain"],
                    ]
                  : [
                      ["Vercel", "Hosting, file storage (PDFs, certificates)", "USA (Edge global)", "EU-US DPF"],
                      ["Neon / Vercel Postgres", "Database", "USA or EU (depending on config)", "EU-US DPF / SCCs"],
                      ["Resend", "Email delivery", "USA", "SCCs"],
                      ["Cloudflare Turnstile", "Bot protection", "Global (CDN)", "EU-US DPF"],
                      ["Sentry", "Error monitoring", "EU (Frankfurt)", "–"],
                      ["Telegram", "Optional notifications", "Global", "SCCs"],
                      ["XRP Ledger Mainnet", "NFT certificates, audit trail", "Decentralized, worldwide", "Public blockchain"],
                      ["XRPL EVM Sidechain", "Escrow smart contract", "Decentralized, worldwide", "Public blockchain"],
                    ]
                ).map(([name, purpose, loc, basis]) => (
                  <tr key={name} style={{ borderBottom: "1px solid rgba(196,112,75,0.08)" }}>
                    <td style={{ padding: "7px 12px 7px 0", whiteSpace: "nowrap" }}>{name}</td>
                    <td style={{ padding: "7px 12px" }}>{purpose}</td>
                    <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>{loc}</td>
                    <td style={{ padding: "7px 0 7px 12px", whiteSpace: "nowrap" }}>{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Section 7 */}
        <Section title={de ? "7. Internationale Datenübermittlung" : "7. International Data Transfers"}>
          <p>
            {de
              ? "Einige der oben genannten Dienste befinden sich in den USA oder anderen Drittländern außerhalb des EWR. Wir stellen sicher, dass diese Übermittlungen auf Basis geeigneter Garantien nach Art. 44 ff. DSGVO erfolgen:"
              : "Some of the services listed above are located in the USA or other third countries outside the EEA. We ensure that these transfers are based on appropriate safeguards pursuant to Art. 44 et seq. GDPR:"}
          </p>
          <ul className="flex flex-col gap-2 mt-3">
            <Li>
              <strong>{de ? "EU-US Data Privacy Framework (DPF):" : "EU-US Data Privacy Framework (DPF):"}</strong>{" "}
              {de
                ? "Für zertifizierte US-Anbieter (Google, OpenAI, Cloudflare, Vercel) liegt ein Angemessenheitsbeschluss der EU-Kommission vor."
                : "For certified US providers (Google, OpenAI, Cloudflare, Vercel) an adequacy decision by the EU Commission is in place."}
            </Li>
            <Li>
              <strong>{de ? "EU-Standardvertragsklauseln (SCCs):" : "EU Standard Contractual Clauses (SCCs):"}</strong>{" "}
              {de
                ? "Für nicht DPF-zertifizierte Anbieter (Anthropic, Cerebras, Resend) gelten die EU-Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO."
                : "For providers not certified under DPF (Anthropic, Cerebras, Resend), EU Standard Contractual Clauses pursuant to Art. 46(2)(c) GDPR apply."}
            </Li>
            <Li>
              <strong>{de ? "Öffentliche Blockchain:" : "Public blockchain:"}</strong>{" "}
              {de
                ? "Transaktionsdaten auf dem XRP Ledger und der XRPL EVM Sidechain sind weltweit öffentlich einsehbar und technisch unveränderlich. Vor der Nutzung der Wallet-Funktion wird darauf hingewiesen."
                : "Transaction data on the XRP Ledger and XRPL EVM Sidechain is publicly visible worldwide and technically immutable. Users are informed of this before using the wallet feature."}
            </Li>
          </ul>
        </Section>

        {/* Section 8 */}
        <Section title={de ? "8. Cookies und lokale Speicherung" : "8. Cookies and Local Storage"}>
          <p>{de ? "Wir verwenden ausschließlich technisch notwendige Cookies:" : "We use only strictly necessary cookies:"}</p>
          <ul className="flex flex-col gap-2 mt-3">
            <Li>
              <strong>next-auth.session-token:</strong>{" "}
              {de
                ? "Session-Cookie für angemeldete Nutzer (JWT). Notwendig für die Authentifizierung. Läuft nach 30 Tagen oder beim Schließen des Browsers ab."
                : "Session cookie for logged-in users (JWT). Necessary for authentication. Expires after 30 days or when the browser is closed."}
            </Li>
            <Li>
              <strong>next-auth.csrf-token:</strong>{" "}
              {de
                ? "CSRF-Schutz. Technisch notwendig für die Sicherheit von Formularen."
                : "CSRF protection. Technically necessary for form security."}
            </Li>
          </ul>
          <p className="mt-3">
            {de
              ? "Da wir ausschließlich technisch notwendige Cookies setzen, ist nach Art. 5 Abs. 3 der ePrivacy-Richtlinie keine Einwilligung erforderlich. Wir verwenden keine Analyse-, Werbe- oder Tracking-Cookies."
              : "Since we only use strictly necessary cookies, no consent is required under Art. 5(3) of the ePrivacy Directive. We do not use analytics, advertising, or tracking cookies."}
          </p>
          <p className="mt-3">
            {de
              ? "Zusätzlich speichern wir im localStorage deines Browsers: deine Cookie-Hinweis-Bestätigung sowie den internen Admin-Zugriffsschlüssel (nur für Betreiber). Diese Daten verlassen deinen Browser nicht."
              : "We also store in your browser's localStorage: your cookie notice acknowledgment and the internal admin access key (operators only). This data never leaves your browser."}
          </p>
        </Section>

        {/* Section 9 */}
        <Section title={de ? "9. Speicherdauer" : "9. Retention Periods"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Account-Daten:" : "Account data:"}</strong>{" "}
              {de
                ? "Bis zur Kontolöschung durch den Nutzer oder auf Anfrage"
                : "Until the account is deleted by the user or upon request"}
            </Li>
            <Li>
              <strong>{de ? "Vertragsdaten und Audit-Logs:" : "Contract data and audit logs:"}</strong>{" "}
              {de
                ? "7 Jahre nach Vertragsende (handelsrechtliche Aufbewahrungspflicht gem. § 257 HGB); Blockchain-Einträge sind dauerhaft und nicht löschbar"
                : "7 years after contract end (statutory retention under § 257 HGB); blockchain entries are permanent and cannot be deleted"}
            </Li>
            <Li>
              <strong>{de ? "Hochgeladene Dateien (Proofs):" : "Uploaded files (proofs):"}</strong>{" "}
              {de
                ? "Für die Dauer des Vertragsverhältnisses, danach auf Anfrage löschbar"
                : "For the duration of the contract relationship, deletable on request thereafter"}
            </Li>
            <Li>
              <strong>{de ? "Sentry Fehlerdaten:" : "Sentry error data:"}</strong>{" "}
              {de
                ? "90 Tage (Sentry-Standard für den kostenlosen Plan)"
                : "90 days (Sentry default for the free plan)"}
            </Li>
            <Li>
              <strong>{de ? "IP-Adressen (Rate Limiting):" : "IP addresses (rate limiting):"}</strong>{" "}
              {de
                ? "Nur im Arbeitsspeicher, max. 1 Stunde, nicht persistent gespeichert"
                : "In memory only, max. 1 hour, not persistently stored"}
            </Li>
          </ul>
        </Section>

        {/* Section 10 */}
        <Section title={de ? "10. Sanktionsprüfung" : "10. Sanctions Screening"}>
          <p>
            {de
              ? "Gemäß gesetzlicher Verpflichtung prüfen wir bei der Registrierung Name und optionales Geburtsdatum gegen OFAC- und EU-Sanktionslisten. Diese Prüfung ist eine rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) und kann nicht abgewählt werden. Das Ergebnis (CLEAR oder HIT) wird intern gespeichert und nicht an Dritte weitergegeben."
              : "As required by law, we screen your name and optional date of birth against OFAC and EU sanctions lists during registration. This screening is a legal obligation (Art. 6(1)(c) GDPR) and cannot be opted out of. The result (CLEAR or HIT) is stored internally and not shared with third parties."}
          </p>
        </Section>

        {/* Section 11 */}
        <Section title={de ? "11. Deine Rechte (DSGVO Art. 15–21)" : "11. Your Rights (GDPR Art. 15–21)"}>
          <ul className="flex flex-col gap-2">
            <Li>
              <strong>{de ? "Auskunft (Art. 15):" : "Access (Art. 15):"}</strong>{" "}
              {de ? "Welche Daten wir über dich gespeichert haben" : "What data we hold about you"}
            </Li>
            <Li>
              <strong>{de ? "Datenportabilität (Art. 20):" : "Data portability (Art. 20):"}</strong>{" "}
              {de
                ? "Export aller deiner Daten als JSON – verfügbar in den "
                : "Export all your data as JSON – available in "}
              <Link href="/profile" style={{ color: "#C4704B" }}>
                {de ? "Profileinstellungen" : "Profile Settings"}
              </Link>
              {de ? ' unter \u201ePrivacy & Data\u201c' : ' under "Privacy & Data"'}
            </Li>
            <Li>
              <strong>{de ? "Löschung (Art. 17):" : "Erasure (Art. 17):"}</strong>{" "}
              {de
                ? "Anonymisierung deines Kontos – verfügbar in den "
                : "Anonymization of your account – available in "}
              <Link href="/profile" style={{ color: "#C4704B" }}>
                {de ? "Profileinstellungen" : "Profile Settings"}
              </Link>
              {de
                ? ' unter \u201eDelete Account\u201c. Hinweis: Blockchain-Transaktionen sind technisch nicht löschbar.'
                : ' under "Delete Account". Note: Blockchain transactions are technically not erasable.'}
            </Li>
            <Li>
              <strong>{de ? "Berichtigung (Art. 16):" : "Rectification (Art. 16):"}</strong>{" "}
              {de
                ? "Korrektur unrichtiger Daten über die Profileinstellungen oder per E-Mail"
                : "Correction of inaccurate data via profile settings or by email"}
            </Li>
            <Li>
              <strong>{de ? "Einschränkung (Art. 18):" : "Restriction (Art. 18):"}</strong>{" "}
              {de
                ? "Einschränkung der Verarbeitung auf Antrag"
                : "Restriction of processing upon request"}
            </Li>
            <Li>
              <strong>{de ? "Widerspruch (Art. 21):" : "Objection (Art. 21):"}</strong>{" "}
              {de
                ? "Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen"
                : "Objection to processing based on legitimate interests"}
            </Li>
            <Li>
              <strong>{de ? "Widerruf der Einwilligung:" : "Withdrawal of consent:"}</strong>{" "}
              {de
                ? "Optionale E-Mail-Benachrichtigungen jederzeit in den "
                : "Optional email notifications can be disabled at any time in "}
              <Link href="/profile" style={{ color: "#C4704B" }}>
                {de ? "Profileinstellungen" : "Profile Settings"}
              </Link>
              {de ? " deaktivierbar" : ""}
            </Li>
            <Li>
              <strong>{de ? "Beschwerde (Art. 77):" : "Complaint (Art. 77):"}</strong>{" "}
              {de
                ? "Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z.B. beim "
                : "You have the right to lodge a complaint with a data protection supervisory authority, e.g. the "}
              <a href="https://www.bfdi.bund.de" target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }}>
                {de
                  ? "Bundesbeauftragten für den Datenschutz und die Informationsfreiheit (BfDI)"
                  : "Federal Commissioner for Data Protection and Freedom of Information (BfDI)"}
              </a>
            </Li>
          </ul>
          <p className="mt-3">
            {de ? "Für alle Datenschutzanfragen:" : "For all data protection requests:"}{" "}
            <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
        </Section>

        {/* Section 12 */}
        <Section title={de ? "12. Automatisierte Entscheidungsfindung" : "12. Automated Decision-Making"}>
          <p>
            {de
              ? "Die KI-gestützte Meilensteinprüfung (5-Modell-Mehrheitsvotum) hat direkte Auswirkungen auf die Freigabe oder Ablehnung von Escrow-Mitteln. Dies stellt eine automatisierte Entscheidung im Sinne von Art. 22 DSGVO dar. Du hast das Recht, eine manuelle Überprüfung durch einen Betreiber anzufordern (Widerspruch gegen automatisierte Entscheidung). Wende dich hierfür an "
              : "The AI-assisted milestone verification (5-model majority vote) directly affects the release or rejection of escrowed funds. This constitutes automated decision-making within the meaning of Art. 22 GDPR. You have the right to request a manual review by an operator (objection to automated decision). Please contact "}
            <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
            {de ? "." : " for this."}
          </p>
        </Section>

        {/* Section 13 */}
        <Section title={de ? "13. Änderungen dieser Erklärung" : "13. Changes to This Policy"}>
          <p>
            {de
              ? "Wir behalten uns vor, diese Datenschutzerklärung anzupassen. Die jeweils aktuelle Version ist unter cascrow.com/datenschutz abrufbar. Bei wesentlichen Änderungen informieren wir registrierte Nutzer per E-Mail."
              : "We reserve the right to update this privacy policy. The current version is always available at cascrow.com/datenschutz. For material changes, we will notify registered users by email."}
          </p>
        </Section>

        <div className="text-sm mt-4 pt-6" style={{ borderTop: "1px solid rgba(196,112,75,0.15)", color: "#A89B8C" }}>
          <Link href="/" style={{ color: "#C4704B" }}>
            ← {de ? "Zurück zu Cascrow" : "Back to Cascrow"}
          </Link>
        </div>
      </div>
    </main>
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
