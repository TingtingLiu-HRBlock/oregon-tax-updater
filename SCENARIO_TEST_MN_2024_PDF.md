# MN 2024 PDF Extraction Scenario Test

## Purpose
Verify that the app can extract the full Minnesota 2024 M1 tax table from the instruction PDF using the deterministic PDF parser, and produce correct values for all four filing statuses.

## Test Type
Manual scenario test

## State Under Test
- State: Minnesota (`MN`)
- Form: M1
- Filing status columns:
  - `Single` = Single
  - `MFJ` = Married Jointly / Qualifying Surviving Spouse
  - `MFS` = Married Filing Separately
  - `HOH` = Head of Household

## Test Data
Use the Minnesota instruction PDF for 2024:
- `MN_m1-inst-24_final_2-23-26.pdf`

Expected tax table page range:
- `30-36`

## Preconditions
- The app starts successfully.
- State is set to `Minnesota`.
- The MN JSON file paths are configured.
- The Minnesota instruction PDF is available locally.
- The tester knows the correct PDF page range is `30-36` and will enter it manually.

## Steps
1. Launch the app.
2. Select state `Minnesota`.
3. Select tax year `2024`.
4. Click `Select PDF`.
5. Choose the Minnesota instruction PDF.
6. Enter page range `30-36`.
7. Click `Extract Data from PDF`.
8. Wait for extraction and diff review to complete.
9. Open the review tabs for `Single`, `MFJ & QW`, `MFS`, and `HOH`.
10. Verify the extraction summary and checkpoint values below.

## Expected Results
- Extraction completes without an error toast.
- No conflicting-merge error occurs.
- The review section appears for all four Minnesota filing statuses.
- The extracted values match the Minnesota 2024 instruction PDF.

## Checkpoint Assertions
Verify these extracted values are represented correctly in the review/update output:

### Beginning of table
- `0` -> `Single=0`, `MFJ=0`, `MFS=0`, `HOH=0`
- `20` -> `Single=3`, `MFJ=3`, `MFS=3`, `HOH=3`
- `100` -> `Single=8`, `MFJ=8`, `MFS=8`, `HOH=8`

### Mid-table checkpoints
- `12,700` -> `Single=682`, `MFJ=682`, `MFS=682`, `HOH=682`
- `19,100` -> `Single=1025`, `MFJ=1025`, `MFS=1025`, `HOH=1025`
- `23,200` -> `Single=1244`, `MFJ=1244`, `MFS=1245`, `HOH=1244`
- `23,300` -> `Single=1249`, `MFJ=1249`, `MFS=1252`, `HOH=1249`
- `44,700` -> `Single=2581`, `MFJ=2390`, `MFS=2701`, `HOH=2471`

### Late-table checkpoints
- `57,500` -> `Single=3454`, `MFJ=3242`, `MFS=3578`, `HOH=3348`
- `76,700` -> `Single=4760`, `MFJ=4547`, `MFS=4883`, `HOH=4653`
- `89,900` -> `Single=5657`, `MFJ=5445`, `MFS=5781`, `HOH=5551`

## Pass Criteria
The scenario passes if all of the following are true:
- Extraction finishes successfully from the PDF.
- The four filing-status tabs render correctly.
- The checkpoint values above match exactly.
- The `MFS` and `HOH` values at `23,200` are correct and not swapped or flattened.

## Failure Examples
The scenario fails if any of the following occur:
- Extraction stops with an error toast.
- `MFS` and `HOH` values are misread around `23,200`.
- One filing status column is copied into another.
- The review panel is missing one or more Minnesota filing statuses.

## Notes
- This scenario specifically covers the deterministic Minnesota PDF parser.
- It should be rerun whenever the Minnesota PDF parsing logic, page-range handling, or filing-status mapping changes.
- The `23,200` row is a key regression checkpoint because `MFS` should be `1245` while `HOH` should remain `1244`.
