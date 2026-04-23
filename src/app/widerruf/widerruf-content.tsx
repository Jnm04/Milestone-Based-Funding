"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

type Lang = "de" | "en";

export function WiderrufContent() {
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
            {de ? "Widerrufsbelehrung und Widerrufsformular" : "Right of Withdrawal and Withdrawal Form"}
          </h1>
          <p className="text-sm" style={{ color: "#A89B8C" }}>
            {de
              ? "gemäß § 312g BGB i.V.m. Art. 246a EGBGB · Zuletzt aktualisiert: April 2026"
              : "pursuant to § 312g BGB in conjunction with Art. 246a EGBGB · Last updated: April 2026"}
          </p>
        </div>

        {/* Section 1 — Widerrufsbelehrung */}
        <Section title={de ? "Widerrufsbelehrung" : "Right of Withdrawal Notice"}>
          <div className="p-4 rounded-lg" style={{ background: "rgba(196,112,75,0.06)", border: "1px solid rgba(196,112,75,0.15)" }}>
            <p className="font-medium mb-3" style={{ color: "#EDE6DD" }}>
              {de ? "Widerrufsrecht" : "Right of withdrawal"}
            </p>
            <p>
              {de
                ? "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses (Registrierung und Annahme der Nutzungsbedingungen)."
                : "You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period will expire after fourteen days from the day of the conclusion of the contract (registration and acceptance of the Terms of Use)."}
            </p>
            <p className="mt-3">
              {de
                ? "Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren:"
                : "To exercise the right of withdrawal, you must inform us of your decision to withdraw from this contract by an unequivocal statement (e.g. a letter sent by post or email):"}
            </p>
            <div className="mt-3 p-3 rounded" style={{ background: "rgba(0,0,0,0.2)" }}>
              <p style={{ color: "#EDE6DD" }}>Cascrow (cascrow.com)</p>
              <p>{de ? "Kontakt:" : "Contact:"} <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a></p>
              <p className="mt-1 text-xs" style={{ color: "#6b7280" }}>
                {de
                  ? "Vollständige Anschrift wird nach Unternehmensgründung ergänzt."
                  : "Full postal address will be added after company incorporation."}
              </p>
            </div>
            <p className="mt-3">
              {de
                ? "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden."
                : "To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired."}
            </p>
          </div>
        </Section>

        {/* Section 2 — Erlöschen bei digitalen Diensten */}
        <Section title={de ? "Erlöschen des Widerrufsrechts bei digitalen Diensten" : "Loss of Withdrawal Right for Digital Services"}>
          <div className="p-4 rounded-lg" style={{ background: "rgba(196,112,75,0.06)", border: "1px solid rgba(196,112,75,0.15)" }}>
            <p className="font-medium mb-3" style={{ color: "#EDE6DD" }}>
              {de ? "Wichtiger Hinweis für Cascrow-Nutzer" : "Important notice for Cascrow users"}
            </p>
            <p>
              {de
                ? "Ihr Widerrufsrecht erlischt vorzeitig, wenn Cascrow mit der Ausführung des Dienstes begonnen hat und Sie ausdrücklich zugestimmt haben, dass Cascrow vor Ablauf der Widerrufsfrist mit der Ausführung beginnt, und Sie Ihre Kenntnis davon bestätigt haben, dass Sie Ihr Widerrufsrecht mit Beginn der Ausführung des Vertrags verlieren (§ 356 Abs. 5 BGB)."
                : "Your right of withdrawal expires early if Cascrow has begun providing the service and you have given your express consent that Cascrow begins performing the service before the end of the withdrawal period, and you have acknowledged that you will lose your right of withdrawal once Cascrow has fully performed the contract (§ 356(5) BGB)."}
            </p>
            <p className="mt-3">
              {de
                ? "Bei Cascrow gilt: Durch die Registrierung und die aktive Nutzung der Plattform (z.B. Anmeldung, Anlage eines Vertrags, Hochladen eines Nachweises) erteilen Sie diese ausdrückliche Zustimmung. Das Widerrufsrecht erlischt mit Beginn dieser Nutzungshandlung."
                : "For Cascrow: By registering and actively using the platform (e.g. logging in, creating a contract, uploading a proof), you give this express consent. The right of withdrawal expires upon commencement of this use."}
            </p>
            <p className="mt-3 font-medium" style={{ color: "#EDE6DD" }}>
              {de
                ? "Praktische Folge: Wenn Sie die Plattform aktiv genutzt haben, besteht in der Regel kein Widerrufsrecht mehr."
                : "Practical consequence: If you have actively used the platform, a right of withdrawal generally no longer exists."}
            </p>
            <p className="mt-3 text-xs" style={{ color: "#6b7280" }}>
              {de
                ? "Dieses Widerrufsrecht gilt ausschließlich für Verbraucher im Sinne des § 13 BGB (natürliche Personen, die die Plattform zu Zwecken außerhalb ihrer gewerblichen oder freiberuflichen Tätigkeit nutzen). Gewerbliche Nutzer haben kein gesetzliches Widerrufsrecht."
                : "This right of withdrawal applies exclusively to consumers within the meaning of § 13 BGB (natural persons using the platform for purposes outside their commercial or professional activity). Business users have no statutory right of withdrawal."}
            </p>
          </div>
        </Section>

        {/* Section 3 — Folgen des Widerrufs */}
        <Section title={de ? "Folgen des Widerrufs" : "Consequences of Withdrawal"}>
          <p>
            {de
              ? "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist."
              : "If you withdraw from this contract, we shall reimburse to you all payments received from you, including the costs of delivery (with the exception of the supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by us), without undue delay and in any event not later than 14 days from the day on which we are informed about your decision to withdraw from this contract."}
          </p>
          <p className="mt-3">
            {de
              ? "Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart."
              : "We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise."}
          </p>
          <p className="mt-3 text-xs" style={{ color: "#6b7280" }}>
            {de
              ? "Hinweis: Da Cascrow derzeit kostenlos ist (keine Gebühren), gibt es im Regelfall keine Zahlungen, die zurückerstattet werden könnten. Blockchain-Transaktionen (gesperrte RLUSD, Gas Fees) sind technisch nicht durch Cascrow rückholbar — dies ist eine technische Eigenschaft der Blockchain, keine Einschränkung des Widerrufsrechts durch Cascrow."
              : "Note: Since Cascrow is currently free (no fees), there are generally no payments to be refunded. Blockchain transactions (locked RLUSD, gas fees) cannot technically be recalled by Cascrow — this is a technical property of the blockchain, not a restriction of withdrawal rights by Cascrow."}
          </p>
        </Section>

        {/* Section 4 — Muster-Widerrufsformular */}
        <Section title={de ? "Muster-Widerrufsformular" : "Model Withdrawal Form"}>
          <p className="mb-4" style={{ color: "#6b7280" }}>
            {de
              ? "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)"
              : "(If you want to withdraw from the contract, please fill in this form and return it.)"}
          </p>

          <div className="p-5 rounded-lg" style={{ background: "rgba(237,230,221,0.04)", border: "1px solid rgba(196,112,75,0.2)", fontFamily: "monospace", fontSize: 13 }}>
            {de ? (
              <>
                <p style={{ color: "#EDE6DD" }}>An Cascrow (cascrow.com) / hello@cascrow.com</p>
                <p className="mt-4">Hiermit widerrufe(n) ich / wir (*) den von mir / uns (*) abgeschlossenen Vertrag über</p>
                <p className="mt-1 pl-4">☐ die Erbringung der folgenden Dienstleistung: Nutzung der Cascrow-Plattform</p>
                <p className="mt-4">Bestellt am (*): ___________________________</p>
                <p className="mt-2">Name des / der Verbraucher(s): ___________________________</p>
                <p className="mt-2">Anschrift des / der Verbraucher(s):</p>
                <p className="pl-4">___________________________</p>
                <p className="pl-4">___________________________</p>
                <p className="mt-2">E-Mail-Adresse des Kontos: ___________________________</p>
                <p className="mt-4">Unterschrift des / der Verbraucher(s)</p>
                <p>(nur bei Mitteilung auf Papier): ___________________________</p>
                <p className="mt-2">Datum: ___________________________</p>
                <p className="mt-4" style={{ color: "#6b7280" }}>(*) Unzutreffendes streichen</p>
              </>
            ) : (
              <>
                <p style={{ color: "#EDE6DD" }}>To Cascrow (cascrow.com) / hello@cascrow.com</p>
                <p className="mt-4">I / We (*) hereby give notice that I / we (*) withdraw from my / our (*) contract for</p>
                <p className="mt-1 pl-4">☐ the provision of the following service: Use of the Cascrow platform</p>
                <p className="mt-4">Ordered on (*): ___________________________</p>
                <p className="mt-2">Name of consumer(s): ___________________________</p>
                <p className="mt-2">Address of consumer(s):</p>
                <p className="pl-4">___________________________</p>
                <p className="pl-4">___________________________</p>
                <p className="mt-2">Account email address: ___________________________</p>
                <p className="mt-4">Signature of consumer(s)</p>
                <p>(only if this form is notified on paper): ___________________________</p>
                <p className="mt-2">Date: ___________________________</p>
                <p className="mt-4" style={{ color: "#6b7280" }}>(*) Delete as appropriate</p>
              </>
            )}
          </div>

          <p className="mt-4 text-xs" style={{ color: "#6b7280" }}>
            {de
              ? "Dieses Formular entspricht dem Muster-Widerrufsformular gemäß Anlage 2 zu § 356 BGB (umgesetzt aus Anhang I(B) der EU-Verbraucherrechterichtlinie 2011/83/EU). Senden Sie das ausgefüllte Formular per E-Mail an hello@cascrow.com."
              : "This form corresponds to the model withdrawal form pursuant to Annex 2 to § 356 BGB (implementing Annex I(B) of EU Consumer Rights Directive 2011/83/EU). Send the completed form by email to hello@cascrow.com."}
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
      <h2 className="text-lg font-medium" style={{ color: "#EDE6DD", fontFamily: "var(--font-libre-franklin)" }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
        {children}
      </div>
    </section>
  );
}
