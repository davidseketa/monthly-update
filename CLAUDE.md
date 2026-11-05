# CLAUDE.md – Monthly update (Solventum)

Kontext pro Claude Code. Tenhle soubor se načítá na začátku každé session, tak ho udržuj aktuální: když změníš architekturu, ID nebo postup nasazení, uprav ho ve stejném commitu.

- S Davidem (vlastník, David Šeketa, Aspironix) komunikuj **česky**. Obsah pro Kroniku vztahu je **anglicky**.
- Lidský popis projektu: @README.md

## Co to je

Interní formulář Aspironixu, přes který country manageři a další kolegové posílají měsíční a urgentní updaty o vztahu se Solventem (ex-3M Health Care). Je součástí SOP „Monthly Solventum Update“. Z updatů vzniká **Kronika vztahu** (Jirka jí říká „mapa Solventum“). Master soubor je `Relationship_Chronicle_Solventum_v4_EN.xlsx` a vede ho David. Agent připravuje řádky, David je vkládá ručně.

Tok dat:

```
index.html (GitHub Pages)
   │  POST JSON (text/plain, bez CORS preflightu)
   ▼
Google Apps Script web app  ──►  Google tabulka „Solventum Monthly Update – Inbox“ (list Responses)
                            └─►  Drive složka „Solventum Monthly Update – Voice“ (nahrávky)
   ▼
Naplánovaná úloha v Claude (agent, po–pá 7:47)
   │  čte tabulku, překládá do EN, třídí do listů kroniky
   ▼
Excel Chronicle_update_YYYY-MM-DD.xlsx → složka „Solventum – kronika (agent)“ + notifikace Davidovi do Claude
```

## Soubory v repu

| Soubor | Co to je |
|---|---|
| `index.html` | Celá stránka v jednom souboru (HTML + CSS + JS), bez build kroku a bez knihoven. Jediná externí věc je Google Fonts (Inter). |
| `apps-script/Code.gs` | **Kopie** backendu. Živá verze je v Google Apps Script (viz níže) a nasazuje se ručně. |
| `agent/scheduled-task-prompt.md` | **Kopie** instrukcí agenta. Živá verze je v naplánované úloze v Claude. |
| `tests/smoke_test.py` | Playwright smoke test stránky. Backend mockuje, nic neodesílá. |
| `README.md` | Popis pro lidi. |

Struktura `index.html` (v pořadí):
- `CONFIG`: adresa backendu, `key`, seznam lidí (`id`, `name`, `tag`, `lang`), max. délka nahrávky.
- `T`: všechny texty UI ve 4 jazycích (`en`, `cs`, `sk`, `pl`), včetně 6 otázek v `q`.
- `GLOSSARY`, `fixTerms`: oprava odborných termínů a jmen v přepisu řeči.
- `PUNCT`, `tidySeg`, `joinSeg`: interpunkce diktovaná slovem a tečky na konci segmentů.
- Write mode (6 polí a tlačítko Diktovat), voice mode (MediaRecorder a živý přepis přes Web Speech API), submit.

## Kde co běží

| Co | Kde / ID |
|---|---|
| Stránka (odkaz pro kolegy) | https://davidseketa.github.io/monthly-update/ (GitHub Pages z větve `main`, root; nasazení cca 1 min po pushi) |
| Apps Script projekt | „Solventum Monthly Update“, ID `11iEZKzYTAU4N_K5IsFgx5YX1xSuTwTjRIopNkVG6IaDBx0J51n-Spc7G`, vlastník osobní Google účet `dseketa201221@gmail.com`. Editor: https://script.google.com/home/projects/11iEZKzYTAU4N_K5IsFgx5YX1xSuTwTjRIopNkVG6IaDBx0J51n-Spc7G/edit |
| Web app (backend) | Deployment ID `AKfycbx8dRoKfc0PSQv92dhZKqrKztMLNEGkm7UBMhIXFiuXtASGnCrsAibUgYBb_1FOOZTQcQ`, URL je v `CONFIG.endpoint`. Spouští se jako vlastník, přístup „Kdokoli“. Verze 3 (od 27. 10. 2026). |
| Inbox tabulka | „Solventum Monthly Update – Inbox“, ID `1n1Z16j69LVWYhnHp7iEVX0SJN1xK93KA7GsVg7WinU0`, list `Responses`. Je na osobním účtu, nasdílená jen pro čtení klubovému účtu `david.seketa@klubinvestoru.com`, protože Google konektory v Claude běží pod klubovým účtem. |
| Nahrávky | Drive složka „Solventum Monthly Update – Voice“, ID `1AF_4vp0T_r8PWS6bp-QRrLIG0uvwdjVP` (osobní účet) |
| Výstupy agenta | Drive složka „Solventum – kronika (agent)“, ID `1kaQxJqGAoI9zZPIAVZ2MqY7LgjZLDTJx` (klubový účet). Podle souborů v ní agent pozná, co už zpracoval (list Summary, sloupec Reference). |
| Agent | Naplánovaná úloha „Solventum – updaty do kroniky“, ID `trig_01SFb9m4RyiMG5wg2K8GKKDv`, `CRON_TZ=Europe/Prague 47 7 * * 1-5`, automatické schvalování, push notifikace |

## Datový kontrakt (neměnit jen na jedné straně)

Payload z `index.html` (`buildPayload`):
`key, v, id ("SU-YYYYMMDD-HHMM-XXXX"), submittedAt, person, personTag, type ("monthly"|"urgent"), period ("YYYY-MM"), periodLabel, lang ("en"|"cs"|"sk"|"pl"), mode ("write"|"voice"|"none"), noUpdate, answers[6], transcript, note, audio {mime, seconds, b64} | null, userAgent`

Sloupce tabulky (`HEADERS` v `Code.gs`), v tomto pořadí:
`Submitted at | Reference | Person | Tag | Type | Period | Language | Mode | No update | Q1 Contact | Q2 Commitments | Q3 News | Q4 Patterns | Q5 Unknowns | Q6 Anything else | Voice transcript (live) | Written note | Audio file | Audio length (s) | Device`

Agent čte tabulku podle názvů sloupců. Změna sloupců nebo payloadu proto znamená upravit tři místa: `index.html`, `Code.gs` (`HEADERS` a `appendRow`) a instrukce agenta. Backend ignoruje duplicitní `id`, takže opakované odeslání ze stránky nevadí. `KEY` v `Code.gs` se musí shodovat s `CONFIG.key`. Není to tajemství, jen ochrana proti náhodnému spamu.

## Jak nasadit změny

**Stránka:** uprav `index.html`, spusť smoke test, commitni a pushni do `main`. GitHub Pages ji nasadí samo. Ověř na živé URL s tvrdým obnovením (Cmd+Shift+R).

**Backend:** Claude Code ho nasadit neumí, nasazuje se v Googlu.
1. Uprav `apps-script/Code.gs` v repu.
2. Obsah zkopíruj do editoru Apps Script (odkaz výše) a ulož.
3. Implementovat → Spravovat implementace → tužka → Verze: **Nová verze** → Implementovat. URL zůstane stejná.
4. Když kód začne používat novou službu Googlu, spusť v editoru funkci `setup` a autorizuj ji (Rozšířené → Přejít na Solventum Monthly Update → Vybrat vše → Pokračovat).
5. Do tabulky „Kde co běží“ zapiš nové číslo verze.

**Agent:** instrukce se mění v naplánované úloze. Buď v Claude v přehledu naplánovaných úloh, nebo v session, která má nástroj `update_trigger` (ID výše). Pak zkopíruj novou verzi do `agent/scheduled-task-prompt.md`.

## Konvence

- **Jazyky:** každý nový text UI přidej do `T` ve všech čtyřech jazycích. Chybějící klíč spadne do angličtiny.
- **Lidé:** jsou v `CONFIG.people`. Po výběru osoby se přepne jazyk stránky, pokud ho uživatel nezvolil ručně. Agent hlídá měsíční updaty jen od Cyrila (CZ), Marka (SK) a Piotra (PL).
- **Slovník (`GLOSSARY`):** položka je `[alternativy jako regex string, náhrada]`, kde náhrada může být i funkce (pády jmen). Hranice slov řeší Unicode lookbehind/lookahead v `map()`. Nový termín vždy otestuj, aby nepřepisoval běžná slova (např. „vak“ nesmí změnit „vakuová“). Stejné termíny drž i ve slovníku v instrukcích agenta.
- **Interpunkce:** platí jen pro diktování a živý přepis. Chrome vrací text po segmentech podle pauz a každý začíná velkým písmenem, proto se na konec segmentu doplňuje tečka.
- **Měsíce:** výběr ukazuje minulý měsíc a 12 měsíců dopředu. Do 15. dne je předvybraný minulý měsíc, potom aktuální.
- **E-maily:** jsou vypnuté (`SEND_EMAIL = false`). David nechce notifikace, výsledek mu posílá agent do Claude.
- **Design:** barvy jsou v `:root` (navy `#16324F`, teal `#0E7C7B`) a ladí s one-pagerem SOP. Mobil first, `max-width: 720px`. Stránka má `noindex`.
- **Prohlížeče:** živý přepis funguje v Chrome, Edge a Safari. Firefox Web Speech API nemá, takže se uloží jen nahrávka a agent ji dá do seznamu „K poslechu“.

## Testování

```bash
python3 -m pip install playwright && python3 -m playwright install chromium
python3 tests/smoke_test.py          # mock backend, nic neodesílá
python3 -m http.server 4321          # ruční test na http://localhost:4321
```

Ruční test proti živému backendu: vyber „Někdo jiný“ a jako jméno napiš něco s **TEST** (např. „TEST – smazat“). Agent takové řádky přeskakuje. Testovací řádky v tabulce pak smaže David.

## Co nedělat

- Neměnit sloupce tabulky ani payload bez úpravy backendu a agenta.
- Neměnit `KEY` jen na jedné straně.
- Neposílat na živý backend testovací data bez „TEST“ ve jménu.
- Nepřidávat build krok ani knihovny. Stránka musí zůstat jeden statický soubor.
