"""Smoke test for index.html.

Mocks the Apps Script backend (nothing is sent anywhere) and checks the main
flows: validation, write mode, voice mode with a fake microphone, "no update",
the glossary and spoken punctuation.

Run:
    python3 -m pip install playwright && python3 -m playwright install chromium
    python3 tests/smoke_test.py
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / "index.html").as_uri()

failures = []


def check(name, cond, detail=""):
    print(("OK   " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        failures.append(name)


def main():
    sent = []

    def backend(route):
        payload = json.loads(route.request.post_data or "{}")
        sent.append(payload)
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"ok": True, "id": payload.get("id")}))

    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--use-fake-ui-for-media-stream",
                                           "--use-fake-device-for-media-stream"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844},
                                  permissions=["microphone"], locale="cs-CZ")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.route("https://script.google.com/**", backend)
        page.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        page.route("https://fonts.gstatic.com/**", lambda r: r.abort())

        # --- start screen + validation -------------------------------------
        page.goto(PAGE)
        page.click("#start-go")
        check("validation: name required", page.text_content("#start-err").strip() != "")
        page.click('.chip[data-id="marek"]')
        check("language follows person (Marek -> sk)",
              page.evaluate("document.documentElement.lang") == "sk")
        months = page.evaluate("Array.from(document.querySelectorAll('#period option')).map(o => o.value)")
        check("month list = previous month + 12 ahead", len(months) == 13, str(months))

        # --- write mode ----------------------------------------------------
        page.click('.mode[data-mode="write"]')
        page.click("#start-go")
        page.click("#s-write [data-send]")
        check("validation: at least one answer", page.text_content("#write-err").strip() != "")
        areas = page.query_selector_all("#qs textarea")
        check("six questions rendered", len(areas) == 6, str(len(areas)))
        areas[0].fill("Call with Štefan about V.A.C. availability.")
        areas[1].fill("Štefan to confirm delivery date by 31 Oct.")
        page.click("#s-write [data-send]")
        page.wait_for_selector("#s-done.is-active", timeout=5000)
        p = sent[-1]
        check("write payload", p["mode"] == "write" and p["person"] == "Marek"
              and p["personTag"] == "SK" and p["answers"][0].startswith("Call"), json.dumps(p)[:200])

        # --- voice mode (fake microphone) ------------------------------------
        page.goto(PAGE)
        page.click('#langs button[data-lang="en"]')
        page.click('.chip[data-id="other"]')
        page.fill("#other-name", "TEST – smoke")
        page.click('.mode[data-mode="voice"]')
        page.click("#start-go")
        page.click("#recbtn")
        page.wait_for_timeout(2200)
        page.click("#recbtn")
        page.wait_for_timeout(600)
        page.fill("#note", "written note")
        page.click("#s-voice [data-send]")
        page.wait_for_selector("#s-done.is-active", timeout=8000)
        p = sent[-1]
        check("voice payload has audio", p["mode"] == "voice" and p["audio"] and len(p["audio"]["b64"]) > 1000)

        # --- nothing happened ------------------------------------------------
        page.goto(PAGE)
        page.click('.chip[data-id="piotr"]')
        page.click("#nothing")
        page.click("#start-go")
        page.wait_for_selector("#s-done.is-active", timeout=5000)
        check("no-update payload", sent[-1]["noUpdate"] is True and sent[-1]["mode"] == "none")

        # --- glossary + punctuation -----------------------------------------
        cases = {
            "fixTerms('n p w t a a v d, přístroje vak pro fn motol')": "NPWT a AWD, přístroje V.A.C. pro FN Motol",
            "fixTerms('vakuová terapie, převaky')": "vakuová terapie, převaky",
            "joinSeg('', 'mluvil jsem se štefanem čárka probírali jsme n p w t')":
                "mluvil jsem se Štefanem, probírali jsme NPWT. ",
            "joinSeg('', 'cena se mění dvojtečka plus tři procenta')": "cena se mění: plus tři procenta. ",
            "joinSeg('', 'hotovo tečka další věc otazník nový řádek nový bod')": "hotovo. Další věc?\nNový bod. ",
        }
        for expr, expected in cases.items():
            got = page.evaluate(expr)
            check(f"{expr[:45]}…", got == expected, repr(got))

        check("no JavaScript errors", not errors, "; ".join(errors))
        browser.close()

    print(f"\n{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
