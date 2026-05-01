# Shridhar Maharaj Full Classes — Processing Pipeline

Converts Russian lecture transcripts of Śrīla Śrīdhara Mahārāja from DOC/RTF source files into clean Markdown files with YAML frontmatter, and renames the matching MP3 audio files — all organized by a canonical `record_id` (e.g. `1981.03.07.A`).

---

## Prerequisites

- **Node.js** (v18+)
- **pandoc** — used by step 01 to convert DOC/RTF → Markdown
- **LibreOffice (`soffice`)** — used by step 01 to pre-convert RTF → DOCX (fixes encoding)
- Install JS dependencies once:
  ```
  npm install
  ```

---

## Input layout

```
input/
  1._Lektsii_smontirovanniye_do_2012_goda/
    Transkriptsii_DOC_RTF/   ← source DOC/RTF files (group 1)
    Audio_MP3/               ← source MP3 files (group 1)
  2._Lektsii_...2012_do_2015.../
    Transkriptsii_DOC_RTF/   (group 2)
    Audio_MP3/
  3._Lektsii_...2015_do_2020.../
    Transkriptsii_DOC_RTF/   (group 3)
    Audio_MP3/
```

Three "groups" of lectures, each with its own set of transcripts and audio.

---

## Pipeline — four steps

### Step 01 — DOC/RTF → Markdown
**Script:** `node 01-doc2md/convert-doc2md.js`  
**Config:** `01-doc2md/config.json`  
**Input:** `input/*/Transkriptsii_DOC_RTF/`  
**Output:** `output/01-doc2md/{01,02,03}/`

Uses **pandoc** (`--wrap none -t markdown+escaped_line_breaks`) to convert each `.doc` / `.docx` / `.rtf` file to `.md`.  
RTF files are first passed through **LibreOffice** to fix Cyrillic encoding before pandoc sees them.  
After conversion a post-processing plugin (`plugins/rtf-cleanup.js`) strips RTF conversion artifacts:
- `^` escape characters left by pandoc
- Escaped spaces (`\ `)
- Backslash escapes before Markdown characters
- Trailing backslashes before blank lines
- Pandoc `{.underline}` link-attribute syntax

**CLI options** (shared across all steps):
| Flag | Effect |
|------|--------|
| `--id=N` | Process only config group N (1, 2, or 3) |
| `--limit=N` | Process only the first N files |
| `--file=substring` | Process only files whose name contains the substring |

> **⚠️ Do not re-run step 01.**  
> After the initial conversion, files in `output/01-doc2md/` were manually edited to fix errors that the automated pipeline cannot handle. Re-running `convert-doc2md.js` will overwrite those files and destroy all manual fixes.

---

### Step 02 — Markdown cleanup / formatting improvements
**Script:** `node 02-md-improve/process-md.js`  
**Config:** `02-md-improve/config.json`  
**Input:** `output/01-doc2md/{01,02,03}/`  
**Output:** `output/02-md-improve/{01,02,03}/`

Runs the improved Markdown through a set of cleaner plugins (`plugins/cleaners/`):
- `bold-line-breaks.js` — adds `\` line-break after bold lines inside verse/quote blocks
- `italic-line-breaks.js` — same for italic lines
- `italic-boundaries.js` — fixes malformed `*italic*` spans across line breaks
- `footnotes-converter.js` — converts inline footnote markers to standard `[^N]` syntax
- `simple-replacements.js` / `simple-replacements-last.js` — miscellaneous regex-based fixes (run first and last)

Same `--id`, `--limit`, `--file` flags apply.

---

### Step 03 — Extract metadata → YAML frontmatter
**Script:** `node 03-md-yml/prepare-meta.js`  
**Config:** `03-md-yml/config.json`  
**Input:** `output/02-md-improve/{01,02,03}/`  
**Output:** `output/03-md-yml/{01,02,03}/` (Markdown with YAML frontmatter prepended)

Each output file gains a `---` YAML block at the top. A chain of extractor plugins reads the document and populates these fields:

| Field | Source |
|-------|--------|
| `record_id` | Extracted from the document header line (e.g. `1981.03.07.A`) |
| `author` | Detected from known author name variants in the header |
| `title` | First non-ID heading line; falls back to the filename slug |
| `title_from_filename` | Slug extracted from the filename when the document has no explicit title |
| `date` | Derived from `record_id` (`year`, `month`, `day`) |
| `legacy.filename` | Original filename stem (used to locate the MP3) |
| `legacy.mp3` | Manually specified MP3 filename when auto-matching fails |
| `editors` | Names extracted from an "editors" header inside the document |

**Additional helper scripts in step 03:**

- `prepare-filename-titles.js` — scans `output/02-md-improve/` filenames, extracts title slugs, writes `filename-titles.json` (reference data for `05-title-by-filename` plugin).
- `check-mp3.js` — sends HTTP HEAD requests to the remote object-storage server to verify that a matching MP3 exists for every `.md` file. Writes errors to `errors_mp3.md`.

**Log files written by `prepare-meta.js`:**
- `03-md-yml/errors.md` — files with missing/invalid `record_id` or other hard errors
- `03-md-yml/warnings.md` — non-fatal issues (missing title, ambiguous author, etc.)

---

### Step 04 — Rename / copy docs and MP3s
**Script (prepare):** `node 04-rename/prepare-renaming.js`  
**Script (apply):** `node 04-rename/do-renaming.js`  
**Config:** `04-rename/config.json`  
**Input:** `output/03-md-yml/{01,02,03}/` + `input/*/Audio_MP3/`  
**Output:** `output/04-rename/docs/` and `output/04-rename/mp3/`

**`prepare-renaming.js`** reads every `.md` file's YAML frontmatter, derives canonical filenames from `record_id` and `date`, and writes two JSON maps:
- `output/04-rename/docs-rename.json` — `{ "old/path.md": "YYYY/MM/record_id.md", … }`
- `output/04-rename/mp3-rename.json` — `{ "old/path.mp3": "YYYY/MM/record_id_ru.mp3", … }`

**`do-renaming.js`** reads those maps and **copies** (originals kept) every file to its target path under `output/04-rename/docs/` and `output/04-rename/mp3/`.

---

## Shared utilities

`utils.js` — exports `getMDFilename(meta)` and `getMP3Filename(meta)`:  
Both derive a path like `YYYY/MM/record_id[_lang].ext` from a YAML meta object.

---

## Typical full run

```bash
node 01-doc2md/convert-doc2md.js
node 02-md-improve/process-md.js
node 03-md-yml/prepare-meta.js
node 04-rename/prepare-renaming.js
node 04-rename/do-renaming.js
```

Process a single group only:
```bash
node 01-doc2md/convert-doc2md.js --id=2
node 02-md-improve/process-md.js --id=2
node 03-md-yml/prepare-meta.js   --id=2
```

Process a single file for debugging:
```bash
node 03-md-yml/prepare-meta.js --file=1981.03.07
```

---

## Output file structure (after step 04)

```
output/04-rename/
  docs/
    1981/03/1981.03.07.A.md
    1981/03/1981.03.07.B.md
    …
  mp3/
    1981/03/1981.03.07.A_ru.mp3
    …
```
