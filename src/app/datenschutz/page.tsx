import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung von Cascrow gemäß DSGVO",
  robots: { index: false },
};

export default function DatenschutzPage() {
  return (
    <main
      className="min-h-screen px-4 py-16"
      style={{ background: "#171311", color: "#EDE6DD" }}
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div>
          <Link href="/" className="text-sm hover:underline" style={{ color: "#C4704B" }}>
            ← Back to Cascrow
          </Link>
          <h1
            className="text-3xl mt-6 mb-2"
            style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300 }}
          >
            Datenschutzerklärung
          </h1>
          <p className="text-sm" style={{ color: "#A89B8C" }}>
            Zuletzt aktualisiert: April 2026
          </p>
        </div>

        <Section title="1. Verantwortlicher">
          <p>
            Verantwortlicher im Sinne der DSGVO ist der Betreiber dieser Plattform (cascrow.com).
            Kontakt: <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
          <p className="mt-3" style={{ color: "#A89B8C", fontSize: 13 }}>
            Hinweis: Cascrow befindet sich im Aufbau. Die vollständigen Angaben zum Verantwortlichen (Firmenname, Adresse) werden nach Gründung des Unternehmens ergänzt.
          </p>
        </Section>

        <Section title="2. Welche Daten wir erheben">
          <ul className="flex flex-col gap-2">
            <Li><strong>Account-Daten:</strong> E-Mail-Adresse (Pflicht), Name (optional), Geburtsdatum (optional – verbessert Sanktionsprüfung), XRPL-Wallet-Adresse (optional)</Li>
            <Li><strong>Profildaten:</strong> Unternehmen, Abteilung, Jobtitel, Telefon, Bio, Website (alle optional)</Li>
            <Li><strong>Sicherheitsdaten:</strong> Passwort-Hash (bcrypt, nicht reversibel), Login-Versuche, Kontosperrstatus</Li>
            <Li><strong>Vertragsdaten:</strong> Meilensteine, Beträge in USD, Fristen, Status, Einladungslinks – notwendig für die Kernfunktion der Plattform</Li>
            <Li><strong>Nachweise (Proofs):</strong> Hochgeladene PDF-Dokumente oder GitHub-Links zur Meilensteinerfüllung</Li>
            <Li><strong>Audit-Trail:</strong> Ereignisse (Vertrag erstellt, Zahlung freigegeben etc.) werden in der Datenbank sowie dauerhaft und öffentlich auf der XRP Ledger Blockchain gespeichert</Li>
            <Li><strong>Blockchain-Daten:</strong> Wallet-Adressen und Transaktionsdaten auf der XRPL EVM Sidechain (Escrow) und dem XRP Ledger Mainnet (NFT-Zertifikate, Audit-Memos) – öffentlich und unveränderlich</Li>
            <Li><strong>IP-Adresse:</strong> Temporär im Arbeitsspeicher für Rate Limiting und Sicherheitsschutz (max. 1 Stunde, nicht in der Datenbank gespeichert)</Li>
            <Li><strong>Technische Fehlerdaten:</strong> Stack Traces, Fehlermeldungen, betroffene Seiten – über Sentry erfasst, ohne personenbezogene Kontoinformationen</Li>
          </ul>
        </Section>

        <Section title="3. Zweck und Rechtsgrundlage">
          <ul className="flex flex-col gap-2">
            <Li><strong>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):</strong> E-Mail, Passwort, Vertragsdaten – notwendig zur Erbringung des Escrow-Diensts und Verwaltung des Nutzerkontos</Li>
            <Li><strong>Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO):</strong> Sanktionsprüfung gegen OFAC- und EU-Sanktionslisten; handelsrechtliche Aufbewahrung von Vertragsdaten</Li>
            <Li><strong>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO):</strong> Sicherheitsmaßnahmen (Rate Limiting, Kontosperre), Betrugserkennung, Fehlerüberwachung (Sentry), Plattformbetrieb</Li>
            <Li><strong>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO):</strong> Optionale E-Mail-Benachrichtigungen (einzeln abschaltbar in den Profileinstellungen), Telegram-Benachrichtigungen (nur bei aktiver Verknüpfung)</Li>
          </ul>
        </Section>

        <Section title="4. E-Mail-Benachrichtigungen">
          <p className="mb-3">Wir unterscheiden zwischen <strong>Pflicht-E-Mails</strong> und <strong>optionalen Benachrichtigungen</strong>:</p>

          <p className="mb-2" style={{ color: "#EDE6DD" }}>Pflicht-E-Mails (können nicht deaktiviert werden):</p>
          <ul className="flex flex-col gap-1 mb-4">
            <Li>E-Mail-Verifizierung bei Registrierung</Li>
            <Li>Passwort-Reset-Link</Li>
            <Li>Fulfillment Key bei Escrow-Abschluss (sicherheitskritisch für die Freigabe der Mittel)</Li>
          </ul>

          <p className="mb-2" style={{ color: "#EDE6DD" }}>Optionale Benachrichtigungen (einzeln abschaltbar in <Link href="/profile" style={{ color: "#C4704B" }}>Profileinstellungen → Notifications</Link>):</p>
          <ul className="flex flex-col gap-1">
            <Li>Nachweis eingereicht</Li>
            <Li>Meilenstein steht zur manuellen Prüfung an</Li>
            <Li>Meilenstein abgeschlossen und Zahlung freigegeben</Li>
            <Li>Escrow finanziert</Li>
            <Li>KI-Verifizierung erfolgreich</Li>
            <Li>KI-Verifizierung abgelehnt</Li>
          </ul>

          <p className="mt-3">
            Alle E-Mails werden über <strong>Resend</strong> (New York, USA) versendet. Rechtsgrundlage für optionale Benachrichtigungen ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit widerrufen kannst.
          </p>
        </Section>

        <Section title="5. KI-Verarbeitung">
          <p>
            Zur Überprüfung hochgeladener Nachweise nutzen wir ein Mehrheits-Votum von 5 KI-Modellen.
            Die Inhalte hochgeladener Dokumente werden an diese Dienste übermittelt.
            Personenbezogene Kontodaten (Name, E-Mail) werden <strong>nicht</strong> an KI-Anbieter übermittelt.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(196,112,75,0.2)" }}>
                  <th style={{ textAlign: "left", padding: "6px 12px 6px 0", color: "#EDE6DD" }}>Anbieter</th>
                  <th style={{ textAlign: "left", padding: "6px 12px", color: "#EDE6DD" }}>Standort</th>
                  <th style={{ textAlign: "left", padding: "6px 0 6px 12px", color: "#EDE6DD" }}>Grundlage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Anthropic (Claude)", "USA", "SCCs"],
                  ["Google (Gemini)", "USA / EU", "EU-US DPF"],
                  ["OpenAI (GPT)", "USA", "EU-US DPF"],
                  ["Mistral AI", "Frankreich (EU)", "–"],
                  ["Cerebras", "USA", "SCCs"],
                ].map(([name, loc, basis]) => (
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
            SCCs = EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) · EU-US DPF = EU-US Data Privacy Framework (Angemessenheitsbeschluss)
          </p>
        </Section>

        <Section title="6. Infrastruktur und Serverstandorte">
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(196,112,75,0.2)" }}>
                  <th style={{ textAlign: "left", padding: "6px 12px 6px 0", color: "#EDE6DD" }}>Dienst</th>
                  <th style={{ textAlign: "left", padding: "6px 12px", color: "#EDE6DD" }}>Zweck</th>
                  <th style={{ textAlign: "left", padding: "6px 12px", color: "#EDE6DD" }}>Serverstandort</th>
                  <th style={{ textAlign: "left", padding: "6px 0 6px 12px", color: "#EDE6DD" }}>Grundlage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Vercel", "Hosting, Datei-Speicher (PDFs, Zertifikate)", "USA (Edge global)", "EU-US DPF"],
                  ["Neon / Vercel Postgres", "Datenbank", "USA oder EU (je nach Konfig.)", "EU-US DPF / SCCs"],
                  ["Resend", "E-Mail-Versand", "USA", "SCCs"],
                  ["Cloudflare Turnstile", "Bot-Schutz", "Global (CDN)", "EU-US DPF"],
                  ["Sentry", "Fehlerüberwachung", "EU (Frankfurt)", "–"],
                  ["Telegram", "Optionale Benachrichtigungen", "Global", "SCCs"],
                  ["XRP Ledger Mainnet", "NFT-Zertifikate, Audit-Trail", "Dezentral, weltweit", "Öffentliche Blockchain"],
                  ["XRPL EVM Sidechain", "Escrow Smart Contract", "Dezentral, weltweit", "Öffentliche Blockchain"],
                ].map(([name, purpose, loc, basis]) => (
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

        <Section title="7. Internationale Datenübermittlung">
          <p>
            Einige der oben genannten Dienste befinden sich in den USA oder anderen Drittländern außerhalb des EWR.
            Wir stellen sicher, dass diese Übermittlungen auf Basis geeigneter Garantien nach Art. 44 ff. DSGVO erfolgen:
          </p>
          <ul className="flex flex-col gap-2 mt-3">
            <Li><strong>EU-US Data Privacy Framework (DPF):</strong> Für zertifizierte US-Anbieter (Google, OpenAI, Cloudflare, Vercel) liegt ein Angemessenheitsbeschluss der EU-Kommission vor.</Li>
            <Li><strong>EU-Standardvertragsklauseln (SCCs):</strong> Für nicht DPF-zertifizierte Anbieter (Anthropic, Cerebras, Resend) gelten die EU-Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO.</Li>
            <Li><strong>Öffentliche Blockchain:</strong> Transaktionsdaten auf dem XRP Ledger und der XRPL EVM Sidechain sind weltweit öffentlich einsehbar und technisch unveränderlich. Vor der Nutzung der Wallet-Funktion wird darauf hingewiesen.</Li>
          </ul>
        </Section>

        <Section title="8. Cookies und lokale Speicherung">
          <p>Wir verwenden ausschließlich technisch notwendige Cookies:</p>
          <ul className="flex flex-col gap-2 mt-3">
            <Li><strong>next-auth.session-token:</strong> Session-Cookie für angemeldete Nutzer (JWT). Notwendig für die Authentifizierung. Läuft nach 30 Tagen oder beim Schließen des Browsers ab.</Li>
            <Li><strong>next-auth.csrf-token:</strong> CSRF-Schutz. Technisch notwendig für die Sicherheit von Formularen.</Li>
          </ul>
          <p className="mt-3">
            Da wir ausschließlich technisch notwendige Cookies setzen, ist nach Art. 5 Abs. 3 der ePrivacy-Richtlinie keine Einwilligung erforderlich.
            Wir verwenden keine Analyse-, Werbe- oder Tracking-Cookies.
          </p>
          <p className="mt-3">
            Zusätzlich speichern wir im <strong>localStorage</strong> deines Browsers: deine Cookie-Hinweis-Bestätigung sowie den internen Admin-Zugriffsschlüssel (nur für Betreiber). Diese Daten verlassen deinen Browser nicht.
          </p>
        </Section>

        <Section title="9. Speicherdauer">
          <ul className="flex flex-col gap-2">
            <Li><strong>Account-Daten:</strong> Bis zur Kontolöschung durch den Nutzer oder auf Anfrage</Li>
            <Li><strong>Vertragsdaten und Audit-Logs:</strong> 7 Jahre nach Vertragsende (handelsrechtliche Aufbewahrungspflicht gem. § 257 HGB); Blockchain-Einträge sind dauerhaft und nicht löschbar</Li>
            <Li><strong>Hochgeladene Dateien (Proofs):</strong> Für die Dauer des Vertragsverhältnisses, danach auf Anfrage löschbar</Li>
            <Li><strong>Sentry Fehlerdaten:</strong> 90 Tage (Sentry-Standard für den kostenlosen Plan)</Li>
            <Li><strong>IP-Adressen (Rate Limiting):</strong> Nur im Arbeitsspeicher, max. 1 Stunde, nicht persistent gespeichert</Li>
          </ul>
        </Section>

        <Section title="10. Sanktionsprüfung">
          <p>
            Gemäß gesetzlicher Verpflichtung prüfen wir bei der Registrierung Name und optionales
            Geburtsdatum gegen OFAC- und EU-Sanktionslisten. Diese Prüfung ist eine rechtliche
            Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) und kann nicht abgewählt werden.
            Das Ergebnis (CLEAR oder HIT) wird intern gespeichert und nicht an Dritte weitergegeben.
          </p>
        </Section>

        <Section title="11. Deine Rechte (DSGVO Art. 15–21)">
          <ul className="flex flex-col gap-2">
            <Li><strong>Auskunft (Art. 15):</strong> Welche Daten wir über dich gespeichert haben</Li>
            <Li><strong>Datenportabilität (Art. 20):</strong> Export aller deiner Daten als JSON – verfügbar in den <Link href="/profile" style={{ color: "#C4704B" }}>Profileinstellungen</Link> unter „Privacy &amp; Data"</Li>
            <Li><strong>Löschung (Art. 17):</strong> Anonymisierung deines Kontos – verfügbar in den <Link href="/profile" style={{ color: "#C4704B" }}>Profileinstellungen</Link> unter „Delete Account". Hinweis: Blockchain-Transaktionen sind technisch nicht löschbar.</Li>
            <Li><strong>Berichtigung (Art. 16):</strong> Korrektur unrichtiger Daten über die Profileinstellungen oder per E-Mail</Li>
            <Li><strong>Einschränkung (Art. 18):</strong> Einschränkung der Verarbeitung auf Antrag</Li>
            <Li><strong>Widerspruch (Art. 21):</strong> Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen</Li>
            <Li><strong>Widerruf der Einwilligung:</strong> Optionale E-Mail-Benachrichtigungen jederzeit in den <Link href="/profile" style={{ color: "#C4704B" }}>Profileinstellungen</Link> deaktivierbar</Li>
            <Li><strong>Beschwerde (Art. 77):</strong> Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z.B. beim <a href="https://www.bfdi.bund.de" target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }}>Bundesbeauftragten für den Datenschutz und die Informationsfreiheit (BfDI)</a></Li>
          </ul>
          <p className="mt-3">
            Für alle Datenschutzanfragen: <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
        </Section>

        <Section title="12. Automatisierte Entscheidungsfindung">
          <p>
            Die KI-gestützte Meilensteinprüfung (5-Modell-Mehrheitsvotum) hat direkte Auswirkungen
            auf die Freigabe oder Ablehnung von Escrow-Mitteln. Dies stellt eine automatisierte
            Entscheidung im Sinne von Art. 22 DSGVO dar. Du hast das Recht, eine manuelle Überprüfung
            durch einen Betreiber anzufordern (Widerspruch gegen automatisierte Entscheidung).
            Wende dich hierfür an <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>.
          </p>
        </Section>

        <Section title="13. Änderungen dieser Erklärung">
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen. Die jeweils aktuelle Version
            ist unter cascrow.com/datenschutz abrufbar. Bei wesentlichen Änderungen informieren wir
            registrierte Nutzer per E-Mail.
          </p>
        </Section>

        <div className="text-sm mt-4 pt-6" style={{ borderTop: "1px solid rgba(196,112,75,0.15)", color: "#A89B8C" }}>
          <Link href="/" style={{ color: "#C4704B" }}>← Zurück zu Cascrow</Link>
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
