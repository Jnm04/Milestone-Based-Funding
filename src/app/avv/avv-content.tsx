"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

type Lang = "de" | "en";

export function AvvContent() {
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
            {de
              ? "Auftragsverarbeitungsvertrag (AVV)"
              : "Data Processing Agreement (DPA)"}
          </h1>
          <p className="text-sm" style={{ color: "#A89B8C" }}>
            {de
              ? "gemäß Art. 28 DSGVO · Zuletzt aktualisiert: April 2026"
              : "pursuant to Art. 28 GDPR · Last updated: April 2026"}
          </p>

          <div className="mt-4 p-4 rounded-lg text-sm" style={{ background: "rgba(196,112,75,0.08)", border: "1px solid rgba(196,112,75,0.2)", color: "#A89B8C" }}>
            {de
              ? "Dieser AVV gilt automatisch für alle gewerblichen Nutzer, die Enterprise-Funktionen von Cascrow (CSRD-Reporting, Materialitätsanalyse, geteilte Konsensmechanismen) nutzen. Durch die Nutzung dieser Funktionen stimmen Sie diesen Bedingungen als Verantwortlicher im Sinne der DSGVO zu."
              : "This DPA applies automatically to all business users who use Cascrow's enterprise features (CSRD reporting, materiality analysis, shared consensus mechanisms). By using these features, you agree to these terms as a controller under the GDPR."}
          </div>
        </div>

        {/* Section 1 */}
        <Section title={de ? "1. Gegenstand und Dauer" : "1. Subject Matter and Duration"}>
          <p>
            {de
              ? "Dieser Auftragsverarbeitungsvertrag (AVV) regelt die Verarbeitung personenbezogener Daten durch Cascrow (cascrow.com) im Auftrag gewerblicher Kunden (Verantwortliche) im Rahmen der Nutzung der Enterprise-Dienste der Plattform."
              : "This Data Processing Agreement (DPA) governs the processing of personal data by Cascrow (cascrow.com) on behalf of business customers (controllers) in connection with their use of the platform's enterprise services."}
          </p>
          <p className="mt-3">
            {de
              ? "Die Laufzeit dieses AVV entspricht der Laufzeit des zugrundeliegenden Nutzungsverhältnisses (Nutzungsbedingungen unter cascrow.com/terms). Er endet automatisch mit Beendigung des Nutzungsverhältnisses."
              : "The term of this DPA corresponds to the term of the underlying usage relationship (Terms of Use at cascrow.com/terms). It ends automatically upon termination of the usage relationship."}
          </p>
        </Section>

        {/* Section 2 */}
        <Section title={de ? "2. Art, Zweck und Umfang der Verarbeitung" : "2. Nature, Purpose, and Scope of Processing"}>
          <p className="mb-3">
            {de ? "Cascrow verarbeitet personenbezogene Daten in folgendem Umfang:" : "Cascrow processes personal data to the following extent:"}
          </p>
          <ul className="flex flex-col gap-3">
            <Li>
              <strong>{de ? "Art der Verarbeitung:" : "Nature of processing:"}</strong>{" "}
              {de
                ? "Erhebung, Speicherung, Übermittlung, Analyse und Löschung personenbezogener Daten im Rahmen der Plattformnutzung; KI-gestützte Auswertung hochgeladener Dokumente"
                : "Collection, storage, transmission, analysis, and deletion of personal data in connection with platform use; AI-assisted evaluation of uploaded documents"}
            </Li>
            <Li>
              <strong>{de ? "Zweck:" : "Purpose:"}</strong>{" "}
              {de
                ? "Betrieb der Escrow-Plattform; KI-Verifikation von Meilenstein-Nachweisen; CSRD/ESG-Reporting und Materialitätsanalyse; Erstellung von XBRL-Berichten; Konsens-Abstimmungen"
                : "Operating the escrow platform; AI verification of milestone proofs; CSRD/ESG reporting and materiality analysis; XBRL report generation; consensus voting"}
            </Li>
            <Li>
              <strong>{de ? "Kategorien personenbezogener Daten:" : "Categories of personal data:"}</strong>{" "}
              {de
                ? "Namen, E-Mail-Adressen, Berufsbezeichnungen, Unternehmensangaben sowie sonstige personenbezogene Daten, die in hochgeladenen Dokumenten (PDFs, Nachweisen) oder bei der Nutzung der Enterprise-Funktionen enthalten sind"
                : "Names, email addresses, job titles, company information, and other personal data contained in uploaded documents (PDFs, proofs) or provided when using enterprise features"}
            </Li>
            <Li>
              <strong>{de ? "Kategorien betroffener Personen:" : "Categories of data subjects:"}</strong>{" "}
              {de
                ? "Mitarbeiter des Verantwortlichen; Stakeholder und Dritte, deren Daten in hochgeladenen Dokumenten erscheinen; Vertragsparteien der Escrow-Verträge; externe Prüfer und Regulatoren (Konsens-Abstimmungen)"
                : "Employees of the controller; stakeholders and third parties whose data appears in uploaded documents; parties to escrow contracts; external auditors and regulators (consensus voting)"}
            </Li>
          </ul>
        </Section>

        {/* Section 3 */}
        <Section title={de ? "3. Pflichten von Cascrow als Auftragsverarbeiter" : "3. Obligations of Cascrow as Processor"}>
          <p className="mb-3">
            {de ? "Cascrow verpflichtet sich gegenüber dem Verantwortlichen zu folgendem:" : "Cascrow undertakes the following vis-à-vis the controller:"}
          </p>
          <ul className="flex flex-col gap-3">
            <Li>
              <strong>{de ? "Weisungsgebundenheit (Art. 28 Abs. 3 lit. a DSGVO):" : "Processing on instructions (Art. 28(3)(a) GDPR):"}</strong>{" "}
              {de
                ? "Personenbezogene Daten werden ausschließlich auf dokumentierte Weisung des Verantwortlichen verarbeitet. Abweichungen sind nur zulässig, soweit das Unionsrecht oder das Recht eines Mitgliedstaats dies verlangt."
                : "Personal data is processed only on documented instructions from the controller. Deviations are only permissible where required by Union law or the law of a Member State."}
            </Li>
            <Li>
              <strong>{de ? "Vertraulichkeit (Art. 28 Abs. 3 lit. b DSGVO):" : "Confidentiality (Art. 28(3)(b) GDPR):"}</strong>{" "}
              {de
                ? "Alle zur Verarbeitung befugten Personen wurden zur Vertraulichkeit verpflichtet oder unterliegen einer gesetzlichen Verschwiegenheitspflicht."
                : "All persons authorised to process the data are subject to confidentiality obligations or are under an appropriate statutory obligation of confidentiality."}
            </Li>
            <Li>
              <strong>{de ? "Technisch-organisatorische Maßnahmen (Art. 28 Abs. 3 lit. c DSGVO):" : "Technical and organisational measures (Art. 28(3)(c) GDPR):"}</strong>{" "}
              {de
                ? "Cascrow ergreift alle nach Art. 32 DSGVO erforderlichen Maßnahmen. Die konkret umgesetzten TOMs sind in Abschnitt 8 dieses AVV aufgeführt."
                : "Cascrow implements all measures required under Art. 32 GDPR. The specific TOMs implemented are listed in Section 8 of this DPA."}
            </Li>
            <Li>
              <strong>{de ? "Unterauftragsverarbeiter (Art. 28 Abs. 3 lit. d DSGVO):" : "Sub-processors (Art. 28(3)(d) GDPR):"}</strong>{" "}
              {de
                ? "Weitere Auftragsverarbeiter werden nur gemäß Abschnitt 5 dieses AVV eingesetzt."
                : "Sub-processors are only engaged in accordance with Section 5 of this DPA."}
            </Li>
            <Li>
              <strong>{de ? "Unterstützung bei Betroffenenrechten (Art. 28 Abs. 3 lit. e DSGVO):" : "Assistance with data subject rights (Art. 28(3)(e) GDPR):"}</strong>{" "}
              {de
                ? "Cascrow unterstützt den Verantwortlichen durch geeignete technische und organisatorische Maßnahmen bei der Erfüllung seiner Pflichten gegenüber betroffenen Personen (Auskunft, Berichtigung, Löschung, Einschränkung, Portabilität, Widerspruch)."
                : "Cascrow assists the controller through appropriate technical and organisational measures in fulfilling its obligations towards data subjects (access, rectification, erasure, restriction, portability, objection)."}
            </Li>
            <Li>
              <strong>{de ? "Unterstützung bei Sicherheit und Datenschutz-Folgenabschätzung (Art. 28 Abs. 3 lit. f DSGVO):" : "Assistance with security and DPIAs (Art. 28(3)(f) GDPR):"}</strong>{" "}
              {de
                ? "Cascrow unterstützt den Verantwortlichen bei der Einhaltung von Art. 32–36 DSGVO (Sicherheit der Verarbeitung, Meldung von Verletzungen, Datenschutz-Folgenabschätzung, vorherige Konsultation)."
                : "Cascrow assists the controller in complying with Arts. 32–36 GDPR (security of processing, breach notification, data protection impact assessments, prior consultation)."}
            </Li>
            <Li>
              <strong>{de ? "Löschung oder Rückgabe (Art. 28 Abs. 3 lit. g DSGVO):" : "Deletion or return (Art. 28(3)(g) GDPR):"}</strong>{" "}
              {de
                ? "Nach Abschluss der Auftragsverarbeitung werden alle personenbezogenen Daten nach Wahl des Verantwortlichen gelöscht oder zurückgegeben, sofern keine gesetzliche Aufbewahrungspflicht besteht."
                : "Upon completion of the processing services, all personal data shall, at the controller's choice, be deleted or returned, unless there is a statutory storage obligation."}
            </Li>
            <Li>
              <strong>{de ? "Nachweis und Audit (Art. 28 Abs. 3 lit. h DSGVO):" : "Verification and audits (Art. 28(3)(h) GDPR):"}</strong>{" "}
              {de
                ? "Cascrow stellt dem Verantwortlichen alle erforderlichen Informationen zur Verfügung und ermöglicht Überprüfungen einschließlich Inspektionen. Vorabankündigung mindestens 4 Wochen, Eigenaufwand des Verantwortlichen."
                : "Cascrow makes available to the controller all information necessary to demonstrate compliance and allows for and contributes to audits and inspections. Minimum 4 weeks prior notice; the controller bears its own costs."}
            </Li>
          </ul>
        </Section>

        {/* Section 4 */}
        <Section title={de ? "4. Pflichten des Verantwortlichen" : "4. Obligations of the Controller"}>
          <ul className="flex flex-col gap-2">
            <Li>
              {de
                ? "Der Verantwortliche stellt sicher, dass eine Rechtsgrundlage für die Verarbeitung der personenbezogenen Daten besteht."
                : "The controller ensures that a legal basis exists for the processing of personal data."}
            </Li>
            <Li>
              {de
                ? "Der Verantwortliche informiert Cascrow unverzüglich, wenn er Fehler oder Unregelmäßigkeiten bei der Verarbeitung personenbezogener Daten feststellt."
                : "The controller notifies Cascrow without undue delay if it identifies errors or irregularities in the processing of personal data."}
            </Li>
            <Li>
              {de
                ? "Weisungen werden schriftlich (einschließlich E-Mail) erteilt. Mündliche Weisungen sind unverzüglich schriftlich zu bestätigen."
                : "Instructions are issued in writing (including email). Verbal instructions must be confirmed in writing without undue delay."}
            </Li>
            <Li>
              {de
                ? "Der Verantwortliche hat zu prüfen, ob hochgeladene Dokumente personenbezogene Daten Dritter enthalten, und stellt sicher, dass er berechtigt ist, diese auf die Plattform hochzuladen."
                : "The controller must verify whether uploaded documents contain personal data of third parties and ensures that it is authorised to upload such data to the platform."}
            </Li>
          </ul>
        </Section>

        {/* Section 5 */}
        <Section title={de ? "5. Unterauftragsverarbeiter" : "5. Sub-Processors"}>
          <p className="mb-3">
            {de
              ? "Der Verantwortliche erteilt hiermit eine allgemeine Genehmigung für den Einsatz der nachfolgend aufgeführten Unterauftragsverarbeiter. Cascrow informiert den Verantwortlichen über beabsichtigte Änderungen (Hinzufügen oder Ersetzen von Unterauftragsverarbeitern) mit einer Vorauffrist von mindestens 30 Tagen. Der Verantwortliche kann Änderungen aus datenschutzrechtlichen Gründen innerhalb dieser Frist schriftlich widersprechen."
              : "The controller hereby grants general authorisation for the use of the sub-processors listed below. Cascrow will inform the controller of any intended changes (adding or replacing sub-processors) with at least 30 days' prior notice. The controller may object to changes on data protection grounds in writing within this period."}
          </p>
          <div className="overflow-x-auto mt-3">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(196,112,75,0.2)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px 6px 0", color: "#EDE6DD" }}>{de ? "Anbieter" : "Provider"}</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#EDE6DD" }}>{de ? "Zweck" : "Purpose"}</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "#EDE6DD" }}>{de ? "Standort" : "Location"}</th>
                  <th style={{ textAlign: "left", padding: "6px 0 6px 8px", color: "#EDE6DD" }}>{de ? "Grundlage" : "Basis"}</th>
                </tr>
              </thead>
              <tbody>
                {(de ? [
                  ["Vercel Inc.", "Hosting, serverlose Funktionen, Dateispeicher", "USA", "EU-US DPF"],
                  ["Neon Inc. (Vercel Postgres)", "Datenbank", "USA / EU", "EU-US DPF / SCCs"],
                  ["Anthropic PBC", "KI-Verifikation (Claude)", "USA", "SCCs"],
                  ["Google LLC", "KI-Verifikation (Gemini), CSRD-Analyse", "USA / EU", "EU-US DPF"],
                  ["OpenAI LLC", "KI-Verifikation (GPT)", "USA", "EU-US DPF"],
                  ["Mistral AI SAS", "KI-Verifikation (Mistral)", "Frankreich (EU)", "–"],
                  ["Cerebras Systems Inc.", "KI-Verifikation (Qwen/Cerebras)", "USA", "SCCs"],
                  ["Vercel Blob", "Dokumentenspeicher (PDFs, Zertifikate)", "USA", "EU-US DPF"],
                  ["Sentry (Functional Software)", "Fehlerüberwachung", "USA / EU", "SCCs"],
                  ["PostHog Inc.", "Produktanalyse (pseudonym, EU-Region)", "EU (Frankfurt)", "–"],
                ] : [
                  ["Vercel Inc.", "Hosting, serverless functions, file storage", "USA", "EU-US DPF"],
                  ["Neon Inc. (Vercel Postgres)", "Database", "USA / EU", "EU-US DPF / SCCs"],
                  ["Anthropic PBC", "AI verification (Claude)", "USA", "SCCs"],
                  ["Google LLC", "AI verification (Gemini), CSRD analysis", "USA / EU", "EU-US DPF"],
                  ["OpenAI LLC", "AI verification (GPT)", "USA", "EU-US DPF"],
                  ["Mistral AI SAS", "AI verification (Mistral)", "France (EU)", "–"],
                  ["Cerebras Systems Inc.", "AI verification (Qwen/Cerebras)", "USA", "SCCs"],
                  ["Vercel Blob", "Document storage (PDFs, certificates)", "USA", "EU-US DPF"],
                  ["Sentry (Functional Software)", "Error monitoring", "USA / EU", "SCCs"],
                  ["PostHog Inc.", "Product analytics (pseudonymous, EU region)", "EU (Frankfurt)", "–"],
                ]).map(([name, purpose, loc, basis]) => (
                  <tr key={name} style={{ borderBottom: "1px solid rgba(196,112,75,0.08)" }}>
                    <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap" }}>{name}</td>
                    <td style={{ padding: "6px 8px" }}>{purpose}</td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{loc}</td>
                    <td style={{ padding: "6px 0 6px 8px", whiteSpace: "nowrap" }}>{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs" style={{ color: "#6b7280" }}>
            {de
              ? "SCCs = EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) · EU-US DPF = EU-US Data Privacy Framework"
              : "SCCs = EU Standard Contractual Clauses (Art. 46(2)(c) GDPR) · EU-US DPF = EU-US Data Privacy Framework"}
          </p>
        </Section>

        {/* Section 6 */}
        <Section title={de ? "6. Datenpannenmeldung" : "6. Personal Data Breach Notification"}>
          <p>
            {de
              ? "Cascrow meldet dem Verantwortlichen jede Verletzung des Schutzes personenbezogener Daten (Art. 4 Nr. 12 DSGVO) unverzüglich, spätestens innerhalb von 72 Stunden nach Bekanntwerden. Die Meldung erfolgt per E-Mail an die im Konto hinterlegte Adresse und enthält mindestens:"
              : "Cascrow notifies the controller of any personal data breach (Art. 4(12) GDPR) without undue delay and at the latest within 72 hours of becoming aware of it. Notification is made by email to the address registered in the account and contains at least:"}
          </p>
          <ul className="flex flex-col gap-2 mt-3">
            <Li>{de ? "Art der Datenpanne und betroffene Datenkategorien" : "Nature of the breach and categories of data affected"}</Li>
            <Li>{de ? "Ungefähre Anzahl betroffener Personen und Datensätze" : "Approximate number of data subjects and records affected"}</Li>
            <Li>{de ? "Name und Kontaktdaten des Ansprechpartners" : "Name and contact details of the point of contact"}</Li>
            <Li>{de ? "Wahrscheinliche Folgen der Verletzung" : "Likely consequences of the breach"}</Li>
            <Li>{de ? "Ergriffene und vorgeschlagene Maßnahmen zur Behebung" : "Measures taken and proposed to address the breach"}</Li>
          </ul>
        </Section>

        {/* Section 7 */}
        <Section title={de ? "7. Löschung und Rückgabe von Daten" : "7. Deletion and Return of Data"}>
          <p>
            {de
              ? "Nach Beendigung des Nutzungsverhältnisses löscht Cascrow alle personenbezogenen Daten des Verantwortlichen innerhalb von 30 Tagen, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Gesetzliche Aufbewahrungsfristen (z.B. 7 Jahre für Vertragsdaten gem. § 257 HGB) bleiben unberührt."
              : "Upon termination of the usage relationship, Cascrow deletes all of the controller's personal data within 30 days, unless statutory retention obligations prevent this. Statutory retention periods (e.g. 7 years for contract data under § 257 HGB) remain unaffected."}
          </p>
          <p className="mt-3">
            {de
              ? "Auf ausdrückliche Anfrage stellt Cascrow eine Kopie der gespeicherten Daten vor der Löschung in maschinenlesbarem Format (JSON/CSV) zur Verfügung. Daten, die auf öffentlichen Blockchains gespeichert wurden, können technisch nicht gelöscht werden."
              : "Upon explicit request, Cascrow provides a copy of the stored data in machine-readable format (JSON/CSV) prior to deletion. Data stored on public blockchains cannot technically be deleted."}
          </p>
        </Section>

        {/* Section 8 */}
        <Section title={de ? "8. Technisch-organisatorische Maßnahmen (TOMs)" : "8. Technical and Organisational Measures (TOMs)"}>
          <p className="mb-3">
            {de ? "Cascrow hat folgende TOMs gemäß Art. 32 DSGVO umgesetzt:" : "Cascrow has implemented the following TOMs pursuant to Art. 32 GDPR:"}
          </p>
          <ul className="flex flex-col gap-3">
            <Li>
              <strong>{de ? "Zugangskontrolle:" : "Access control:"}</strong>{" "}
              {de
                ? "E-Mail + Passwort-Authentifizierung (bcrypt-Hash, nicht reversibel); JWT-Sessions (NextAuth); automatische Kontosperrung nach 5 Fehlversuchen; getrennte Rollen (Investor/Startup/Admin)"
                : "Email + password authentication (bcrypt hash, irreversible); JWT sessions (NextAuth); automatic account lockout after 5 failed attempts; separate roles (Investor/Startup/Admin)"}
            </Li>
            <Li>
              <strong>{de ? "Zugriffskontrolle:" : "Authorisation control:"}</strong>{" "}
              {de
                ? "Server-seitige Session-Prüfung bei jedem API-Aufruf; Nutzer können nur auf eigene Vertragsdaten zugreifen; Admin-Bereich durch separaten Secret geschützt"
                : "Server-side session validation on every API call; users can only access their own contract data; admin area protected by a separate secret"}
            </Li>
            <Li>
              <strong>{de ? "Übertragungssicherheit:" : "Transfer security:"}</strong>{" "}
              {de
                ? "TLS 1.2+ für alle Verbindungen (HTTPS erzwungen); sichere E-Mail-Übertragung via Resend (TLS)"
                : "TLS 1.2+ for all connections (HTTPS enforced); secure email transmission via Resend (TLS)"}
            </Li>
            <Li>
              <strong>{de ? "Pseudonymisierung:" : "Pseudonymisation:"}</strong>{" "}
              {de
                ? "Interne UUIDs als User-IDs in Logs und Analytics; keine Klarnamen oder E-Mail-Adressen in Fehler-Reports (Sentry)"
                : "Internal UUIDs as user IDs in logs and analytics; no real names or email addresses in error reports (Sentry)"}
            </Li>
            <Li>
              <strong>{de ? "Eingabevalidierung:" : "Input validation:"}</strong>{" "}
              {de
                ? "Zod-Schema-Validierung aller API-Eingaben; parametrisierte Datenbankabfragen (Prisma ORM) verhindert SQL-Injection; Rate Limiting via Upstash Redis"
                : "Zod schema validation of all API inputs; parameterised database queries (Prisma ORM) prevent SQL injection; rate limiting via Upstash Redis"}
            </Li>
            <Li>
              <strong>{de ? "Verfügbarkeit:" : "Availability:"}</strong>{" "}
              {de
                ? "Hosting auf Vercel Edge Network mit automatischem Failover; Managed PostgreSQL mit automatischen Backups; Fehlerüberwachung mit Sentry (EU-Region)"
                : "Hosting on Vercel Edge Network with automatic failover; managed PostgreSQL with automated backups; error monitoring with Sentry (EU region)"}
            </Li>
            <Li>
              <strong>{de ? "Unveränderlicher Prüfpfad:" : "Immutable audit trail:"}</strong>{" "}
              {de
                ? "Kritische Ereignisse werden auf der XRP Ledger Blockchain und der XRPL EVM Sidechain unveränderlich protokolliert"
                : "Critical events are immutably logged on the XRP Ledger blockchain and XRPL EVM Sidechain"}
            </Li>
            <Li>
              <strong>{de ? "Sicherheitsüberprüfungen:" : "Security reviews:"}</strong>{" "}
              {de
                ? "Regelmäßige Dependency-Updates; npm audit als Teil des Entwicklungsprozesses; Rate Limiting an allen öffentlichen API-Endpunkten"
                : "Regular dependency updates; npm audit as part of the development process; rate limiting on all public API endpoints"}
            </Li>
          </ul>
        </Section>

        {/* Section 9 */}
        <Section title={de ? "9. Haftung" : "9. Liability"}>
          <p>
            {de
              ? "Die Haftungsregelung der Nutzungsbedingungen (cascrow.com/terms) gilt ergänzend zu diesem AVV. Im Verhältnis zwischen Verantwortlichem und Auftragsverarbeiter gilt: Cascrow haftet nur für Schäden, die auf einen nachweislichen Verstoß gegen die in diesem AVV festgelegten Pflichten zurückzuführen sind."
              : "The liability provisions of the Terms of Use (cascrow.com/terms) apply in addition to this DPA. In the relationship between controller and processor: Cascrow is only liable for damages attributable to a demonstrable breach of the obligations set out in this DPA."}
          </p>
          <p className="mt-3">
            {de
              ? "Im Außenverhältnis zu betroffenen Personen haften Verantwortlicher und Auftragsverarbeiter gesamtschuldnerisch (Art. 82 Abs. 4 DSGVO). Im Innenverhältnis ist Cascrow von der Haftung befreit, sofern nachgewiesen werden kann, dass Cascrow für den schadensverursachenden Umstand nicht verantwortlich ist (Art. 82 Abs. 3 DSGVO)."
              : "In the external relationship with data subjects, the controller and processor are jointly and severally liable (Art. 82(4) GDPR). In the internal relationship, Cascrow is exempt from liability if it can be proven that Cascrow is not responsible for the event giving rise to the damage (Art. 82(3) GDPR)."}
          </p>
        </Section>

        {/* Section 10 */}
        <Section title={de ? "10. Schlussbestimmungen" : "10. Final Provisions"}>
          <ul className="flex flex-col gap-2">
            <Li>
              {de
                ? "Dieser AVV hat im Falle von Widersprüchen Vorrang gegenüber den allgemeinen Nutzungsbedingungen, soweit es um datenschutzrechtliche Pflichten geht."
                : "This DPA takes precedence over the general Terms of Use in the event of conflicts, insofar as data protection obligations are concerned."}
            </Li>
            <Li>
              {de
                ? "Es gilt deutsches Recht. Gerichtsstand ist der Sitz des Betreibers von Cascrow."
                : "German law applies. The place of jurisdiction is the registered office of the Cascrow operator."}
            </Li>
            <Li>
              {de
                ? "Sollten einzelne Bestimmungen dieses AVV unwirksam sein, bleibt der Rest des AVV wirksam."
                : "Should individual provisions of this DPA be invalid, the remainder of the DPA remains valid."}
            </Li>
            <Li>
              {de
                ? "Änderungen dieses AVV werden dem Verantwortlichen mindestens 30 Tage vor Inkrafttreten per E-Mail mitgeteilt."
                : "Amendments to this DPA will be communicated to the controller by email at least 30 days before they take effect."}
            </Li>
          </ul>
          <p className="mt-4">
            {de ? "Kontakt für Datenschutzanfragen:" : "Contact for data protection enquiries:"}{" "}
            <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
          </p>
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
