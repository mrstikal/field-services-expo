# Audit implementace CODE_REVIEW (ETAPA 4)

**Datum auditu:** 5. 4. 2026  
**Zdroj:** `CODE_REVIEW.md` + kontrola aktuálního kódu

## Co bylo ověřeno

- Porovnání tvrzení "✅ OPRAVENO" proti aktuálním souborům ve `apps/mobile` a `apps/web`.
- IDE inspekce přes `get_errors` na klíčových souborech.
- Typecheck:
  - `pnpm --filter field-service-web typecheck` ✅
  - `pnpm --filter field-service-mobile typecheck` ✅

## Nalezené nedostatky

| ID | Priorita | Oblast | Stav | Důkaz |
|---|---|---|---|---|
| N1 | 🟡 Medium | Error handling (mobile/web) | Přetrvávají warningy "throw of exception caught locally" navzdory označení jako opravené | `apps/mobile/components/swipeable-task-card.tsx:75`, `apps/mobile/components/swipeable-task-card.tsx:98`, `apps/mobile/app/tasks/[id].tsx:122`, `apps/web/app/dashboard/tasks/page.tsx:115`, `apps/web/app/dashboard/tasks/page.tsx:143` |
| N2 | 🟡 Medium | Web dialog flow | `onCancel` prop je v `TaskDialog` nepoužitý; parent callback se nespouští | `apps/web/components/task-dialog.tsx:22` (unused), `apps/web/components/task-dialog.tsx:44`, `apps/web/components/task-dialog.tsx:52` |
| N3 | 🔴 High | Web formulář - datum | Nesoulad `z.string().datetime()` vs. `input type="datetime-local"`; validace může failnout při submitu | `apps/web/components/task-form.tsx:33`, `apps/web/components/task-form.tsx:277`; test: `2026-04-05T12:30` => `false`, `2026-04-05T12:30:00Z` => `true` |
| N4 | 🟢 Low | API design vs. review doporučení | Review doporučovalo `PATCH /api/tasks/[id]`, implementace má `PATCH /api/tasks` s `id` v body; funkčně použitelné, ale odchylka od navrženého REST tvaru | `apps/web/app/api/tasks/route.ts:62`, `apps/web/app/dashboard/tasks/page.tsx:132` |
| N5 | 🟢 Low | Konzistence dokumentace | V `CODE_REVIEW.md` je rozpor: checklist uvádí real-time jako ⚠️, závěr uvádí kompletní implementaci ✅ | `CODE_REVIEW.md` sekce "Checklist implementace" vs. "IMPLEMENTACE POZNATKŮ" |

## Doporučené opravy

1. Nahradit vzor `throw ...` uvnitř `try/catch` explicitním návratem chyby nebo jednotným helperem pro hlášení (`console.error` + UI feedback) bez lokálního re-throw.
2. V `TaskDialog` používat skutečně `onCancel` (nebo prop odstranit), aby se vždy vyčistil stav v parentu (`editingTask`).
3. U `due_date` sjednotit formát:
   - buď přijímat `datetime-local` formát v Zod,
   - nebo hodnotu před validací převést na ISO (`new Date(value).toISOString()`).
4. Rozhodnout API kontrakt: buď zachovat aktuální `PATCH /api/tasks`, nebo přejít na `PATCH /api/tasks/[id]` a sjednotit dokumentaci.
5. Uvést `CODE_REVIEW.md` do konzistentního stavu (jeden pravdivý status real-time části).

## Stav po opravě (5. 4. 2026)

- ✅ N1: Odstraněny lokální `throw` warningy v `apps/mobile/components/swipeable-task-card.tsx`, `apps/mobile/app/tasks/[id].tsx`, `apps/web/app/dashboard/tasks/page.tsx`.
- ✅ N2: `TaskDialog` nyní používá `onCancel` konzistentně pro všechny cesty zavření (`apps/web/components/task-dialog.tsx`).
- ✅ N3: `due_date` je sladěn pro `datetime-local` input a transformuje se na ISO při submitu (`apps/web/components/task-form.tsx`).
- ✅ N4: Přidán endpoint `PATCH /api/tasks/[id]` a web stránka jej používá (`apps/web/app/api/tasks/[id]/route.ts`, `apps/web/app/dashboard/tasks/page.tsx`).
- ✅ N5: Rozpor v checklistu review opraven (`CODE_REVIEW.md`).

