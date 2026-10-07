# German resource catalog and access checks

Publisher information researched **1 October 2026**. Live browser checks performed **2 October 2026** using a fresh Edge/Chromium context without signing in. Five specific lessons/episodes also passed a muted-media playback check.

The application data is in `app/data/resources.js`. Each entry includes German/English guidance, a linked speaking situation, an estimated activity budget, access notes, and source-check metadata. The resource workspace preserves a response artifact; it does not automatically grade external content or infer listening time.

| ID | Source | Placement | Browser result |
| --- | --- | --- | --- |
| `vhs` | [VHS A2–B1 Deutsch Beruf](https://a2-b1-beruf.vhs-lernportal.de/wws/home.php) | A2–B1 | Page reachable; guest trial and free registration available |
| `nicos-interview` | [Nicos Weg: Bewerbungsgespräch](https://learngerman.dw.com/en/bewerbungsgespr%C3%A4ch/l-38224991) | A2 | Page and muted playback verified |
| `nicos-vacancy` | [Nicos Weg: Ist die Stelle noch frei?](https://learngerman.dw.com/de/ist-die-stelle-noch-frei/l-40595437) | A2 | Page and muted playback verified |
| `dw-phone` | [Deutschtrainer 69: Am Telefon](https://learngerman.dw.com/de/69-am-telefon/l-54725768) | A1–A2 | Page and muted playback verified |
| `dw-workday` | [Deutschtrainer 76: Arbeitsalltag](https://learngerman.dw.com/de/76-arbeitsalltag/l-54727988) | A1–A2 | Page and muted playback verified |
| `goethe-office` | [Tätigkeiten im Büro](https://www.goethe.de/prj/mwd/de/deu/tzs/dib/bu0/bu2.cfm) | A2 | Automated browser received 403; manual check/fallback offered |
| `goethe-pronunciation` | [Online-Aussprachetrainer](https://www.goethe.de/de/spr/ueb/ast.html) | Start with easiest tier | Automated browser received 403; free registration required by publisher |
| `easy-routine` | [Super Easy German 78](https://www.youtube.com/watch?v=F0CFFJLQUcM) | Supported A2, editorial placement | Automated browser received 401; normal-browser access may differ |
| `slow-interview` | [Slow German SG 298](https://slowgerman.com/2025/05/27/bewerbungsgespraech-dialog/) | Supported A2+/B1, editorial placement | Page and muted playback verified; one voice is generated |
| `goethe-a2` | [A2 adult practice material](https://www.goethe.de/ins/de/de/prf/prf/gzsd2/ub2.html) | A2 | Automated browser received 403; manual check/fallback offered |
| `goethe-b1` | [B1 practice material](https://www.goethe.de/ins/de/de/prf/prf/gzb1/ueb.html) | B1 | Automated browser received 403; manual check/fallback offered |
| `dw-topthema` | [Top-Thema](https://learngerman.dw.com/de/top-thema/s-55861562) | B1 | Listing reachable; choose a report to play its audio |
| `dw-profis` | [Profis gesucht](https://learngerman.dw.com/de/deutsch-im-job-profis-gesucht/a-61693603) | Consolidated B1 | Page reachable; select a course activity |
| `ba-interview` | [Bewerbungsgespräche einfach erklärt](https://www.arbeitsagentur.de/bildung/einfach-erklaert/bewerbungsgespraeche-einfach) | Supported A2–B1, editorial placement | Public text reachable |
| `goethe-a2-words` | [A2 word list](https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_A2_Wortliste.pdf) | A2 reference | PDF response reachable |

## Selection and accessibility

- Automatic daily assignments use sources that were reachable in the browser check, fit the selected practice budget, do not require registration, and are not marked unavailable or too difficult by the learner. Optional-registration sources can offer a guest path.
- Restricted automated access is not proof that a normal signed-in/user browser cannot use the source. Those entries remain discoverable with a visible notice, alternative activities, and an original in-app fallback.
- Easy German's simultaneous German/English video captions cannot be hidden by Sprich. The on-demand English setting applies to Sprich's own lesson content.
- Slow German SG 298 explicitly discloses a generated voice for one character. It is labelled mixed, not entirely human speech.
- The Goethe word list is a reference. Assignments use selected words in original sentences rather than treating the full list as a daily memorisation deck.
- The DW “Profis gesucht” publisher recommends a consolidated B1 foundation. It is a later-stage option.

## Repeat checks

```powershell
npm run check:resources
npm run check:resources -- nicos-interview nicos-vacancy
```

The tool reports HTTP/page status and an optional directly available playback result. It does not create an account, handle login credentials, submit forms, download a library, or evaluate the learner. It waits for the DW lesson shell to load before checking its media. Follow-up editorial checks should assess content relevance as well as technical reachability.
