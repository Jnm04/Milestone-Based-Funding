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
            Hinweis: Cascrow befindet sich im Aufbau. Die Angaben zum Verantwortlichen werden nach Gründung des Unternehmens vervollständigt.
          </p>
        </Section>

        <Section title="2. Welche Daten wir erheben">
          <ul className="flex flex-col gap-2">
            <Li><strong>Account-Daten:</strong> E-Mail-Adresse (Pflicht), Name (optional), Geburtsdatum (optional, verbessert Sanktionsprüfung), XRPL-Wallet-Adresse (optional)</Li>
            <Li><strong>Sicherheitsdaten:</strong> Passwort-Hash (bcrypt, nicht reversibel), Login-Versuche, Konto-Sperrzeit</Li>
            <Li><strong>Vertragsdaten:</strong> Meilensteine, Beträge, Fristen, Status — notwendig für die Kernfunktion der Plattform</Li>
            <Li><strong>Nachweise (Proofs):</strong> Hochgeladene PDF-Dokumente oder GitHub-Links zur Meilensteinerfüllung</Li>
            <Li><strong>Audit-Trail:</strong> Ereignisse (Vertrag erstellt, Zahlung freigegeben etc.) werden in der Datenbank und öffentlich auf der XRP Ledger Blockchain gespeichert</Li>
            <Li><strong>IP-Adresse:</strong> Temporär für Rate Limiting und Sicherheitsschutz (nicht dauerhaft gespeichert)</Li>
          </ul>
        </Section>

        <Section title="3. Zweck und Rechtsgrundlage">
          <ul className="flex flex-col gap-2">
            <Li><strong>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):</strong> E-Mail, Name, Vertragsdaten — notwendig für die Erbringung des Escrow-Diensts</Li>
            <Li><strong>Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO):</strong> Sanktionsprüfung gegen OFAC- und EU-Sanktionslisten</Li>
            <Li><strong>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO):</strong> Sicherheitsmaßnahmen (Rate Limiting, Account-Sperre), Betrugserkennung</Li>
            <Li><strong>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO):</strong> Telegram-Benachrichtigungen (nur bei aktiver Verknüpfung)</Li>
          </ul>
        </Section>

        <Section title="4. KI-Verarbeitung">
          <p>
            Zur Überprüfung hochgeladener Nachweise nutzen wir ein Mehrheits-Votum von 5 KI-Modellen
            (Anthropic Claude, Google Gemini, OpenAI GPT, Mistral, Cerebras). Die Inhalte der
            hochgeladenen Dokumente werden an diese Dienste übermittelt. Es werden keine
            personenbezogenen Kontodaten (Name, E-Mail) an die KI-Anbieter übermittelt.
          </p>
          <p className="mt-3">KI-Anbieter und deren Datenschutz:</p>
          <ul className="flex flex-col gap-1 mt-1">
            <Li>Anthropic (USA) — <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }}>Privacy Policy</a></Li>
            <Li>Google (USA) — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }}>Privacy Policy</a></Li>
            <Li>OpenAI (USA) — <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }}>Privacy Policy</a></Li>
            <Li>Mistral AI (Frankreich) — <a href="https://mistral.ai/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }}>Privacy Policy</a></Li>
            <Li>Cerebras (USA) — <a href="https://cerebras.ai/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }}>Privacy Policy</a></Li>
          </ul>
        </Section>

        <Section title="5. Drittanbieter und Datenübermittlung">
          <ul className="flex flex-col gap-2">
            <Li><strong>Vercel (USA):</strong> Hosting der Plattform und Dateispeicherung (PDFs, Zertifikate). Vercel ist nach EU-US Data Privacy Framework zertifiziert.</Li>
            <Li><strong>Cloudflare Turnstile (USA):</strong> Bot-Schutz bei Registrierung und Passwort-Reset. Verarbeitung: IP-Adresse, Browser-Fingerprint. <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" style={{ color: "#C4704B" }}>Cloudflare Privacy Policy</a></Li>
            <Li><strong>SMTP-E-Mail-Provider:</strong> Versand von Verifikations- und Benachrichtigungs-E-Mails (E-Mail-Adresse)</Li>
            <Li><strong>Telegram (optional):</strong> Benachrichtigungen bei Vertragsaktivitäten, nur bei aktiver Verknüpfung</Li>
            <Li><strong>XRP Ledger (öffentliche Blockchain):</strong> Audit-Trail-Einträge und NFT-Zertifikate werden dauerhaft und öffentlich auf der XRP Ledger Mainnet gespeichert. Diese Daten sind unveränderlich und weltweit einsehbar.</Li>
            <Li><strong>XRPL EVM Sidechain:</strong> Smart-Contract-Transaktionen für die Escrow-Funktion (Wallet-Adresse, Beträge)</Li>
            <Li><strong>Sentry (USA):</strong> Fehlerüberwachung für den Betrieb der Plattform. Es werden technische Fehlerdaten ohne personenbezogene Kontoinformationen übermittelt.</Li>
          </ul>
        </Section>

        <Section title="6. Cookies und lokale Speicherung">
          <p>Wir verwenden ausschließlich technisch notwendige Cookies:</p>
          <ul className="flex flex-col gap-2 mt-3">
            <Li><strong>next-auth.session-token:</strong> Session-Cookie für angemeldete Nutzer (JWT). Notwendig für die Authentifizierung. Läuft mit der Browser-Session oder nach 30 Tagen ab.</Li>
            <Li><strong>next-auth.csrf-token:</strong> CSRF-Schutz (Cross-Site-Request-Forgery). Technisch notwendig.</Li>
          </ul>
          <p className="mt-3">
            Da wir ausschließlich technisch notwendige Cookies verwenden, ist nach Art. 5 Abs. 3 ePrivacy-Richtlinie keine Einwilligung erforderlich. Wir nutzen keine Analyse-, Werbe- oder Tracking-Cookies.
          </p>
        </Section>

        <Section title="7. Speicherdauer">
          <ul className="flex flex-col gap-2">
            <Li><strong>Account-Daten:</strong> Bis zur Kontolöschung durch den Nutzer</Li>
            <Li><strong>Vertragsdaten und Audit-Logs:</strong> 7 Jahre (handelsrechtliche Aufbewahrungspflicht) nach Vertragsende; Blockchain-Einträge sind dauerhaft</Li>
            <Li><strong>Hochgeladene Dateien (Proofs):</strong> Für die Dauer des Vertragsverhältnisses, danach auf Anfrage löschbar</Li>
            <Li><strong>IP-Adressen (Rate Limiting):</strong> Im Arbeitsspeicher, max. 1 Stunde</Li>
          </ul>
        </Section>

        <Section title="8. Deine Rechte (DSGVO Art. 15–21)">
          <ul className="flex flex-col gap-2">
            <Li><strong>Auskunft (Art. 15):</strong> Welche Daten wir über dich gespeichert haben</Li>
            <Li><strong>Datenportabilität (Art. 20):</strong> Export aller deiner Daten als JSON — verfügbar in den <Link href="/profile" style={{ color: "#C4704B" }}>Profileinstellungen</Link> unter „Privacy & Data"</Li>
            <Li><strong>Löschung (Art. 17):</strong> Anonymisierung deines Kontos — verfügbar in den <Link href="/profile" style={{ color: "#C4704B" }}>Profileinstellungen</Link> unter „Delete Account". Hinweis: Blockchain-Transaktionen sind technisch nicht löschbar.</Li>
            <Li><strong>Berichtigung (Art. 16):</strong> Korrektur unrichtiger Daten — via Profileinstellungen oder per E-Mail</Li>
            <Li><strong>Widerspruch (Art. 21):</strong> Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen</Li>
            <Li><strong>Beschwerde:</strong> Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z.B. beim Bundesbeauftragten für den Datenschutz und die Informationsfreiheit (BfDI)</Li>
          </ul>
          <p className="mt-3">
            Für Anfragen zu deinen Datenschutzrechten: <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
        </Section>

        <Section title="9. Sanktionsprüfung">
          <p>
            Gemäß gesetzlicher Verpflichtung prüfen wir bei der Registrierung Name und optionales
            Geburtsdatum gegen OFAC- und EU-Sanktionslisten. Diese Prüfung ist eine rechtliche
            Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) und kann nicht abgewählt werden.
          </p>
        </Section>

        <Section title="10. Änderungen dieser Erklärung">
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
