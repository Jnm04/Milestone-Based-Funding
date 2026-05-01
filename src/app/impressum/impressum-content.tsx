"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

type Lang = "de" | "en";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold" style={{ color: "#C4704B" }}>{title}</h2>
      <div className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
        {children}
      </div>
    </div>
  );
}

export function ImpressumContent() {
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
              {de ? "Impressum" : "Legal Notice"}
            </h1>
            <p className="text-sm" style={{ color: "#A89B8C" }}>
              {de
                ? "Angaben gemäß § 5 TMG · Stand: April 2026"
                : "Information pursuant to § 5 TMG · As of: April 2026"}
            </p>
          </div>

          {/* Pre-incorporation notice */}
          <div
            className="p-4 rounded-xl text-sm leading-relaxed"
            style={{
              background: "rgba(196,112,75,0.07)",
              border: "1px solid rgba(196,112,75,0.25)",
              color: "#D4B896",
            }}
          >
            {de
              ? "Hinweis: Cascrow befindet sich im Aufbau. Die nachfolgenden Angaben beziehen sich auf den Betreiber als natürliche Person vor der Unternehmensgründung. Vollständige Handelsregister­angaben werden nach Eintragung der Gesellschaft ergänzt."
              : "Note: Cascrow is currently in pre-launch. The information below refers to the operator as a natural person prior to formal incorporation. Full company registration details will be added once the entity is registered."}
          </div>

          {/* Operator */}
          <Section title={de ? "Betreiber / Diensteanbieter" : "Operator / Service Provider"}>
            <p className="font-medium" style={{ color: "#EDE6DD" }}>Jan-Niklas Möller, Paul Wagner</p>
            <p className="mt-1" style={{ color: "#A89B8C" }}>
              {de ? "Betreiber der Plattform cascrow (cascrow.com)" : "Operator of the cascrow platform (cascrow.com)"}
            </p>
          </Section>

          {/* Address */}
          <Section title={de ? "Anschrift" : "Address"}>
            <p style={{ color: "#A89B8C" }}>
              {de
                ? "Die Anschrift wird nach Unternehmensgründung ergänzt."
                : "The address will be added after company incorporation."}
            </p>
            <p className="mt-2">
              {de ? "Kontakt:" : "Contact:"}{" "}
              <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
            </p>
          </Section>

          {/* Contact */}
          <Section title={de ? "Kontakt" : "Contact"}>
            <p>
              {de ? "E-Mail:" : "Email:"}{" "}
              <a href="mailto:hello@cascrow.com" style={{ color: "#C4704B" }}>hello@cascrow.com</a>
            </p>
            <p className="mt-1">
              {de ? "Sicherheit:" : "Security:"}{" "}
              <a href="mailto:security@cascrow.com" style={{ color: "#C4704B" }}>security@cascrow.com</a>
            </p>
          </Section>

          {/* Responsible for content */}
          <Section title={de ? "Inhaltlich Verantwortlicher gemäß § 55 Abs. 2 RStV" : "Responsible for Content pursuant to § 55 (2) RStV"}>
            <p style={{ color: "#EDE6DD" }}>Jan-Niklas Möller, Paul Wagner</p>
            <p className="mt-1">
              {de
                ? "(Anschrift wie oben — wird nach Gründung ergänzt)"
                : "(Address as above — to be updated after incorporation)"}
            </p>
          </Section>

          {/* Regulatory note */}
          <Section title={de ? "Regulatorischer Hinweis" : "Regulatory Notice"}>
            <p>
              {de
                ? "Cascrow ist kein regulierter Finanzdienstleister und keine Wertpapierfirma im Sinne der MiFID II. Die Plattform erbringt keine Finanzberatungs-, Anlage- oder Zahlungsdienstleistungen im Sinne der einschlägigen EU-Verordnungen. Die Verwaltung von Escrow-Mitteln erfolgt ausschließlich über Smart Contracts auf der XRPL EVM Sidechain ohne Zugriff durch den Plattformbetreiber."
                : "Cascrow is not a regulated financial services provider or investment firm within the meaning of MiFID II. The platform does not provide financial advisory, investment, or payment services within the meaning of applicable EU regulations. Escrow funds are managed exclusively via smart contracts on the XRPL EVM Sidechain without custody by the platform operator."}
            </p>
          </Section>

          {/* Disclaimer */}
          <Section title={de ? "Haftungsausschluss" : "Disclaimer"}>
            <p>
              {de
                ? "Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich. Alle Inhalte dieser Plattform unterliegen dem deutschen Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet."
                : "Despite careful review, we accept no liability for the content of external links. The operators of linked pages are solely responsible for their content. All content on this platform is subject to German copyright law. Third-party contributions are marked as such."}
            </p>
          </Section>

          {/* Dispute resolution */}
          <Section title={de ? "Streitbeilegung" : "Dispute Resolution"}>
            <p>
              {de
                ? "Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: "
                : "The European Commission provides a platform for online dispute resolution (ODR): "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#C4704B" }}
              >
                https://ec.europa.eu/consumers/odr
              </a>
              {de
                ? ". Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."
                : ". We are not obliged and not willing to participate in dispute resolution proceedings before a consumer arbitration board."}
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
