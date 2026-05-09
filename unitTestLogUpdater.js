const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { parseRelaxedJson } = require('./relaxedJson');
const { serializeTestJson } = require('./unitTestDateRoller');

function sanitizeTestNamePart(value) {
  return String(value ?? '').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function buildMethodPrefix(stateCode, testFilePath, rootPath) {
  const relative = path.relative(rootPath, testFilePath).replace(/\\/g, '/').replace(/\.test\.json$/i, '');
  return `${stateCode}_${relative.replace(/[/.]+/g, '_')}`;
}

async function collectTestJsonFiles(rootPath) {
  const found = [];
  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (['bin', 'obj', 'node_modules', '.git'].includes(entry.name)) continue;
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.test.json')) {
        found.push(fullPath);
      }
    }
  }
  await walk(rootPath);
  return found;
}

async function getLatestLogPath(regulatoryYear) {
  const logRoot = path.join(os.tmpdir(), `Omnistudio-${regulatoryYear}`, 'log');
  const entries = await fs.readdir(logRoot, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter(entry => entry.isFile())
    .map(async entry => {
      const fullPath = path.join(logRoot, entry.name);
      const stat = await fs.stat(fullPath);
      return { fullPath, mtimeMs: stat.mtimeMs };
    }));
  files.sort((left, right) => right.mtimeMs - left.mtimeMs);
  if (!files.length) {
    throw new Error(`No log files found under ${logRoot}.`);
  }
  return files[0].fullPath;
}

function getLatestFailedRunLines(logText, stateCode = '') {
  const lines = String(logText || '').split(/\r?\n/);
  const statePattern = stateCode ? new RegExp(`\\b${stateCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_`, 'i') : null;
  const summaryIndexes = lines
    .map((line, index) => /Failed!\s+-\s+Failed:\s+\d+/i.test(line) ? index : -1)
    .filter(index => index >= 0)
    .filter(index => {
      if (!statePattern) return true;
      let startIndex = 0;
      for (let lineIndex = index; lineIndex >= 0; lineIndex--) {
        if (/Starting test execution/i.test(lines[lineIndex]) || /Preparing unit tests execution/i.test(lines[lineIndex])) {
          startIndex = lineIndex;
          break;
        }
      }
      return lines.slice(startIndex, index + 1).some(line => statePattern.test(line));
    });
  const summaryIndex = summaryIndexes.pop();
  if (summaryIndex === undefined) {
    return [];
  }
  let startIndex = 0;
  for (let index = summaryIndex; index >= 0; index--) {
    if (/Starting test execution/i.test(lines[index]) || /Preparing unit tests execution/i.test(lines[index])) {
      startIndex = index;
      break;
    }
  }
  return lines.slice(startIndex, summaryIndex + 1);
}

function parseFailureAssertions(logText, stateCode = '') {
  const lines = getLatestFailedRunLines(logText, stateCode);
  const failures = [];
  let current = null;

  for (const line of lines) {
    const failedMatch = line.match(/\bFailed\s+([A-Z]{2,3}_[^\s\[]+)/);
    if (failedMatch && stateCode && !failedMatch[1].startsWith(`${stateCode}_`)) {
      current = null;
      continue;
    }
    if (failedMatch) {
      current = { testName: failedMatch[1] };
      continue;
    }
    if (!current) {
      continue;
    }
    const assertMatch = line.match(/Expected:<([\s\S]*?)>\.\s+Actual:<([\s\S]*?)>\./);
    if (assertMatch) {
      const indexMatch = line.match(/Element at index\s+(\d+)/i);
      failures.push({
        testName: current.testName,
        expectedRaw: assertMatch[1],
        actualRaw: assertMatch[2],
        elementIndex: indexMatch ? Number(indexMatch[1]) : null
      });
      current = null;
    }
  }

  return failures;
}

function findMatchingTestCase(testJson, caseName) {
  const cases = Array.isArray(testJson)
    ? testJson.map((testCase, index) => ({ testCase, pathParts: [index] }))
    : [{ testCase: testJson, pathParts: [] }];
  const sanitizedCase = sanitizeTestNamePart(caseName);
  return cases.find(candidate => String(candidate.testCase?.name) === caseName)
    || cases.find(candidate => sanitizeTestNamePart(candidate.testCase?.name) === sanitizedCase)
    || null;
}

function convertLogValue(rawValue, currentValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (/^\(Is Blank\)$/i.test(trimmed)) {
    return currentValue === null ? null : '';
  }
  if (/^\(Not Blank\)$/i.test(trimmed)) {
    return Symbol.for('unit-test-log-not-blank');
  }
  if (/^Blank$/i.test(trimmed)) {
    return currentValue === null ? null : currentValue === 'Blank' ? 'Blank' : '';
  }
  if (typeof currentValue === 'number') {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : trimmed;
  }
  if (typeof currentValue === 'boolean') {
    return /^true$/i.test(trimmed);
  }
  if (typeof currentValue === 'string') {
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)?$/i);
    if (/^\d{4}-\d{2}-\d{2}$/.test(currentValue) && dateMatch) {
      return `${dateMatch[3]}-${String(dateMatch[1]).padStart(2, '0')}-${String(dateMatch[2]).padStart(2, '0')}`;
    }
  }
  return trimmed;
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isNumericArrayOutputType(type) {
  return typeof type === 'string' && /^(decimal|int|integer)(\[\])+$/i.test(type.trim());
}

function parseCommaSeparatedNumericArray(rawValue, type) {
  const trimmed = String(rawValue ?? '').trim();
  if (!isNumericArrayOutputType(type) || !trimmed.includes(',')) {
    return null;
  }
  const parts = trimmed.split(',').map(part => part.trim());
  if (!parts.length || parts.some(part => !part || !Number.isFinite(Number(part)))) {
    return null;
  }
  return parts.map(part => Number(part));
}

function isNullOnlyLogValue(rawValue) {
  return /^\(null\)$/i.test(String(rawValue ?? '').trim());
}

function isBlankLogValue(rawValue) {
  return /^\(Is Blank\)$/i.test(String(rawValue ?? '').trim())
    || /^Blank$/i.test(String(rawValue ?? '').trim());
}

function isStringLikeOutputType(type) {
  return typeof type === 'string' && /^(string|datetime)(\[\])*$/i.test(type.trim());
}

function isUnsafeBlankEnumLikeUpdate(output, proposedValue, rawValue) {
  return proposedValue === ''
    && isBlankLogValue(rawValue)
    && !isStringLikeOutputType(output?.type || '');
}

function getValueAtPathParts(root, pathParts) {
  return pathParts.reduce((current, part) => current?.[part], root);
}

function isSafeBlankOutputValue(value) {
  return value === null
    || value === false
    || (typeof value === 'string' && /^(Blank|None|No|False)$/i.test(value.trim()));
}

function findSiblingBlankOutputValue(testJson, currentTestCase, output, pathParts = []) {
  for (const testCase of getTestCases(testJson)) {
    if (!testCase || testCase === currentTestCase) {
      continue;
    }
    const candidateOutput = testCase.output;
    if (!outputsDescribeSameCalc(candidateOutput, output)) {
      continue;
    }
    const candidateValue = getValueAtPathParts(candidateOutput?.value, pathParts);
    if (isSafeBlankOutputValue(candidateValue)) {
      return { found: true, value: candidateValue };
    }
  }
  return { found: false };
}

function flattenScalarPaths(value, pathParts = []) {
  if (!Array.isArray(value)) {
    return [{ pathParts, value }];
  }
  return value.flatMap((item, index) => flattenScalarPaths(item, [...pathParts, index]));
}

function getTestCases(testJson) {
  return Array.isArray(testJson) ? testJson : [testJson];
}

function outputsDescribeSameCalc(left, right) {
  return Boolean(left && right)
    && String(left.entity || '') === String(right.entity || '')
    && String(left.form || '') === String(right.form || '')
    && String(left.field || '') === String(right.field || '')
    && String(left.type || '') === String(right.type || '')
    && String(left.tomType || '') === String(right.tomType || '');
}

function hasSiblingNullOutput(testJson, currentTestCase, output) {
  return getTestCases(testJson).some(testCase => {
    if (!testCase || testCase === currentTestCase) {
      return false;
    }
    const candidateOutput = testCase.output;
    return candidateOutput?.value === null && outputsDescribeSameCalc(candidateOutput, output);
  });
}

function hasSameCaseNullableInput(currentTestCase, output) {
  const inputs = Array.isArray(currentTestCase?.inputs) ? currentTestCase.inputs : [];
  return inputs.some(input => {
    return input?.value === null
      && String(input.entity || '') === String(output?.entity || '')
      && String(input.form || '') === String(output?.form || '')
      && String(input.type || '') === String(output?.type || '')
      && String(input.tomType || '') === String(output?.tomType || '');
  });
}

function buildInputEditCandidates(testCase, pathParts) {
  const inputs = Array.isArray(testCase?.inputs) ? testCase.inputs : [];
  return inputs
    .map((input, index) => ({ input, index }))
    .map(({ input, index }) => ({
      label: [input.form, input.field].filter(Boolean).join('/') || `Input ${index + 1}`,
      fieldPath: [...pathParts, 'inputs', index].join('.'),
      valuePath: [...pathParts, 'inputs', index, 'value'].join('.'),
      type: input.type || '',
      tomType: input.tomType || '',
      currentValue: input.value
    }));
}

function setValueAtPath(root, valuePath, nextValue) {
  const parts = valuePath.split('.');
  let current = root;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = /^\d+$/.test(parts[index]) ? Number(parts[index]) : parts[index];
    current = current[part];
    if (current === undefined) {
      throw new Error(`Path not found: ${valuePath}`);
    }
  }
  const lastPart = /^\d+$/.test(parts[parts.length - 1]) ? Number(parts[parts.length - 1]) : parts[parts.length - 1];
  current[lastPart] = nextValue;
}

function buildFailureRow(failure, filePath, testJson) {
  const prefix = failure.prefix;
  const caseName = failure.testName === prefix ? '' : failure.testName.slice(prefix.length + 1);
  const match = findMatchingTestCase(testJson, caseName);
  if (!match) {
    return { ...failure, filePath, caseName, canApply: false, reason: `Could not find a unique test case named ${caseName}.` };
  }
  const output = match.testCase?.output;
  if (!output || !Object.prototype.hasOwnProperty.call(output, 'value')) {
    return { ...failure, filePath, caseName, canApply: false, reason: 'Matched test case has no output.value.' };
  }

  const basePath = [...match.pathParts, 'output', 'value'].join('.');
  const fieldPath = [...match.pathParts, 'output'].join('.') || 'output';
  const calcFieldPath = `${output.entity || ''}/${output.form || ''}/${output.field || ''}`;
  const inputCandidates = buildInputEditCandidates(match.testCase, match.pathParts);
  const buildManualOutputRow = (reason, options = {}) => ({
    ...failure,
    filePath,
    calcFieldPath,
    caseName,
    fieldPath,
    valuePath: options.valuePath || basePath,
    type: output.type || '',
    tomType: output.tomType || '',
    constantName: 'Runtime actual from unit test log',
    currentValue: options.currentValue !== undefined ? options.currentValue : output.value,
    proposedValue: '',
    inputCandidates,
    canApply: false,
    reason
  });
  if (isNullOnlyLogValue(failure.actualRaw)) {
    const canInferNull = !Array.isArray(output.value)
      && (hasSiblingNullOutput(testJson, match.testCase, output) || hasSameCaseNullableInput(match.testCase, output));
    if (canInferNull) {
      const expectedValue = convertLogValue(failure.expectedRaw, output.value);
      if (valuesEqual(output.value, expectedValue)) {
        return {
          ...failure,
          rowKind: 'logOutput',
          filePath,
          calcFieldPath,
          caseName,
          fieldPath,
          valuePath: basePath,
          type: output.type || '',
          tomType: output.tomType || '',
          constantName: 'Runtime actual from unit test log',
          currentValue: output.value,
          proposedValue: null,
          inputCandidates,
          canApply: true,
          reason: 'Null output inferred from nullable test context.'
        };
      }
      return buildManualOutputRow('Current output no longer matches the log expected value.');
    }
    return buildManualOutputRow('Log actual value is null; skipping automatic update to avoid invalid generated tests.');
  }

  if (Array.isArray(output.value)) {
    const expectedArray = !Number.isInteger(failure.elementIndex)
      ? parseCommaSeparatedNumericArray(failure.expectedRaw, output.type)
      : null;
    const proposedArray = !Number.isInteger(failure.elementIndex)
      ? parseCommaSeparatedNumericArray(failure.actualRaw, output.type)
      : null;
    if (expectedArray && proposedArray) {
      if (!valuesEqual(output.value, expectedArray)) {
        return buildManualOutputRow('Current output no longer matches the log expected value.');
      }
      return {
        ...failure,
        rowKind: 'logOutput',
        filePath,
        calcFieldPath,
        caseName,
        fieldPath,
        valuePath: basePath,
        type: output.type || '',
        tomType: output.tomType || '',
        constantName: 'Runtime actual from unit test log',
        currentValue: output.value,
        proposedValue: proposedArray,
        inputCandidates,
        canApply: true,
        reason: ''
      };
    }

    const scalarPaths = flattenScalarPaths(output.value);
    if (proposedArray && scalarPaths.length === 1) {
      const currentElement = scalarPaths[0].value;
      const expectedValue = convertLogValue(failure.expectedRaw, currentElement);
      if (!valuesEqual(currentElement, expectedValue)) {
        return buildManualOutputRow('Current output no longer matches the log expected value.');
      }
      return {
        ...failure,
        rowKind: 'logOutput',
        filePath,
        calcFieldPath,
        caseName,
        fieldPath,
        valuePath: basePath,
        type: output.type || '',
        tomType: output.tomType || '',
        constantName: 'Runtime actual from unit test log',
        currentValue: output.value,
        proposedValue: proposedArray,
        inputCandidates,
        canApply: true,
        reason: ''
      };
    }

    const scalarMatch = Number.isInteger(failure.elementIndex)
      ? scalarPaths[failure.elementIndex]
      : scalarPaths.length === 1 ? scalarPaths[0] : null;
    if (!scalarMatch) {
      return buildManualOutputRow('Could not safely choose an output array element.');
    }
    const currentElement = scalarMatch.value;
    const expectedValue = convertLogValue(failure.expectedRaw, currentElement);
    const proposedElement = convertLogValue(failure.actualRaw, currentElement);
    if (typeof proposedElement === 'symbol') {
      return buildManualOutputRow('Log actual value only says the output is not blank.');
    }
    if (isUnsafeBlankEnumLikeUpdate(output, proposedElement, failure.actualRaw)) {
      const siblingBlank = findSiblingBlankOutputValue(testJson, match.testCase, output, scalarMatch.pathParts);
      if (siblingBlank.found) {
        if (!valuesEqual(currentElement, expectedValue)) {
          return buildManualOutputRow('Current output no longer matches the log expected value.', {
            valuePath: [basePath, ...scalarMatch.pathParts].join('.'),
            currentValue: currentElement
          });
        }
        return {
          ...failure,
          rowKind: 'logOutput',
          filePath,
          calcFieldPath,
          caseName,
          fieldPath,
          valuePath: [basePath, ...scalarMatch.pathParts].join('.'),
          type: output.type || '',
          tomType: output.tomType || '',
          constantName: 'Runtime actual from unit test log',
          currentValue: currentElement,
          proposedValue: siblingBlank.value,
          inputCandidates,
          canApply: true,
          reason: 'Blank output inferred from sibling test case.'
        };
      }
      return buildManualOutputRow('Log actual value is blank for a non-string output type; review to avoid invalid generated enum syntax.', {
        valuePath: [basePath, ...scalarMatch.pathParts].join('.'),
        currentValue: currentElement
      });
    }
    if (!valuesEqual(currentElement, expectedValue)) {
      return buildManualOutputRow('Current output no longer matches the log expected value.', {
        valuePath: [basePath, ...scalarMatch.pathParts].join('.'),
        currentValue: currentElement
      });
    }
    return {
      ...failure,
      rowKind: 'logOutput',
      filePath,
      calcFieldPath,
      caseName,
      fieldPath,
      valuePath: [basePath, ...scalarMatch.pathParts].join('.'),
      type: output.type || '',
      tomType: output.tomType || '',
      constantName: 'Runtime actual from unit test log',
      currentValue: currentElement,
      proposedValue: proposedElement,
      inputCandidates,
      canApply: true,
      reason: ''
    };
  }

  const expectedValue = convertLogValue(failure.expectedRaw, output.value);
  const proposedValue = convertLogValue(failure.actualRaw, output.value);
  if (typeof proposedValue === 'symbol') {
    return buildManualOutputRow('Log actual value only says the output is not blank.');
  }
  if (isUnsafeBlankEnumLikeUpdate(output, proposedValue, failure.actualRaw)) {
    const siblingBlank = findSiblingBlankOutputValue(testJson, match.testCase, output);
    if (siblingBlank.found) {
      if (!valuesEqual(output.value, expectedValue)) {
        return buildManualOutputRow('Current output no longer matches the log expected value.');
      }
      return {
        ...failure,
        rowKind: 'logOutput',
        filePath,
        calcFieldPath,
        caseName,
        fieldPath,
        valuePath: basePath,
        type: output.type || '',
        tomType: output.tomType || '',
        constantName: 'Runtime actual from unit test log',
        currentValue: output.value,
        proposedValue: siblingBlank.value,
        inputCandidates,
        canApply: true,
        reason: 'Blank output inferred from sibling test case.'
      };
    }
    return buildManualOutputRow('Log actual value is blank for a non-string output type; review to avoid invalid generated enum syntax.');
  }
  if (!valuesEqual(output.value, expectedValue)) {
    return buildManualOutputRow('Current output no longer matches the log expected value.');
  }
  return {
    ...failure,
    rowKind: 'logOutput',
    filePath,
    calcFieldPath,
    caseName,
    fieldPath,
    valuePath: basePath,
    type: output.type || '',
    tomType: output.tomType || '',
    constantName: 'Runtime actual from unit test log',
    currentValue: output.value,
    proposedValue,
    inputCandidates,
    canApply: true,
    reason: ''
  };
}

async function buildLogUpdatePreview({ rootPath, stateCode, logPath, regulatoryYear }) {
  const effectiveLogPath = logPath || await getLatestLogPath(regulatoryYear);
  const logText = await fs.readFile(effectiveLogPath, 'utf-8');
  const failures = parseFailureAssertions(logText, stateCode);
  const testFiles = await collectTestJsonFiles(rootPath);
  const prefixes = testFiles
    .map(filePath => ({ filePath, prefix: buildMethodPrefix(stateCode, filePath, rootPath) }))
    .sort((left, right) => right.prefix.length - left.prefix.length);
  const rows = [];

  for (const failure of failures) {
    const matched = prefixes.find(candidate => failure.testName === candidate.prefix || failure.testName.startsWith(`${candidate.prefix}_`));
    if (!matched) {
      rows.push({ ...failure, filePath: '', caseName: '', canApply: false, reason: 'Could not map failed test name to a unit test JSON file.' });
      continue;
    }
    const raw = await fs.readFile(matched.filePath, 'utf-8');
    const testJson = parseRelaxedJson(raw);
    rows.push(buildFailureRow({ ...failure, prefix: matched.prefix }, matched.filePath, testJson));
  }

  return {
    success: true,
    logPath: effectiveLogPath,
    failureCount: failures.length,
    updateCount: rows.filter(row => row.canApply).length,
    reviewCount: rows.filter(row => !row.canApply).length,
    rows
  };
}

async function applyLogUpdateRows(rows) {
  const rowsByFile = new Map();
  for (const row of rows.filter(candidate => candidate?.canApply && candidate.filePath && (candidate.valuePath || candidate.updates?.length))) {
    if (!rowsByFile.has(row.filePath)) rowsByFile.set(row.filePath, []);
    rowsByFile.get(row.filePath).push(row);
  }
  if (!rowsByFile.size) {
    throw new Error('No log-derived output rows were eligible for automatic update.');
  }

  let updatedFileCount = 0;
  let updatedValueCount = 0;
  for (const [filePath, fileRows] of rowsByFile.entries()) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = parseRelaxedJson(raw);
    let fileUpdateCount = 0;
    fileRows.forEach(row => {
      const updates = Array.isArray(row.updates) && row.updates.length
        ? row.updates
        : [{ valuePath: row.valuePath, proposedValue: row.proposedValue }];
      updates.forEach(update => {
        setValueAtPath(parsed, update.valuePath, update.proposedValue);
        fileUpdateCount += 1;
      });
    });
    await fs.writeFile(filePath, serializeTestJson(parsed), 'utf-8');
    updatedFileCount++;
    updatedValueCount += fileUpdateCount;
  }
  return { success: true, updatedFileCount, updatedValueCount };
}

module.exports = {
  parseFailureAssertions,
  buildMethodPrefix,
  buildLogUpdatePreview,
  applyLogUpdateRows,
  convertLogValue
};
