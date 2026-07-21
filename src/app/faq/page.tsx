"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowLeft } from "lucide-react";
import { BlackMariaStrip } from "@/components/BlackMariaLogo";

// FAQ-ul echipei (cerut după primul test live, 17.07.2026): întrebările reale
// din grupul de WhatsApp, cu răspunsurile canonice. Public — nu cere cont.
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Nu văd proiectul / campania colegului. De ce?",
    a: (
      <>
        Ești în alt <b>workspace</b>. Campaniile trăiesc într-un workspace, iar
        la înregistrare fiecare își creează din greșeală unul propriu. Două
        rezolvări: (1) dacă ai fost deja invitat, schimbă workspace-ul din{" "}
        <b>colțul stânga-sus</b> — click pe numele de lângă logo și alege
        workspace-ul echipei; (2) dacă nu apare în listă, nu ai fost invitat
        încă — cere-i owner-ului un link de invitație (vezi mai jos).
      </>
    ),
  },
  {
    q: "Cum bag pe cineva în proiect? Intră el și eu îi dau accept?",
    a: (
      <>
        Invers: <b>tu îl inviți, el intră automat</b> — nu există pas de
        „accept". Din workspace-ul echipei: <b>Team → Invite member</b> → alegi
        rolul → se generează un <b>link de invitație</b> → i-l trimiți pe
        WhatsApp. El îl deschide logat cu contul lui și intră direct în
        workspace, unde vede toate campaniile.
      </>
    ),
  },
  {
    q: "Ce e link-ul de „share”? E pentru colegi?",
    a: (
      <>
        Nu — share-ul e pentru <b>client / oameni din afară, fără cont</b>: văd
        cut-ul, comentează pe timecode și dau Approve / Request changes, atât.
        Colegii de echipă intră cu <b>invitație</b> (întrebarea de mai sus), nu
        cu link de share.
      </>
    ),
  },
  {
    q: "Cum dăm feedback coerent, toți în același loc?",
    a: (
      <>
        Toți membrii aceluiași workspace văd aceleași campanii. Deschizi
        asset-ul (cut-ul), pui pauză pe cadrul cu problema și scrii comentariul
        — <b>timecode-ul se atașează automat</b> și oricine dă click pe el sare
        exact la acel moment. Poți și <b>desena pe cadru</b> (creionul de lângă
        composer). Discuțiile libere merg în chat (colțul dreapta-jos), dar
        feedback-ul pe imagine stă pe asset, ca să rămână legat de cadru.
      </>
    ),
  },
  {
    q: "Cum funcționează chat-ul cu roșu și bife?",
    a: (
      <>
        Mesajele obișnuite se marchează citite singure când le vezi. Doar
        mesajele care <b>te @menționează</b> rămân <b>roșii</b> până apeși tu
        „citește" — asta e confirmarea că nota a ajuns la omul potrivit. Scrii{" "}
        <b>@</b> și alegi destinatarul (Tab completează primul); poza lui apare
        pe fundal ca să știi cui scrii. Atașezi poze, video, PDF cu agrafa.
      </>
    ),
  },
  {
    q: "Ce e „Talk to God”?",
    a: (
      <>
        Linia ta directă și privată cu superadminul (owner-ul workspace-ului). O
        găsești prima în lista de chat. Doar voi doi vedeți conversația. Tot
        acolo ajung automat și erorile tehnice ale aplicației.
      </>
    ),
  },
  {
    q: "La ce folosesc rolul și culoarea de la prima logare?",
    a: (
      <>
        Rolul (client / agenție / casă de producție / post-producție + meseria)
        spune ce faci în lanț — pe el se rutează feedbackul către oamenii
        interesați. Culoarea e identitatea ta în <b>calendar</b> și chat. În
        calendar (butonul din dreapta-sus): click pe ziua de start, click pe
        final, scrii ce faci („edit") → perioada apare pe culoarea ta, iar
        deadline-urile campaniilor apar cu ⏰.
      </>
    ),
  },
  {
    q: "Cum urc versiunea nouă (v2) după modificări?",
    a: (
      <>
        Pe asset-ul existent → <b>Upload new version</b> — NU crea un asset nou.
        Așa istoricul rămâne legat: v1, v2, v3, cu compare side-by-side și cu
        evidența clară a versiunii pe care a aprobat-o clientul.
      </>
    ),
  },
  {
    q: "Am găsit un bug / ceva nu merge.",
    a: (
      <>
        Scrie în <b>Talk to God</b> — ajunge direct la superadmin. Erorile
        tehnice grave se raportează și singure, automat, în același loc.
      </>
    ),
  },
];

export default function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="min-h-screen bg-subtle/30 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <span className="text-foreground">
            <BlackMariaStrip className="h-8 w-auto" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Blackframe — Întrebări frecvente
            </h1>
            <p className="text-[12px] text-muted">
              răspunsurile scurte la ce întreabă toată lumea în prima zi
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="bg-white border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="flex-1 text-[13px] font-semibold text-foreground">
                  {item.q}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted transition-transform shrink-0 ${
                    openIdx === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIdx === i && (
                <div className="px-4 pb-4 text-[13px] text-slate-600 leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-accent font-medium hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Înapoi la aplicație
          </Link>
        </div>
      </div>
    </div>
  );
}
