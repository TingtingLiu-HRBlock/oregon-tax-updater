# PDF Page Range Manual Entry Scenario Test

## Purpose
Verify that the app accepts an instruction PDF, requires manual tax-table page input, and uses the entered page range for deterministic extraction and review.

## Test Type
Manual scenario test

## Scope
- PDF file selection
- Manual PDF start/end page entry
- PDF page-range summary rendering
- Deterministic extraction into the review flow

## State Under Test
- Primary state: Minnesota (`MN`)
- Form: M1
- Tax year: `2024`
- Known tax table range for this scenario: pages `30-36`

## Test Data
Use the Minnesota instruction PDF that contains the 2024 tax table pages.

Reference file used during development:
- `MN_m1-inst-24_final_2-23-26.pdf`

## Preconditions
- The app starts successfully.
- State is set to `Minnesota`.
- The MN JSON file paths are configured.
- The Minnesota instruction PDF is available locally.
- The tester knows the correct tax-table page range to enter.

## Scenario A: Required Manual Entry
### Steps
1. Launch the app.
2. Select state `Minnesota`.
3. Select tax year `2024`.
4. Click `Select PDF`.
5. Choose the Minnesota instruction PDF.
6. Confirm the PDF summary asks for required start/end page input.
7. Confirm `Extract Data` stays disabled until both page inputs are valid.
8. Enter start page `30` and end page `36`.
9. Confirm the PDF summary updates to show pages `30-36`.
10. Click `Extract Data from PDF`.
11. Wait for extraction and diff review to complete.

### Expected Results
- The PDF is accepted without error.
- The page range is not prefilled automatically.
- Extraction remains unavailable until a valid page range is entered.
- Extraction completes without an error toast.
- The review section appears with Minnesota filing statuses and diff data.

## Scenario B: Invalid Manual Range
### Steps
1. Start from a selected PDF with visible page range inputs.
2. Enter an invalid range such as start page `36` and end page `30`.
3. Confirm extraction remains disabled.
4. Correct the range back to `30-36`.
5. Confirm extraction becomes available again.

### Expected Results
- Invalid page ranges do not enable extraction.
- Correcting the range immediately re-enables extraction.
- The summary reflects the corrected manual range.

## Pass Criteria
The scenario passes if all of the following are true:
- Selecting a PDF shows the PDF summary and page inputs.
- The app requires manual entry of the page range.
- Invalid ranges do not allow extraction.
- A valid manual range allows extraction to proceed successfully.

## Failure Examples
The scenario fails if any of the following occur:
- Selecting a PDF does not show the page range controls.
- The app fills the page range automatically.
- Extraction is enabled before a valid page range is entered.
- Extraction does not use the entered manual page range.

## Notes
- This scenario should be rerun whenever PDF selection, page-range handling, or deterministic PDF parsing changes.
