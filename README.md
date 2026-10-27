# Monthly update – Solventum

Interní formulář Aspironix pro měsíční (a urgentní) updaty ke Solventu.
Odpovědi jdou jen Davidovi Šeketovi a zapisují se do Kroniky vztahu.

**Odkaz pro kolegy:** https://davidseketa.github.io/monthly-update/

## Jak to funguje

| Část | Kde | Co dělá |
|---|---|---|
| Stránka | index.html (GitHub Pages) | Volba Napsat / Namluvit, jazyky EN/CZ/SK/PL, 6 otázek, nahrávání hlasu + živý přepis |
| Backend | Google Apps Script „Solventum Monthly Update“ (zdroj v apps-script/Code.gs) | Uloží odpověď do Google tabulky a hlasovku do složky na Disku. E-mailové notifikace jsou vypnuté. |
| Úložiště | Google tabulka „Solventum Monthly Update – Inbox“, složka „Solventum Monthly Update – Voice“ | Všechny odpovědi a nahrávky na Davidově osobním Google účtu. Tabulka je jen pro čtení nasdílená klubovému účtu, aby ji četl agent. |
| Agent | Naplánovaná úloha v Claude „Solventum – updaty do kroniky“ | Každý pracovní den v 7:47 zpracuje nové odpovědi do angličtiny a do listů kroniky. Excel s řádky pošle do Claude a uloží do složky „Solventum – kronika (agent)“ na klubovém Disku. |

## Co kde změníš

- **Lidi, jazyk, adresa backendu:** blok CONFIG nahoře ve skriptu v index.html.
- **Texty a otázky:** objekt T v index.html (pro každý jazyk zvlášť).
- **Notifikace mailem:** SEND_EMAIL = true v Apps Scriptu, adresu určuje NOTIFY_TO (prázdné = tvůj Google účet).

Když změníš kód v Apps Scriptu, nasaď ho znovu: **Implementovat → Spravovat implementace → upravit → Nová verze**. Adresa zůstane stejná.

## Poznámky

- Živý přepis používá rozpoznávání řeči v prohlížeči (Chrome, Edge, Safari). Kde nefunguje, uloží se aspoň nahrávka.
- key v CONFIG jen brání náhodnému spamu, není to heslo.
- Stránka má noindex, vyhledávače ji nezobrazí.
