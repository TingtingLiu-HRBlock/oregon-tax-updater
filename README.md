# State Tax Table Updater

Desktop Electron app for extracting state tax table values from official instruction PDFs and updating the corresponding JSON table files.

## What It Does

- Supports Oregon and Minnesota.
- Uses an instruction PDF as the extraction source.
- Requires manual entry of the tax-table start and end pages.
- Uses deterministic PDF parsers for supported states.
- Shows a review screen before writing JSON updates.
- Updates the selected JSON table files and the `Year` field.
- Supports a dedicated Minnesota `M1MA Marriage Credit` workflow with full-table preview and single-file replace.

## Supported State Setups

### Oregon
- Filing statuses:
  - `S` = Single / Married Filing Separately
  - `J` = Married Jointly / Head of Household / Surviving Spouse
- Deterministic PDF parser:
  - Yes
- Example 2024 tax-table page range:
  - `26-28`

### Minnesota
- Filing statuses:
  - `Single`
  - `MFJ` = Married Jointly / Qualifying Surviving Spouse
  - `MFS` = Married Filing Separately
  - `HOH` = Head of Household
- Deterministic PDF parser:
  - Yes
- Example 2024 tax-table page range:
  - `30-36`

### Minnesota M1MA Marriage Credit
- Workflow:
  - `M1MA Marriage Credit`
- Target JSON:
  - `C:\TaxEngine\OCE-Regulatory-{regulatoryYear}\Source\MN\Utils\Tables\MNMarriageCredit.table.json`
- Table shape:
  - Two-key lookup table using `SeparateIncome`, `JointIncome`, and `Value`
- Review mode:
  - Full extracted table preview before replace
- Deterministic PDF parser:
  - Yes, with a full-text fallback for PDFs whose table rows are grouped inconsistently
- Example 2025 page range:
  - `1-1`

## Installation

### Prerequisites
- Node.js 18 or higher recommended
- npm

### Setup

```bash
npm install
```

## Running the App

```bash
npm start
```

## Build

```bash
npm run build
```

## Typical Workflow

1. Start the app.
2. Select the state.
3. Select the tax year.
4. Select the workflow when Minnesota offers more than one option.
5. Confirm the JSON file path or paths.
6. Click `Select PDF` and choose the instruction booklet.
7. Enter the PDF start and end tax-table pages manually.
8. Run extraction.
9. Review the extracted output.
10. Update or replace the JSON file(s).

### Standard OR / MN Tax Tables

1. Start the app.
2. Select the state.
3. Select the tax year.
4. Confirm the JSON file paths.
5. Click `Select PDF` and choose the instruction booklet.
6. Enter the PDF start and end tax-table pages manually.
7. Run extraction.
8. Review changes by filing-status tab.
9. Update the JSON files.

### Minnesota M1MA Marriage Credit

1. Start the app.
2. Select state `Minnesota`.
3. Select the tax year.
4. Choose workflow `M1MA Marriage Credit`.
5. Confirm the `MNMarriageCredit.table.json` path.
6. Click `Select PDF` and choose the Schedule M1MA instruction PDF.
7. Enter the page range that contains the line 8 table.
8. Run extraction.
9. Review the full extracted marriage-credit table.
10. Click `Replace Marriage Credit JSON`.

## PDF Workflow Notes

- Select only supported Oregon or Minnesota PDFs.
- Enter only the tax-table page range you want parsed.
- Extraction uses deterministic PDF text parsing.
- Review the extracted diffs before updating standard tax-table JSON files.
- For `M1MA Marriage Credit`, review the full extracted table before replacing the JSON file.

## Project Structure

- [main.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/main.js): Electron main process and IPC handlers
- [pathUtils.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/pathUtils.js): workflow-specific JSON path defaults and normalization helpers
- [preload.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/preload.js): safe renderer bridge
- [renderer.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/renderer.js): UI, extraction flow, deterministic parsers, diff review, and M1MA full-table preview
- [States/OR.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/States/OR.js): Oregon state config
- [States/MN.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/States/MN.js): Minnesota state config

## Manual Scenario Tests

- [SCENARIO_TEST_OR_2024_PDF.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_OR_2024_PDF.md)
- [SCENARIO_TEST_MN_2024_PDF.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_MN_2024_PDF.md)
- [SCENARIO_TEST_REVIEW_TABS.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_REVIEW_TABS.md)
- [SCENARIO_TEST_PDF_PAGE_RANGE.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_PDF_PAGE_RANGE.md)

## Troubleshooting

### PDF page range is wrong
- Verify the start page is a tax-table page in the selected PDF.
- Verify the end page is not before the start page.
- Re-enter the manual page range and run extraction again.

### JSON files do not update
- Verify the JSON paths are correct.
- Verify you have write permission for the target folders.
- Verify the selected state matches the selected JSON table set.
- For `M1MA Marriage Credit`, verify the target path resolves to `MNMarriageCredit.table.json` under `C:\TaxEngine\OCE-Regulatory-{regulatoryYear}\Source\MN\Utils\Tables\`.

### App does not start
- Run `npm install` again.
- Check the console output for Electron startup errors.

## Version

- App version: `2.0.0`
- Supported deterministic PDF parser states: `OR`, `MN`
