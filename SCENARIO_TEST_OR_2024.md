# OR 2024 Extraction Scenario Test

## Purpose
Verify that the app can extract the full Oregon 2024 OR-40 tax table from the three reference screenshots using the current OpenAI-based strip extraction flow.

## Test Type
Manual scenario test

## State Under Test
- State: Oregon (`OR`)
- Form: OR-40
- Filing status columns:
  - `S` = Single / Married Filing Separately
  - `J` = Married Jointly / Head of Household / Surviving Spouse

## Test Data
Use these three screenshots in this order:
1. OR screenshot 1: ranges `$0` through `$18,900`
2. OR screenshot 2: ranges `$19,000` through `$38,900`
3. OR screenshot 3: ranges `$39,000` through `$49,900`

## Preconditions
- The app starts successfully.
- A valid OpenAI API key is saved in Settings.
- State is set to `Oregon`.
- The OR JSON file paths are configured.
- The screenshots are available locally.

## Steps
1. Launch the app.
2. Select state `Oregon`.
3. Select the correct tax year and regulatory folder year for the test.
4. Click `Select Images`.
5. Choose the three OR screenshots for 2024.
6. Confirm all three screenshots appear in the preview.
7. Click `Extract Data from Images`.
8. Wait for extraction, strip processing, and diff review to complete.
9. Open the review tab for `Single` and `Joint`.
10. Verify the extraction summary and checkpoint values below.

## Expected Results
- Extraction completes without an error toast.
- No `Missed by extraction` warning is shown.
- Extracted range covers `$0` through `$49,900`.
- Both Oregon filing statuses are present in the extracted result.
- The table includes the irregular starting brackets `0`, `20`, and `50`.
- The final bracket `49,900 - 50,000` is included.

## Expected Coverage
Expected lower-boundary keys for OR 2024:
- `0`
- `20`
- `50`
- `100` through `49,900` in increments of `100`

Expected row count per filing status:
- `502` rows for `S`
- `502` rows for `J`

## Checkpoint Assertions
Verify these extracted values are present:

### Beginning of table
- `0` -> `S=0`, `J=0`
- `20` -> `S=2`, `J=2`
- `50` -> `S=4`, `J=4`
- `100` -> `S=7`, `J=7`

### Early-page checkpoints
- `4,000` -> `S=192`, `J=192`
- `9,000` -> `S=525`, `J=439`
- `14,000` -> `S=928`, `J=777`
- `18,900` -> `S=1357`, `J=1108`

### Middle-page checkpoints
- `19,000` -> `S=1365`, `J=1114`
- `24,000` -> `S=1803`, `J=1503`
- `29,000` -> `S=2240`, `J=1941`
- `34,000` -> `S=2678`, `J=2378`
- `38,900` -> `S=3107`, `J=2807`

### Final-page checkpoints
- `39,000` -> `S=3115`, `J=2816`
- `42,000` -> `S=3378`, `J=3078`
- `45,000` -> `S=3640`, `J=3341`
- `47,900` -> `S=3894`, `J=3594`
- `49,900` -> `S=4069`, `J=3769`

## Pass Criteria
The scenario passes if all of the following are true:
- Extraction finishes successfully.
- No extraction-gap warning appears.
- Coverage reaches `$49,900`.
- The checkpoint values above match exactly.
- No conflicting-merge error occurs across strips.

## Failure Examples
The scenario fails if any of the following occur:
- Extraction stops with an error toast.
- `Missed by extraction` is greater than `0`.
- The highest extracted key is less than `49,900`.
- Any checkpoint value is wrong for `S` or `J`.
- Duplicate/conflicting strip merge errors occur.

## Notes
- This scenario is designed to validate the current OpenAI extraction flow that splits each uploaded screenshot into four overlapping vertical strips.
- If the OR source screenshots change, update the checkpoint assertions to match the new table.
