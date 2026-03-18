# PDF Page Range Detection Scenario Test

## Purpose
Verify that the app can accept an instruction PDF, identify the tax-table page range through built-in configuration or contents-page auto-detection, allow manual override, and extract the expected table pages into the review flow.

## Test Type
Manual scenario test

## Scope
- PDF file selection
- PDF page-range summary rendering
- Built-in configured page ranges
- Contents-page auto-detection helper
- Manual PDF page-range override
- Rendered PDF page extraction into the existing review flow

## State Under Test
- Primary state: Minnesota (`MN`)
- Form: M1
- Tax year: `2024`
- Configured tax table range: pages `30-36`

## Test Data
Use the Minnesota instruction PDF that contains:
- A contents page entry showing `Tax Tables ... 30-36`
- Tax table pages covering the expected 2024 table data

Reference file used during development:
- `MN_m1-inst-24_final_2-23-26.pdf`

## Preconditions
- The app starts successfully.
- A valid OpenAI API key is saved in Settings.
- State is set to `Minnesota`.
- The MN JSON file paths are configured.
- The Minnesota instruction PDF is available locally.

## Scenario A: Configured Range
### Steps
1. Launch the app.
2. Select state `Minnesota`.
3. Select tax year `2024`.
4. Click `Select PDF`.
5. Choose the Minnesota instruction PDF.
6. Confirm the PDF summary appears.
7. Confirm the page range fields show `30` and `36`.
8. Confirm the page-range source indicates the app is using the configured range.
9. Click `Extract Data from Images`.
10. Wait for rendering, strip extraction, and diff review to complete.

### Expected Results
- The PDF is accepted without error.
- The page range is prefilled as `30-36`.
- Extraction completes without an error toast.
- The review section appears with Minnesota filing statuses and diff data.
- Extraction uses rendered PDF pages rather than requiring screenshot upload.

## Scenario B: Auto-Detection Helper
### Steps
1. Launch the app.
2. Select a state and year that do not have a built-in PDF page range configured.
3. Click `Select PDF` and choose an instruction PDF whose contents page includes a `Tax Tables` range.
4. Confirm the page range fields are filled automatically after selection.
5. Confirm the page-range source indicates `auto-detected`.

### Expected Results
- The app scans early PDF pages for a `Tax Tables xx-yy` pattern.
- The detected range is written into the start/end inputs.
- The user can proceed without manually typing the range.

## Scenario C: Manual Override
### Steps
1. Start from a selected PDF with visible page range inputs.
2. Edit `PDF Start Page` to a test value.
3. Edit `PDF End Page` to a test value.
4. Confirm the page-range source switches to manual override.
5. Restore the correct range.
6. Run extraction.

### Expected Results
- Typing in either page field updates the effective range immediately.
- The summary reflects the manual range.
- The page-range source changes to `manual override`.
- Extraction uses the manually entered page range.

## Pass Criteria
The scenario passes if all of the following are true:
- Selecting a PDF shows the PDF summary and page inputs.
- A configured range is loaded automatically when available.
- Auto-detection can prefill the range when config is unavailable and the contents page includes `Tax Tables xx-yy`.
- Manual override replaces the configured or auto-detected range cleanly.
- Extraction proceeds successfully from PDF-rendered pages.

## Failure Examples
The scenario fails if any of the following occur:
- Selecting a PDF does not show the page range controls.
- The configured range is ignored for a known year.
- Auto-detection does not populate the range for a PDF whose contents page clearly includes `Tax Tables xx-yy`.
- Manual override does not change the effective page range.
- Extraction still requires screenshots after a PDF is selected.

## Notes
- Built-in configured ranges remain the primary source when available.
- Contents-page parsing is a helper for unconfigured years or states.
- Manual override is the fallback when configuration and auto-detection are not sufficient.
- This scenario should be rerun whenever PDF selection, page-range handling, or PDF rendering logic changes.
