# State Tax Table Updater

Desktop Electron app for extracting state tax table values from official instruction PDFs and updating the corresponding JSON table files.

## What It Does

- Supports Oregon and Minnesota.
- Uses an instruction PDF as the extraction source.
- Requires manual entry of the tax-table start and end pages.
- Uses deterministic PDF parsers for supported states.
- Shows a review screen before writing JSON updates.
- Updates the selected JSON table files and the `Year` field.

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
3. Select the tax year and regulatory folder year.
4. Configure or confirm the JSON file paths.
5. Click `Select PDF` and choose the instruction booklet.
6. Enter the PDF start and end tax-table pages manually.
7. Run extraction.
8. Review changes by filing-status tab.
9. Update the JSON files.

## PDF Workflow Notes

- Select only supported Oregon or Minnesota PDFs.
- Enter only the tax-table page range you want parsed.
- Extraction uses deterministic PDF text parsing.
- Review the extracted diffs before updating the JSON files.

## Project Structure

- [main.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/main.js): Electron main process and IPC handlers
- [preload.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/preload.js): safe renderer bridge
- [renderer.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/renderer.js): UI, extraction flow, deterministic parsers, diff review
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

### App does not start
- Run `npm install` again.
- Check the console output for Electron startup errors.

## Version

- App version: `2.0.0`
- Supported deterministic PDF parser states: `OR`, `MN`
