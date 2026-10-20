# GnD Lab — peta kode halaman

Repo: https://github.com/gemashub-studio/GNDLAB (cabang `main`)
Online: https://gemasstudio.vercel.app/lab · https://gemas-rnd.vercel.app/lab
Flowchart: [GnD-Lab-flowchart.pdf](GnD-Lab-flowchart.pdf)

Menu: **Pencatatan Data** · **Riset Produk** · **Laporan Belanja** (Ringkasan, Eksperimen, Library, Standar dihapus — DEC-112).

## Halaman & komponen (`apps/web/src`)

| Bagian | File |
|---|---|
| Rute halaman | [app/lab/page.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/app/lab/page.tsx), [app/lab/hasil](https://github.com/gemashub-studio/GNDLAB/tree/main/apps/web/src/app/lab/hasil) |
| Kerangka halaman & menu | [components/lab/LabPage.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/LabPage.tsx) |
| Pencatatan Data (form awal/akhir/revisi, Selesaikan, Excel) | [components/lab/PencatatanTab.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/PencatatanTab.tsx), [CatatResult.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/CatatResult.tsx), [HasilPage.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/HasilPage.tsx), [FinishDialogs.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/FinishDialogs.tsx) |
| Riset Produk (resep, laporan harian) | [components/lab/ProtocolsTab.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/ProtocolsTab.tsx), [DailyLog.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/DailyLog.tsx) |
| Laporan Belanja | [components/lab/BelanjaTab.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/BelanjaTab.tsx) |
| Tanya Lab AI | [components/lab/AskLabAI.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/AskLabAI.tsx), [components/ui/PromptBar.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/ui/PromptBar.tsx) |
| Isi dengan suara (form) | [components/lab/VoiceFill.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/lab/VoiceFill.tsx), [lib/voiceFill.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/voiceFill.ts), [lib/voiceClient.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/voiceClient.ts) |
| Asisten suara kelapa | [components/shell/VoiceAssistant.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/shell/VoiceAssistant.tsx), [CoconutMascot.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/components/shell/CoconutMascot.tsx) |

## Logika & data (`apps/web/src/lib`)

| Bagian | File |
|---|---|
| Pencatatan (perlakuan, perbandingan, laporan) | [pencatatan.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/pencatatan.ts), [catatXlsx.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/catatXlsx.ts) |
| Riset produk & laporan | [labStore.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/labStore.ts), [researchReport.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/researchReport.ts) |
| Ekspor PDF / Word / PPTX | [labPdf.tsx](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/labPdf.tsx), [officeExport.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/officeExport.ts) |
| Laporan belanja | [belanja.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/belanja.ts), [belanjaExport.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/belanjaExport.ts) |
| Sinkron Supabase | [supabaseSync.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/supabaseSync.ts), [labDocs.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/labDocs.ts), [labSync.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/lib/labSync.ts) |

## Server (`apps/web/src/server`, `apps/web/src/app/api`)

| Bagian | File |
|---|---|
| Login + OTP | [server/labAuth.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/server/labAuth.ts), [app/api/lab-auth](https://github.com/gemashub-studio/GNDLAB/tree/main/apps/web/src/app/api/lab-auth) |
| Transkripsi suara (Groq Whisper) | [server/voiceTranscribe.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/server/voiceTranscribe.ts) |
| Perencana asisten suara (Groq) | [server/voiceAssistant.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/server/voiceAssistant.ts) |
| Email pengingat 2 harian | [server/labReminder.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/src/server/labReminder.ts) |
| Skema database | [supabase/migrations](https://github.com/gemashub-studio/GNDLAB/tree/main/supabase/migrations) |

## Uji

- Unit: [apps/web/test](https://github.com/gemashub-studio/GNDLAB/tree/main/apps/web/test) — `pnpm --filter @gemas/web test`
- E2E: [apps/web/e2e/lab.spec.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/e2e/lab.spec.ts), [voice-assistant.spec.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/e2e/voice-assistant.spec.ts), [voice-mic.spec.ts](https://github.com/gemashub-studio/GNDLAB/blob/main/apps/web/e2e/voice-mic.spec.ts)

Env server: `PROJECT_URL`, `ANON_KEY_SUPABASE`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `GROQ_API_KEY` (isi di `apps/web/.env` & Vercel — jangan di-commit).
