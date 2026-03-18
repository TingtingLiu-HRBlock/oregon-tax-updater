# State Tax Table Updater

Desktop Electron app for extracting state tax table values from official instruction PDFs or screenshots and updating the corresponding JSON table files.

## What It Does

- Supports multiple states through state-specific config.
- Lets you choose either screenshots or an instruction PDF as the source.
- Can auto-detect the tax table page range from the PDF contents page when config is missing.
- Lets you manually override PDF start and end pages.
- Shows a review screen before writing JSON updates.
- Updates the configured JSON table files and the `Year` field.

## Current Extraction Modes

### Deterministic PDF Parser
Used when the source is a PDF for these states:
- Oregon (`OR`)
- Minnesota (`MN`)

This path does not require an OpenAI API key.

### OpenAI Vision Fallback
Used for:
- screenshot-based extraction
- states that do not yet have a deterministic PDF parser

This path requires an OpenAI API key in Settings.

## Supported State Setups

### Oregon
- Filing statuses:
  - `S` = Single / Married Filing Separately
  - `J` = Married Jointly / Head of Household / Surviving Spouse
- 2024 PDF tax-table page range:
  - `26-28`
- Deterministic PDF parser:
  - Yes

### Minnesota
- Filing statuses:
  - `Single`
  - `MFJ` = Married Jointly / Qualifying Surviving Spouse
  - `MFS` = Married Filing Separately
  - `HOH` = Head of Household
- 2024 PDF tax-table page range:
  - `30-36`
- Deterministic PDF parser:
  - Yes

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
5. Choose one source type:
   - `Select PDF` for an instruction booklet
   - `Select Images` for screenshots
6. If using a PDF:
   - confirm the detected or configured page range
   - or manually override the page range
7. Run extraction.
8. Review changes by filing-status tab.
9. Update the JSON files.

## PDF Workflow Notes

- The app does not need to send the entire PDF to a model.
- It selects only the relevant tax-table pages.
- When available, the app uses a deterministic parser directly on PDF text positions.
- When no built-in page range exists, the app can look for contents-page text such as `Tax Tables 30-36`.
- You can always override the PDF page range manually.

## Screenshot Workflow Notes

- Screenshot extraction is still supported.
- Screenshot extraction currently uses the OpenAI path.
- State-specific slicing rules are applied before extraction.

## Project Structure

- [main.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/main.js): Electron main process and IPC handlers
- [preload.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/preload.js): safe renderer bridge
- [renderer.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/renderer.js): UI, extraction flow, PDF rendering, deterministic parsers, diff review
- [States/OR.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/States/OR.js): Oregon state config
- [States/MN.js](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/States/MN.js): Minnesota state config

## Manual Scenario Tests

- [SCENARIO_TEST_OR_2024.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_OR_2024.md)
- [SCENARIO_TEST_OR_2024_PDF.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_OR_2024_PDF.md)
- [SCENARIO_TEST_MN_2024_PDF.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_MN_2024_PDF.md)
- [SCENARIO_TEST_REVIEW_TABS.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_REVIEW_TABS.md)
- [SCENARIO_TEST_PDF_PAGE_RANGE.md](/c:/Users/A897115/projects/ORAgents/oregon-tax-updater/oregon-tax-updater/SCENARIO_TEST_PDF_PAGE_RANGE.md)

## Troubleshooting

### PDF page range is wrong
- Check the configured range for the selected state and year.
- Try the contents-page auto-detected range.
- Override the start and end pages manually.

### Extraction requires an API key
- That is expected for screenshot extraction.
- For Oregon and Minnesota PDFs, the deterministic parser path should work without an OpenAI key.

### JSON files do not update
- Verify the JSON paths are correct.
- Verify you have write permission for the target folders.
- Verify the selected state matches the selected JSON table set.

### App does not start
- Run `npm install` again.
- Check the console output for Electron startup errors.

## Version

- App version: `2.0.0`
- Current deterministic PDF parser states: `OR`, `MN`
