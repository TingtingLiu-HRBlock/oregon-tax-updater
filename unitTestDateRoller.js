function getDependencyConstantName(dependency) {
  if (typeof dependency?.Constant === 'string' && dependency.Constant.trim()) {
    return dependency.Constant.trim();
  }
  if (typeof dependency?.FieldRef === 'string' && dependency.FieldRef.trim()) {
    return dependency.FieldRef.trim().split('/').pop();
  }
  return '';
}

function getConstantDependencies(calcJson, constantsByName) {
  return (calcJson?.Dependencies || [])
    .map((dependency, index) => {
      const constantName = getDependencyConstantName(dependency);
      return {
        dependency,
        dependencyIndex: index,
        placeholder: `{${index}}`,
        constantName,
        constantValue: constantName ? constantsByName[constantName] : undefined
      };
    })
    .filter(entry => entry.dependency?.FieldType === 'Constant' && entry.constantName && entry.constantValue !== undefined);
}

function getDirectReturnConstant(calcJson, constantsByName) {
  const constantDependencies = getConstantDependencies(calcJson, constantsByName);
  if (!constantDependencies.length) {
    return null;
  }

  const customScript = Array.isArray(calcJson?.Custom) ? calcJson.Custom.join('\n') : '';
  if (!customScript.trim()) {
    return null;
  }

  const returnExpressions = Array.from(customScript.matchAll(/return\s+([^;]+);/g))
    .map(match => match[1].trim())
    .filter(Boolean);
  if (!returnExpressions.length) {
    return null;
  }

  const nonNullExpressions = returnExpressions.filter(expression => expression !== 'null');
  if (!nonNullExpressions.length) {
    return null;
  }

  for (const entry of constantDependencies) {
    if (nonNullExpressions.every(expression => expression === entry.placeholder)) {
      return entry;
    }
  }

  return null;
}

function getDependencyEntries(calcJson, constantsByName, allConstantsByName = constantsByName) {
  return (calcJson?.Dependencies || [])
    .map((dependency, index) => {
      const constantName = getDependencyConstantName(dependency);
      return {
        dependency,
        dependencyIndex: index,
        placeholder: `{${index}}`,
        constantName,
        constantValue: constantName ? constantsByName[constantName] : undefined,
        anyConstantValue: constantName ? allConstantsByName[constantName] : undefined
      };
    });
}

function isInputLikeDependency(dependency) {
  return ['Calculated', 'Input', 'Linked'].includes(dependency?.FieldType);
}

function getConditionalReturnBranches(calcJson, constantsByName, allConstantsByName = constantsByName) {
  const entriesByPlaceholder = new Map(getDependencyEntries(calcJson, constantsByName, allConstantsByName).map(entry => [entry.placeholder, entry]));
  const lines = Array.isArray(calcJson?.Custom)
    ? calcJson.Custom.map(line => String(line).trim()).filter(Boolean)
    : [];
  const branches = [];

  for (let index = 0; index < lines.length - 2; index++) {
    const conditionMatch = lines[index].match(/^(if|else if)\s*\((\{\d+\})\s*==\s*(\{\d+\})\)$/);
    if (!conditionMatch || lines[index + 1] !== '{') {
      continue;
    }

    const returnMatch = lines[index + 2].match(/^return\s+(\{\d+\});$/);
    if (!returnMatch) {
      continue;
    }

    const inputDependency = entriesByPlaceholder.get(conditionMatch[2]);
    const compareDependency = entriesByPlaceholder.get(conditionMatch[3]);
    const returnDependency = entriesByPlaceholder.get(returnMatch[1]);
    if (!inputDependency || !compareDependency || !returnDependency) {
      continue;
    }
    if (compareDependency.dependency?.FieldType !== 'Constant' || returnDependency.dependency?.FieldType !== 'Constant') {
      continue;
    }
    if (compareDependency.anyConstantValue === undefined || returnDependency.constantValue === undefined) {
      continue;
    }

    branches.push({
      inputDependency,
      compareDependency,
      returnDependency
    });
  }

  return branches;
}

function buildInputConstantRelationship(left, right, mode, source) {
  if (!left || !right) {
    return null;
  }

  let inputDependency = null;
  let compareDependency = null;
  if (isInputLikeDependency(left.dependency) && right.dependency?.FieldType === 'Constant') {
    inputDependency = left;
    compareDependency = right;
  } else if (isInputLikeDependency(right.dependency) && left.dependency?.FieldType === 'Constant') {
    inputDependency = right;
    compareDependency = left;
  } else {
    return null;
  }

  if (compareDependency.constantValue === undefined) {
    return null;
  }

  return {
    inputDependency,
    compareDependency,
    mode,
    source
  };
}

function getInputConstantDateRelationships(calcJson, constantsByName) {
  const entriesByPlaceholder = new Map(getDependencyEntries(calcJson, constantsByName).map(entry => [entry.placeholder, entry]));
  const lines = Array.isArray(calcJson?.Custom)
    ? calcJson.Custom.map(line => String(line).trim()).filter(Boolean)
    : [];
  const relationships = [];
  const seen = new Set();

  function addRelationship(leftPlaceholder, rightPlaceholder, mode, source) {
    const relationship = buildInputConstantRelationship(
      entriesByPlaceholder.get(leftPlaceholder),
      entriesByPlaceholder.get(rightPlaceholder),
      mode,
      source
    );
    if (!relationship) {
      return;
    }

    const key = [
      relationship.inputDependency.placeholder,
      relationship.compareDependency.placeholder,
      relationship.mode,
      relationship.source
    ].join('|');
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    relationships.push(relationship);
  }

  for (const line of lines) {
    const conditionMatch = line.match(/^(if|else if)\s*\((.+)\)/);
    const expression = conditionMatch ? conditionMatch[2] : line;

    const comparisonMatches = Array.from(expression.matchAll(/(\{\d+\})\s*(==|<=|>=|<|>)\s*(\{\d+\})/g));
    for (const comparisonMatch of comparisonMatches) {
      addRelationship(comparisonMatch[1], comparisonMatch[3], comparisonMatch[2] === '==' ? 'exact' : 'offset', 'operator');
    }

    const yearComparisonMatches = Array.from(expression.matchAll(/DateTimeCalcHelpers\.YYYY\((\{\d+\})\)\s*(?:==|!=)\s*(\{\d+\})/g));
    for (const yearComparisonMatch of yearComparisonMatches) {
      addRelationship(yearComparisonMatch[1], yearComparisonMatch[2], 'yearCycle', 'yearComparison');
    }

    const dateMethodMatches = Array.from(expression.matchAll(/(\{\d+\})\.Is(?:OnOr)?(?:Before|After)\((\{\d+\})\)/g));
    for (const dateMethodMatch of dateMethodMatches) {
      addRelationship(dateMethodMatch[1], dateMethodMatch[2], 'offset', 'dateMethod');
    }

    const daysBetweenMatches = Array.from(expression.matchAll(/Calc\.DaysBetween\((\{\d+\}),\s*(\{\d+\})\)/g));
    for (const daysBetweenMatch of daysBetweenMatches) {
      addRelationship(daysBetweenMatch[1], daysBetweenMatch[2], 'offset', 'daysBetween');
    }

    const daysBetweenDateMethodMatches = Array.from(expression.matchAll(/Calc\.DaysBetween\((\{\d+\})\.(?:SubtractDays|AddDays)\(\d+\),\s*(\{\d+\})\)/g));
    for (const daysBetweenDateMethodMatch of daysBetweenDateMethodMatches) {
      addRelationship(daysBetweenDateMethodMatch[1], daysBetweenDateMethodMatch[2], 'offset', 'daysBetween');
    }

    const ageAsOfMatches = Array.from(expression.matchAll(/(\{\d+\})\.AgeAsOf\((\{\d+\})\)/g));
    for (const ageAsOfMatch of ageAsOfMatches) {
      addRelationship(ageAsOfMatch[1], ageAsOfMatch[2], 'ageAsOf', 'ageAsOf');
    }

  }

  const combinedScript = lines.join(' ');
  const combinedYearComparisonMatches = Array.from(combinedScript.matchAll(/DateTimeCalcHelpers\.YYYY\((\{\d+\})\)\s*(?:==|!=)\s*(\{\d+\})/g));
  for (const yearComparisonMatch of combinedYearComparisonMatches) {
    addRelationship(yearComparisonMatch[1], yearComparisonMatch[2], 'yearCycle', 'yearComparison');
  }

  return relationships;
}

function matchesCalcOutput(node, calcJson) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  if (typeof node.form !== 'string' || typeof node.field !== 'string' || typeof node.type !== 'string' || typeof node.tomType !== 'string') {
    return false;
  }

  const entityMatches = !node.entity || node.entity === calcJson?.Entity;
  const formMatches = !node.form || node.form === calcJson?.Form;
  const fieldMatches = !node.field || node.field === calcJson?.Field;
  const typeMatches = !node.type || node.type === calcJson?.Type;
  const nodeTomType = typeof node.tomType === 'string' ? node.tomType : '';
  const calcTomType = typeof calcJson?.TomType === 'string' ? calcJson.TomType : '';
  const stringTomTypeMatches = /^String/i.test(nodeTomType) && /^String/i.test(calcTomType);
  const tomTypeMatches = !nodeTomType || nodeTomType === calcTomType || stringTomTypeMatches;
  return entityMatches && formMatches && fieldMatches && typeMatches && tomTypeMatches;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item));
  }
  return value;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim();
}

function isStringMatrix(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(row => Array.isArray(row) && row.length > 0 && row.every(item => isNonEmptyString(item)));
}

function isBooleanMatrix(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(row => Array.isArray(row) && row.length > 0 && row.every(item => typeof item === 'boolean'));
}

function isNumericMatrix(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(row => Array.isArray(row) && row.length > 0 && row.every(item => Number.isFinite(Number(item))));
}

function fillMatrixShape(matrix, fillValue) {
  return matrix.map(row => Array.isArray(row) ? row.map(() => fillValue) : fillValue);
}

function flattenValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap(item => flattenValues(item));
  }
  return [value];
}

function isYearTomType(tomType) {
  return typeof tomType === 'string' && tomType.trim().toLowerCase() === 'year';
}

function deriveYearStringProposedValue(node, constantValue) {
  const parsed = Number.parseInt(constantValue, 10);
  if (!Number.isInteger(parsed)) {
    return { supported: false, reason: 'Constant value is not a supported year.' };
  }
  if (node.value === null || node.value === undefined || String(node.value).trim() === '') {
    return { supported: false, skip: true, reason: 'Current test value is blank or not a supported year.' };
  }
  if (!Number.isInteger(Number.parseInt(node.value, 10))) {
    return { supported: false, reason: 'Current test value is not a supported year.' };
  }
  return {
    supported: true,
    proposedValue: typeof node.value === 'number' ? parsed : String(parsed)
  };
}

function deriveProposedValue(node, constantValue) {
  if (node.type === 'bool' || node.type === 'boolean' || node.type === 'Checkbox') {
    if (typeof constantValue !== 'boolean') {
      return { supported: false, reason: 'Constant value is not a supported boolean.' };
    }
    return { supported: true, proposedValue: constantValue };
  }

  if (node.type === 'bool[]' || node.type === 'boolean[]' || node.type === 'Checkbox[]') {
    if (!Array.isArray(node.value) || node.value.length === 0) {
      return { supported: false, skip: true, reason: 'Current test value is null or an empty boolean array.' };
    }
    if (typeof constantValue !== 'boolean') {
      return { supported: false, reason: 'Constant value is not a supported boolean.' };
    }
    if (node.value.length !== 1) {
      return { supported: false, reason: 'Scalar boolean cannot safely replace a multi-value boolean[] test output.' };
    }
    return { supported: true, proposedValue: [constantValue] };
  }

  if (node.type === 'bool[][]' || node.type === 'boolean[][]' || node.type === 'Checkbox[][]') {
    if (!isBooleanMatrix(node.value)) {
      return { supported: false, skip: true, reason: 'Current test value is null or not a supported boolean matrix.' };
    }
    if (typeof constantValue !== 'boolean') {
      return { supported: false, reason: 'Constant value is not a supported boolean.' };
    }
    return { supported: true, proposedValue: fillMatrixShape(node.value, constantValue) };
  }

  if (node.type === 'decimal') {
    const parsed = Number(constantValue);
    if (!Number.isFinite(parsed)) {
      return { supported: false, reason: 'Constant value is not a supported decimal.' };
    }
    return { supported: true, proposedValue: parsed };
  }

  if (node.type === 'decimal[]') {
    if (!Array.isArray(node.value) || node.value.length === 0) {
      return { supported: false, skip: true, reason: 'Current test value is null or an empty decimal array.' };
    }
    if (Array.isArray(constantValue)) {
      if (constantValue.length !== node.value.length || !constantValue.every(value => Number.isFinite(Number(value)))) {
        return { supported: false, reason: 'Constant array does not match the current decimal array shape.' };
      }
      return { supported: true, proposedValue: constantValue.map(value => Number(value)) };
    }
    if (node.value.length !== 1) {
      return { supported: false, reason: 'Scalar constant cannot safely replace a multi-value decimal[] test output.' };
    }
    const parsed = Number(constantValue);
    if (!Number.isFinite(parsed)) {
      return { supported: false, reason: 'Constant value is not a supported decimal.' };
    }
    return { supported: true, proposedValue: [parsed] };
  }

  if (node.type === 'int' || node.type === 'integer') {
    const parsed = Number.parseInt(constantValue, 10);
    if (!Number.isFinite(parsed)) {
      return { supported: false, reason: 'Constant value is not a supported integer.' };
    }
    return { supported: true, proposedValue: parsed };
  }

  if (node.type === 'int[]' || node.type === 'integer[]') {
    if (!Array.isArray(node.value) || node.value.length === 0) {
      return { supported: false, skip: true, reason: 'Current test value is null or an empty integer array.' };
    }
    if (Array.isArray(constantValue)) {
      if (constantValue.length !== node.value.length || !constantValue.every(value => Number.isFinite(Number.parseInt(value, 10)))) {
        return { supported: false, reason: 'Constant array does not match the current integer array shape.' };
      }
      return { supported: true, proposedValue: constantValue.map(value => Number.parseInt(value, 10)) };
    }
    if (node.value.length !== 1) {
      return { supported: false, reason: 'Scalar constant cannot safely replace a multi-value integer[] test output.' };
    }
    const parsed = Number.parseInt(constantValue, 10);
    if (!Number.isFinite(parsed)) {
      return { supported: false, reason: 'Constant value is not a supported integer.' };
    }
    return { supported: true, proposedValue: [parsed] };
  }

  if (node.type === 'int[][]' || node.type === 'integer[][]') {
    if (!isNumericMatrix(node.value)) {
      return { supported: false, skip: true, reason: 'Current test value is null or not a supported integer matrix.' };
    }
    const parsed = Number.parseInt(constantValue, 10);
    if (!Number.isFinite(parsed)) {
      return { supported: false, reason: 'Constant value is not a supported integer.' };
    }
    return { supported: true, proposedValue: fillMatrixShape(node.value, parsed) };
  }

  if (node.type === 'string') {
    if (isYearTomType(node.tomType)) {
      return deriveYearStringProposedValue(node, constantValue);
    }
    if (typeof node.value !== 'string' || !node.value.trim()) {
      return { supported: false, skip: true, reason: 'Current test value is blank or not a string.' };
    }
    if (typeof constantValue !== 'string' || !constantValue.trim()) {
      return { supported: false, reason: 'Constant value is blank or not a string.' };
    }
    return { supported: true, proposedValue: constantValue };
  }

  if (node.type === 'string[]') {
    if (!Array.isArray(node.value) || node.value.length === 0) {
      return { supported: false, skip: true, reason: 'Current test value is null or an empty array.' };
    }

    if (Array.isArray(constantValue)) {
      if (!constantValue.every(item => typeof item === 'string' && item.trim())) {
        return { supported: false, reason: 'Constant array contains a blank or non-string value.' };
      }
      if (constantValue.length !== node.value.length) {
        return { supported: false, reason: 'Constant array length does not match the current test array length.' };
      }
      return { supported: true, proposedValue: cloneValue(constantValue) };
    }

    if (typeof constantValue === 'string' && constantValue.trim()) {
      if (node.value.length !== 1) {
        return { supported: false, reason: 'Scalar constant cannot safely replace a multi-value string[] test output.' };
      }
      return { supported: true, proposedValue: [constantValue] };
    }

    return { supported: false, reason: 'Constant value is blank or not a supported string value.' };
  }

  if (node.type === 'DateTime') {
    if (typeof node.value !== 'string' || !node.value.trim()) {
      return { supported: false, skip: true, reason: 'Current test value is blank or not a string.' };
    }
    if (typeof constantValue !== 'string' || !constantValue.trim()) {
      return { supported: false, reason: 'Constant value is blank or not a string.' };
    }
    return { supported: true, proposedValue: constantValue };
  }

  if (node.type === 'DateTime[]') {
    if (!Array.isArray(node.value) || node.value.length === 0) {
      return { supported: false, skip: true, reason: 'Current test value is null or an empty array.' };
    }

    if (Array.isArray(constantValue)) {
      if (!constantValue.every(item => typeof item === 'string' && item.trim())) {
        return { supported: false, reason: 'Constant array contains a blank or non-string value.' };
      }
      if (constantValue.length !== node.value.length) {
        return { supported: false, reason: 'Constant array length does not match the current test array length.' };
      }
      return { supported: true, proposedValue: cloneValue(constantValue) };
    }

    if (typeof constantValue === 'string' && constantValue.trim()) {
      if (node.value.length !== 1) {
        return { supported: false, reason: 'Scalar constant cannot safely replace a multi-value DateTime[] test output.' };
      }
      return { supported: true, proposedValue: [constantValue] };
    }

    return { supported: false, reason: 'Constant value is blank or not a supported date string.' };
  }

  if (node.type === 'string[][]') {
    if (!isStringMatrix(node.value)) {
      return { supported: false, skip: true, reason: 'Current test value is null, blank, or not a supported string matrix.' };
    }

    if (typeof constantValue === 'string' && constantValue.trim()) {
      return { supported: true, proposedValue: fillMatrixShape(node.value, constantValue) };
    }

    return { supported: false, reason: 'Constant value is blank or not a supported string value.' };
  }

  if (node.type === 'DateTime[][]') {
    if (!isStringMatrix(node.value)) {
      return { supported: false, skip: true, reason: 'Current test value is null, blank, or not a supported date matrix.' };
    }

    if (typeof constantValue === 'string' && constantValue.trim()) {
      return { supported: true, proposedValue: fillMatrixShape(node.value, constantValue) };
    }

    return { supported: false, reason: 'Constant value is blank or not a supported date string.' };
  }

  return { supported: false, reason: `Unsupported output type: ${node.type}` };
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseIsoDateParts(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (!match || (match[4] && !match[4].startsWith('T'))) {
    return null;
  }
  const datePart = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== datePart) {
    return null;
  }
  return {
    date,
    suffix: match[4] || ''
  };
}

function appendIsoDateSuffix(dateValue, suffixSource) {
  const parts = parseIsoDateParts(suffixSource);
  return parts?.suffix ? `${dateValue}${parts.suffix}` : dateValue;
}

function shiftIsoDateByYears(value, deltaYears) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return '';
  }
  const year = parts.date.getUTCFullYear() + deltaYears;
  const monthIndex = parts.date.getUTCMonth();
  const day = parts.date.getUTCDate();
  const shifted = new Date(Date.UTC(year, monthIndex, day));
  let shiftedDate;
  if (shifted.getUTCFullYear() !== year || shifted.getUTCMonth() !== monthIndex || shifted.getUTCDate() !== day) {
    const safe = new Date(Date.UTC(year, monthIndex + 1, 0));
    shiftedDate = safe.toISOString().slice(0, 10);
  } else {
    shiftedDate = shifted.toISOString().slice(0, 10);
  }
  return `${shiftedDate}${parts.suffix}`;
}

function parseIsoDate(value) {
  return parseIsoDateParts(value)?.date || null;
}

function addDays(value, days) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return '';
  }
  const date = new Date(parts.date.getTime());
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.toISOString().slice(0, 10)}${parts.suffix}`;
}

function daysBetween(startValue, endValue) {
  const start = parseIsoDate(startValue);
  const end = parseIsoDate(endValue);
  if (!start || !end) {
    return null;
  }
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function ageAsOf(birthValue, asOfValue) {
  const birthDate = parseIsoDate(birthValue);
  const asOfDate = parseIsoDate(asOfValue);
  if (!birthDate || !asOfDate) {
    return null;
  }
  let age = asOfDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayThisYear = Date.UTC(asOfDate.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate());
  if (asOfDate.getTime() < birthdayThisYear) {
    age--;
  }
  return age;
}

function addMonthsUtc(date, months) {
  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const shifted = new Date(Date.UTC(targetYear, targetMonth, day));
  if (shifted.getUTCDate() !== day) {
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 0));
  }
  return shifted;
}

function ageIsAsOf(birthValue, ageLimitValue, asOfValue) {
  const birthDate = parseIsoDate(birthValue);
  const asOfDate = parseIsoDate(asOfValue);
  const ageLimit = Number(ageLimitValue);
  if (!birthDate || !asOfDate || !Number.isFinite(ageLimit)) {
    return null;
  }
  const wholeYears = Math.trunc(ageLimit);
  const extraMonths = Math.round((ageLimit - wholeYears) * 12);
  const threshold = addMonthsUtc(new Date(Date.UTC(
    birthDate.getUTCFullYear() + wholeYears,
    birthDate.getUTCMonth(),
    birthDate.getUTCDate()
  )), extraMonths);
  return asOfDate.getTime() >= threshold.getTime();
}

function deriveInputBoundaryProposedValue(inputNode, constantValue, options = {}) {
  const allowOffset = options.allowOffset === true;

  function deriveDateValue(currentValue) {
    if (typeof currentValue !== 'string' || !currentValue.trim()) {
      return { supported: false, skip: true, reason: 'Current input value is blank or not a date string.' };
    }
    if (typeof constantValue !== 'string' || !constantValue.trim()) {
      return { supported: false, reason: 'Constant value is blank or not a date string.' };
    }
    const priorYearValue = shiftIsoDateByYears(constantValue, -1);
    if (!priorYearValue) {
      return { supported: false, reason: 'Constant value is not a supported YYYY-MM-DD date.' };
    }

    if (!allowOffset) {
      if (daysBetween(priorYearValue, currentValue) !== 0) {
        return { supported: false, skip: true, reason: 'Input does not match the prior-year boundary value.' };
      }
      return { supported: true, proposedValue: appendIsoDateSuffix(constantValue, currentValue) };
    }

    const offsetDays = daysBetween(priorYearValue, currentValue);
    if (offsetDays === null) {
      return { supported: false, skip: true, reason: 'Current input value is not a supported YYYY-MM-DD date.' };
    }
    const currentDate = parseIsoDate(currentValue);
    const constantDate = parseIsoDate(constantValue);
    const currentOffsetDays = daysBetween(constantValue, currentValue);
    const alreadyNearCurrentBoundary = currentOffsetDays !== null
      && Math.abs(currentOffsetDays) <= 31
      && (
        currentDate.getUTCFullYear() === constantDate.getUTCFullYear()
        || (
          constantDate.getUTCMonth() === 11
          && currentDate.getUTCFullYear() === constantDate.getUTCFullYear() + 1
          && currentDate.getUTCMonth() === 0
        )
      );
    if (alreadyNearCurrentBoundary) {
      return { supported: false, skip: true, reason: 'Input already appears to be in the maintained tax-year cycle.' };
    }
    if (Math.abs(offsetDays) > 370) {
      return { supported: false, skip: true, reason: 'Input date is too far from the maintained constant boundary.' };
    }
    const proposedValue = appendIsoDateSuffix(addDays(constantValue, offsetDays), currentValue);
    if (!proposedValue) {
      return { supported: false, reason: 'Could not preserve the date offset from the maintained constant.' };
    }
    return { supported: true, proposedValue };
  }

  if (inputNode?.type === 'DateTime') {
    return deriveDateValue(inputNode.value);
  }

  if (inputNode?.type === 'DateTime[]') {
    if (!Array.isArray(inputNode.value) || inputNode.value.length !== 1 || typeof inputNode.value[0] !== 'string' || !inputNode.value[0].trim()) {
      return { supported: false, skip: true, reason: 'Current input value is not a supported single-value date array.' };
    }
    const derived = deriveDateValue(inputNode.value[0]);
    if (!derived.supported) {
      return derived;
    }
    return { supported: true, proposedValue: [derived.proposedValue] };
  }

  return { supported: false, skip: true, reason: `Unsupported input type for boundary update: ${inputNode?.type || 'unknown'}` };
}

function deriveAgeAsOfInputProposedValue(inputNode, constantValue) {
  function deriveDateValue(currentValue) {
    if (typeof currentValue !== 'string' || !currentValue.trim()) {
      return { supported: false, skip: true, reason: 'Current input value is blank or not a date string.' };
    }
    if (ageAsOf(currentValue, constantValue) === null) {
      return { supported: false, skip: true, reason: 'Current input value or maintained age cutoff is not a supported date.' };
    }
    const proposedValue = shiftIsoDateByYears(currentValue, 1);
    if (!proposedValue) {
      return { supported: false, reason: 'Could not shift the age-boundary date by one year.' };
    }
    return { supported: true, proposedValue };
  }

  if (inputNode?.type === 'DateTime') {
    return deriveDateValue(inputNode.value);
  }

  if (inputNode?.type === 'DateTime[]') {
    if (!Array.isArray(inputNode.value) || inputNode.value.length !== 1) {
      return { supported: false, skip: true, reason: 'Current input value is not a supported single-value date array.' };
    }
    const derived = deriveDateValue(inputNode.value[0]);
    if (!derived.supported) {
      return derived;
    }
    return { supported: true, proposedValue: [derived.proposedValue] };
  }

  return { supported: false, skip: true, reason: `Unsupported input type for age-boundary update: ${inputNode?.type || 'unknown'}` };
}

function deriveInputYearShiftProposedValue(inputNode, constantValues) {
  const firstConstant = Array.isArray(constantValues) ? constantValues.find(value => typeof value === 'string') : '';
  const priorYearValue = shiftIsoDateByYears(firstConstant, -1);
  const priorYearDate = parseIsoDate(priorYearValue);
  if (!priorYearDate) {
    return { supported: false, reason: 'Could not infer the prior-year cycle from maintained constants.' };
  }

  function deriveDateValue(currentValue) {
    const currentDate = parseIsoDate(currentValue);
    if (!currentDate) {
      return { supported: false, skip: true, reason: 'Current input value is not a supported YYYY-MM-DD date.' };
    }
    if (currentDate.getUTCFullYear() !== priorYearDate.getUTCFullYear()) {
      return { supported: false, skip: true, reason: 'Input is not in the prior-year cycle for the maintained constants.' };
    }
    return { supported: true, proposedValue: shiftIsoDateByYears(currentValue, 1) };
  }

  if (inputNode?.type === 'DateTime') {
    return deriveDateValue(inputNode.value);
  }

  if (inputNode?.type === 'DateTime[]') {
    if (!Array.isArray(inputNode.value) || inputNode.value.length !== 1) {
      return { supported: false, skip: true, reason: 'Current input value is not a supported single-value date array.' };
    }
    const derived = deriveDateValue(inputNode.value[0]);
    if (!derived.supported) {
      return derived;
    }
    return { supported: true, proposedValue: [derived.proposedValue] };
  }

  return { supported: false, skip: true, reason: `Unsupported input type for year-cycle update: ${inputNode?.type || 'unknown'}` };
}

function deriveInputCalendarYearShiftProposedValue(inputNode, currentYearValue, options = {}) {
  const currentYear = Number.parseInt(currentYearValue, 10);
  if (!Number.isInteger(currentYear)) {
    return { supported: false, reason: 'Maintained year constant is not a supported integer year.' };
  }
  const priorYear = currentYear - 1;
  const priorPriorYear = currentYear - 2;

  function deriveDateValue(currentValue) {
    const currentDate = parseIsoDate(currentValue);
    if (!currentDate) {
      return { supported: false, skip: true, reason: 'Current input value is not a supported YYYY-MM-DD date.' };
    }
    const dateYear = currentDate.getUTCFullYear();
    if (dateYear === priorPriorYear) {
      return { supported: true, proposedValue: shiftIsoDateByYears(currentValue, 1) };
    }
    if (dateYear !== priorYear || options.shiftPriorYear === false) {
      return { supported: false, skip: true, reason: 'Input is not in the prior-year cycle for the maintained year constant.' };
    }
    return { supported: true, proposedValue: shiftIsoDateByYears(currentValue, 1) };
  }

  if (inputNode?.type === 'DateTime') {
    return deriveDateValue(inputNode.value);
  }

  if (inputNode?.type === 'DateTime[]') {
    if (!Array.isArray(inputNode.value) || inputNode.value.length !== 1) {
      return { supported: false, skip: true, reason: 'Current input value is not a supported single-value date array.' };
    }
    const derived = deriveDateValue(inputNode.value[0]);
    if (!derived.supported) {
      return derived;
    }
    return { supported: true, proposedValue: [derived.proposedValue] };
  }

  return { supported: false, skip: true, reason: `Unsupported input type for calendar-year update: ${inputNode?.type || 'unknown'}` };
}

function getPriorYearFromConstantValues(constantValues) {
  const firstConstant = Array.isArray(constantValues) ? constantValues.find(value => typeof value === 'string') : '';
  const priorYearValue = shiftIsoDateByYears(firstConstant, -1);
  const priorYearDate = parseIsoDate(priorYearValue);
  return priorYearDate ? priorYearDate.getUTCFullYear() : null;
}

function hasDateValueInYear(inputNode, year) {
  if (!Number.isInteger(year)) {
    return false;
  }
  if (inputNode?.type === 'DateTime') {
    const date = parseIsoDate(inputNode.value);
    return date?.getUTCFullYear() === year;
  }
  if (inputNode?.type === 'DateTime[]' && Array.isArray(inputNode.value) && inputNode.value.length === 1) {
    const date = parseIsoDate(inputNode.value[0]);
    return date?.getUTCFullYear() === year;
  }
  return false;
}

function getCaseInputValue(testCase, dependency) {
  const inputs = Array.isArray(testCase?.inputs) ? testCase.inputs : [];
  const candidate = inputs.find(input =>
    (!dependency?.Entity || input.entity === dependency.Entity)
    && (!dependency?.Form || input.form === dependency.Form)
    && (!dependency?.Field || input.field === dependency.Field)
  );
  return candidate ? candidate.value : undefined;
}

function getCaseInputEntry(testCase, dependency) {
  const inputs = Array.isArray(testCase?.inputs) ? testCase.inputs : [];
  const index = inputs.findIndex(input =>
    (!dependency?.Entity || input.entity === dependency.Entity)
    && (!dependency?.Form || input.form === dependency.Form)
    && (!dependency?.Field || input.field === dependency.Field)
  );
  if (index === -1) {
    return null;
  }
  return {
    input: inputs[index],
    index
  };
}

function inputMatchesConstant(inputValue, constantValue) {
  if (Array.isArray(inputValue)) {
    return flattenValues(inputValue).some(item => String(item) === String(constantValue));
  }
  return String(inputValue) === String(constantValue);
}

function splitArguments(value) {
  const args = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '"' && value[index - 1] !== '\\') {
      inString = !inString;
    }
    if (inString) {
      continue;
    }
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      args.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  args.push(value.slice(start).trim());
  return args.filter(Boolean);
}

function compareIsoDateValues(leftValue, rightValue, methodName) {
  const left = parseIsoDate(leftValue);
  const right = parseIsoDate(rightValue);
  if (!left || !right) {
    return false;
  }
  if (methodName === 'IsOnOrBefore') return left.getTime() <= right.getTime();
  if (methodName === 'IsBefore') return left.getTime() < right.getTime();
  if (methodName === 'IsOnOrAfter') return left.getTime() >= right.getTime();
  if (methodName === 'IsAfter') return left.getTime() > right.getTime();
  return false;
}

function evaluateExpression(expression, context) {
  const expr = stripOuterParens(String(expression || '').trim());
  if (!expr) return { ok: false };
  if (expr.startsWith('!')) {
    const arg = evaluateExpression(expr.slice(1), context);
    if (!arg.ok) return arg;
    return { ok: true, value: !Boolean(arg.value), maintainedNames: arg.maintainedNames || [] };
  }
  if (/^\{\d+\}$/.test(expr)) {
    const entry = context.entriesByPlaceholder.get(expr);
    if (!entry) return { ok: false };
    if (isInputLikeDependency(entry.dependency)) {
      const inputValue = getCaseInputValue(context.testCase, entry.dependency);
      if (inputValue === undefined) return { ok: false };
      const flattened = flattenValues(inputValue);
      return { ok: true, value: flattened.length === 1 ? flattened[0] : inputValue, maintainedNames: [] };
    }
    if (entry.anyConstantValue === undefined) return { ok: false };
    return {
      ok: true,
      value: entry.anyConstantValue,
      maintainedNames: entry.constantValue === undefined ? [] : [entry.constantName]
    };
  }

  let match = expr.match(/^(\{\d+\}|[A-Za-z_]\w*)\.(YYYY|YY)\(\)$/);
  if (match && match[1] !== 'Calc') {
    const base = evaluateExpression(match[1], context);
    if (!base.ok) return base;
    const parseYear = value => {
      const date = parseIsoDate(value);
      if (date) return date.getUTCFullYear();
      const parsed = Number.parseInt(value, 10);
      return Number.isInteger(parsed) ? parsed : null;
    };
    const year = parseYear(base.value);
    if (year === null) return { ok: false };
    return {
      ok: true,
      value: match[2] === 'YY' ? String(year).slice(-2) : String(year),
      maintainedNames: base.maintainedNames || []
    };
  }

  match = expr.match(/^(\{\d+\}|[A-Za-z_]\w*)\.Substring\((.+)\)$/);
  if (match && match[1] !== 'Calc') {
    const base = evaluateExpression(match[1], context);
    const args = splitArguments(match[2]).map(arg => evaluateExpression(arg, context));
    if (!base.ok || !args.length || args.length > 2 || args.some(arg => !arg.ok)) return { ok: false };
    const source = String(base.value);
    const start = Number(args[0].value);
    const length = args[1] ? Number(args[1].value) : undefined;
    return {
      ok: true,
      value: args[1] ? source.slice(start, start + length) : source.slice(start),
      maintainedNames: [...(base.maintainedNames || []), ...args.flatMap(arg => arg.maintainedNames || [])]
    };
  }

  match = expr.match(/^(\{\d+\}|[A-Za-z_]\w*)\.ToString\(\)$/);
  if (match) {
    const base = evaluateExpression(match[1], context);
    if (!base.ok) return base;
    return { ok: true, value: String(base.value), maintainedNames: base.maintainedNames || [] };
  }

  match = expr.match(/^(\{\d+\})\.(SubtractDays|AddDays)\((\d+)\)$/);
  if (match) {
    const base = evaluateExpression(match[1], context);
    if (!base.ok) return base;
    const days = Number(match[3]) * (match[2] === 'SubtractDays' ? -1 : 1);
    const shiftDate = value => {
      const shifted = addDays(value, days);
      return shifted || null;
    };
    if (Array.isArray(base.value)) {
      const shiftedValues = base.value.map(shiftDate);
      if (shiftedValues.some(value => value === null)) return { ok: false };
      return { ok: true, value: shiftedValues, maintainedNames: base.maintainedNames || [] };
    }
    const shiftedValue = shiftDate(base.value);
    if (!shiftedValue) return { ok: false };
    return { ok: true, value: shiftedValue, maintainedNames: base.maintainedNames || [] };
  }

  match = expr.match(/^(\{\d+\})\.AgeAsOf\((\{\d+\})\)$/);
  if (match) {
    const birth = evaluateExpression(match[1], context);
    const asOf = evaluateExpression(match[2], context);
    if (!birth.ok || !asOf.ok) return { ok: false };
    const births = Array.isArray(birth.value) ? birth.value : [birth.value];
    const asOfs = Array.isArray(asOf.value) ? asOf.value : [asOf.value];
    const length = Math.max(births.length, asOfs.length);
    if (![1, length].includes(births.length) || ![1, length].includes(asOfs.length)) return { ok: false };
    const values = [];
    for (let index = 0; index < length; index++) {
      const age = ageAsOf(births[births.length === 1 ? 0 : index], asOfs[asOfs.length === 1 ? 0 : index]);
      if (age === null) return { ok: false };
      values.push(age);
    }
    return {
      ok: true,
      value: values.length === 1 ? values[0] : values,
      maintainedNames: [...(birth.maintainedNames || []), ...(asOf.maintainedNames || [])]
    };
  }

  match = expr.match(/^(\{\d+\})\.AgeIs\((.+)\)\.AsOf\((\{\d+\})\)$/);
  if (match) {
    const birth = evaluateExpression(match[1], context);
    const ageLimit = evaluateExpression(match[2], context);
    const asOf = evaluateExpression(match[3], context);
    if (!birth.ok || !ageLimit.ok || !asOf.ok) return { ok: false };
    const births = Array.isArray(birth.value) ? birth.value : [birth.value];
    const asOfs = Array.isArray(asOf.value) ? asOf.value : [asOf.value];
    const length = Math.max(births.length, asOfs.length);
    if (![1, length].includes(births.length) || ![1, length].includes(asOfs.length)) return { ok: false };
    const values = [];
    for (let index = 0; index < length; index++) {
      const isAge = ageIsAsOf(
        births[births.length === 1 ? 0 : index],
        ageLimit.value,
        asOfs[asOfs.length === 1 ? 0 : index]
      );
      if (isAge === null) return { ok: false };
      values.push(isAge);
    }
    return {
      ok: true,
      value: values.length === 1 ? values[0] : values,
      maintainedNames: [...(birth.maintainedNames || []), ...(ageLimit.maintainedNames || []), ...(asOf.maintainedNames || [])]
    };
  }

  match = expr.match(/^(\{\d+\})\.IsPositive\(\)$/);
  if (match) {
    const arg = evaluateExpression(match[1], context);
    if (!arg.ok) return arg;
    return { ok: true, value: Number(arg.value) > 0, maintainedNames: arg.maintainedNames || [] };
  }

  match = expr.match(/^(\{\d+\})\.IsBlank\(\)$/);
  if (match) {
    const arg = evaluateExpression(match[1], context);
    if (!arg.ok) return arg;
    return {
      ok: true,
      value: flattenValues(arg.value).every(value => value === null || value === undefined || String(value).trim() === ''),
      maintainedNames: arg.maintainedNames || []
    };
  }

  match = expr.match(/^(\{\d+\})\.Is([A-Za-z_]\w*)\(\)$/);
  if (match) {
    const arg = evaluateExpression(match[1], context);
    if (!arg.ok) return arg;
    return {
      ok: true,
      value: flattenValues(arg.value).some(value => String(value).split('.').pop() === match[2]),
      maintainedNames: arg.maintainedNames || []
    };
  }

  if (Object.prototype.hasOwnProperty.call(context.variables, expr)) {
    return context.variables[expr];
  }
  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return { ok: true, value: Number(expr), maintainedNames: [] };
  }
  match = expr.match(/^"([\s\S]*)"$/);
  if (match) {
    return { ok: true, value: match[1], maintainedNames: [] };
  }
  if (/^(true|false)$/i.test(expr)) {
    return { ok: true, value: /^true$/i.test(expr), maintainedNames: [] };
  }

  match = expr.match(/^Convert\.ToInt32\((.+)\)$/);
  if (match) {
    const arg = evaluateExpression(match[1], context);
    if (!arg.ok) return arg;
    return { ok: true, value: Number.parseInt(arg.value, 10), maintainedNames: arg.maintainedNames || [] };
  }

  match = expr.match(/^Int32\.Parse\((.+)\)$/);
  if (match) {
    const arg = evaluateExpression(match[1], context);
    if (!arg.ok) return arg;
    return { ok: true, value: Number.parseInt(arg.value, 10), maintainedNames: arg.maintainedNames || [] };
  }

  match = expr.match(/^Convert\.ToString\((.+)\)$/);
  if (match) {
    const arg = evaluateExpression(match[1], context);
    if (!arg.ok) return arg;
    return { ok: true, value: String(arg.value), maintainedNames: arg.maintainedNames || [] };
  }

  match = expr.match(/^String\.IsNullOrWhiteSpace\((.+)\)$/);
  if (match) {
    const arg = evaluateExpression(match[1], context);
    if (!arg.ok) return arg;
    return {
      ok: true,
      value: flattenValues(arg.value).every(value => value === null || value === undefined || String(value).trim() === ''),
      maintainedNames: arg.maintainedNames || []
    };
  }

  match = expr.match(/^Calc\.Sum\((.+)\)$/);
  if (match) {
    const args = splitArguments(match[1]).map(arg => evaluateExpression(arg, context));
    if (args.some(arg => !arg.ok)) return { ok: false };
    return {
      ok: true,
      value: args.reduce((sum, arg) => sum + Number(arg.value), 0),
      maintainedNames: args.flatMap(arg => arg.maintainedNames || [])
    };
  }

  match = expr.match(/^Calc\.Difference\((.+)\)$/);
  if (match) {
    const args = splitArguments(match[1]).map(arg => evaluateExpression(arg, context));
    if (args.length !== 2 || args.some(arg => !arg.ok)) return { ok: false };
    return {
      ok: true,
      value: Number(args[0].value) - Number(args[1].value),
      maintainedNames: args.flatMap(arg => arg.maintainedNames || [])
    };
  }

  match = expr.match(/^Calc\.Max\((.+)\)$/);
  if (match) {
    const args = splitArguments(match[1]).map(arg => evaluateExpression(arg, context));
    if (args.some(arg => !arg.ok)) return { ok: false };
    if (args.some(arg => Array.isArray(arg.value))) {
      return { ok: false };
    }
    return {
      ok: true,
      value: Math.max(...args.map(arg => Number(arg.value))),
      maintainedNames: args.flatMap(arg => arg.maintainedNames || [])
    };
  }

  match = expr.match(/^Calc\.DaysBetween\((.+)\)$/);
  if (match) {
    const args = splitArguments(match[1]).map(arg => evaluateExpression(arg, context));
    if (args.length !== 2 || args.some(arg => !arg.ok)) return { ok: false };
    const starts = Array.isArray(args[0].value) ? args[0].value : [args[0].value];
    const ends = Array.isArray(args[1].value) ? args[1].value : [args[1].value];
    const length = Math.max(starts.length, ends.length);
    if (![1, length].includes(starts.length) || ![1, length].includes(ends.length)) return { ok: false };
    const values = [];
    for (let index = 0; index < length; index++) {
      const diff = daysBetween(starts[starts.length === 1 ? 0 : index], ends[ends.length === 1 ? 0 : index]);
      if (diff === null) return { ok: false };
      values.push(diff);
    }
    return {
      ok: true,
      value: values.length === 1 ? values[0] : values,
      maintainedNames: args.flatMap(arg => arg.maintainedNames || [])
    };
  }

  match = expr.match(/^Calc\.Substring\((.+)\)$/);
  if (match) {
    const args = splitArguments(match[1]).map(arg => evaluateExpression(arg, context));
    if (![2, 3].includes(args.length) || args.some(arg => !arg.ok)) return { ok: false };
    const source = String(args[0].value);
    const start = Number(args[1].value);
    const length = args[2] ? Number(args[2].value) : undefined;
    return {
      ok: true,
      value: args[2] ? source.slice(start, start + length) : source.slice(start),
      maintainedNames: args.flatMap(arg => arg.maintainedNames || [])
    };
  }

  match = expr.match(/^Calc\.Concatenate\((.+)\)$/);
  if (match) {
    const args = splitArguments(match[1]).map(arg => evaluateExpression(arg, context));
    if (args.some(arg => !arg.ok)) return { ok: false };
    return {
      ok: true,
      value: args.map(arg => String(arg.value)).join(''),
      maintainedNames: args.flatMap(arg => arg.maintainedNames || [])
    };
  }

  match = expr.match(/^Calc\.ConcatenateWithSpace\((.+)\)$/);
  if (match) {
    if (/Calc\.Concatenate\(/.test(match[1])) {
      return { ok: false };
    }
    const args = splitArguments(match[1]).map(arg => evaluateExpression(arg, context));
    if (args.some(arg => !arg.ok)) return { ok: false };
    const parts = args
      .flatMap(arg => flattenValues(arg.value))
      .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
      .map(value => String(value));
    return {
      ok: true,
      value: parts.join(' '),
      maintainedNames: args.flatMap(arg => arg.maintainedNames || [])
    };
  }

  return { ok: false };
}

function getEntryRuntimeValue(entry, context, testCase) {
  if (!entry) {
    return { ok: false };
  }
  if (isInputLikeDependency(entry.dependency)) {
    const inputValue = getCaseInputValue(testCase, entry.dependency);
    if (inputValue === undefined) return { ok: false };
    const flattened = flattenValues(inputValue);
    return { ok: true, value: flattened.length === 1 ? flattened[0] : inputValue };
  }
  if (entry.anyConstantValue !== undefined) {
    return { ok: true, value: entry.anyConstantValue };
  }
  return { ok: false };
}

function stripOuterParens(value) {
  let result = String(value || '').trim();
  let changed = true;
  while (changed && result.startsWith('(') && result.endsWith(')')) {
    changed = false;
    let depth = 0;
    let wraps = true;
    for (let index = 0; index < result.length; index++) {
      const char = result[index];
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth === 0 && index < result.length - 1) {
        wraps = false;
        break;
      }
    }
    if (wraps) {
      result = result.slice(1, -1).trim();
      changed = true;
    }
  }
  return result;
}

function splitTopLevelOperator(value, operator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth === 0 && value.slice(index, index + operator.length) === operator) {
      parts.push(value.slice(start, index).trim());
      start = index + operator.length;
      index += operator.length - 1;
    }
  }
  if (parts.length) {
    parts.push(value.slice(start).trim());
  }
  return parts;
}

function splitTopLevelComparison(value) {
  const operators = ['==', '!=', '>=', '<=', '>', '<'];
  let depth = 0;
  let inString = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '"' && value[index - 1] !== '\\') inString = !inString;
    if (inString) continue;
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth !== 0) continue;
    const operator = operators.find(candidate => value.slice(index, index + candidate.length) === candidate);
    if (operator) {
      return {
        left: value.slice(0, index).trim(),
        operator,
        right: value.slice(index + operator.length).trim()
      };
    }
  }
  return null;
}

function conditionMatchesTestCase(condition, context, testCase) {
  const trimmed = stripOuterParens(condition);
  const andParts = splitTopLevelOperator(trimmed, '&&');
  if (andParts.length) {
    return andParts.every(part => conditionMatchesTestCase(part, context, testCase));
  }
  const orParts = splitTopLevelOperator(trimmed, '||');
  if (orParts.length) {
    return orParts.some(part => conditionMatchesTestCase(part, context, testCase));
  }

  let match = trimmed.match(/^(.+)\s*(==|!=)\s*null$/);
  if (match) {
    const evaluated = evaluateExpression(match[1], context);
    if (!evaluated.ok) return false;
    return match[2] === '==' ? evaluated.value === null : evaluated.value !== null;
  }

  const boolExpression = evaluateExpression(trimmed, context);
  if (boolExpression.ok && typeof boolExpression.value === 'boolean') {
    return boolExpression.value;
  }

  const comparison = splitTopLevelComparison(trimmed);
  if (comparison) {
    const left = evaluateExpression(comparison.left, context);
    const right = evaluateExpression(comparison.right, context);
    if (!left.ok || !right.ok) return false;
    const leftNumber = Number(left.value);
    const rightNumber = Number(right.value);
    const compareAsNumbers = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const leftValue = compareAsNumbers ? leftNumber : String(left.value);
    const rightValue = compareAsNumbers ? rightNumber : String(right.value);
    if (comparison.operator === '==') return leftValue === rightValue;
    if (comparison.operator === '!=') return leftValue !== rightValue;
    if (comparison.operator === '>') return leftValue > rightValue;
    if (comparison.operator === '>=') return leftValue >= rightValue;
    if (comparison.operator === '<') return leftValue < rightValue;
    if (comparison.operator === '<=') return leftValue <= rightValue;
  }

  match = trimmed.match(/^(\{\d+\})\.(IsOnOrBefore|IsBefore|IsOnOrAfter|IsAfter)\((\{\d+\})\)$/);
  if (match) {
    const left = getEntryRuntimeValue(context.entriesByPlaceholder.get(match[1]), context, testCase);
    const right = getEntryRuntimeValue(context.entriesByPlaceholder.get(match[3]), context, testCase);
    if (!left.ok || !right.ok) {
      return false;
    }
    return compareIsoDateValues(left.value, right.value, match[2]);
  }

  match = trimmed.match(/^(\{\d+\})\s*==\s*(true|false)$/i);
  if (match) {
    const entry = context.entriesByPlaceholder.get(match[1]);
    if (!entry || !isInputLikeDependency(entry.dependency)) {
      return false;
    }
    const inputValue = getCaseInputValue(testCase, entry.dependency);
    return flattenValues(inputValue).some(value => String(value).toLowerCase() === match[2].toLowerCase());
  }

  match = trimmed.match(/^(\{\d+\})\s*(>|>=|<|<=|==)\s*(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const left = evaluateExpression(match[1], context);
    if (!left.ok) {
      return false;
    }
    const leftNumber = Number(left.value);
    const rightNumber = Number(match[3]);
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
      return false;
    }
    if (match[2] === '>') return leftNumber > rightNumber;
    if (match[2] === '>=') return leftNumber >= rightNumber;
    if (match[2] === '<') return leftNumber < rightNumber;
    if (match[2] === '<=') return leftNumber <= rightNumber;
    return leftNumber === rightNumber;
  }

  return false;
}

function conditionUsesMaintainedConstant(condition, context) {
  return getConditionMaintainedNames(condition, context).length > 0;
}

function getConditionMaintainedNames(condition, context) {
  const placeholders = String(condition || '').match(/\{\d+\}/g) || [];
  return Array.from(new Set(placeholders
    .map(placeholder => context.entriesByPlaceholder.get(placeholder))
    .filter(entry => entry?.dependency?.FieldType === 'Constant' && entry.constantValue !== undefined)
    .map(entry => entry.constantName)));
}

function getComputedReturnConstant(calcJson, constantsByName, allConstantsByName, testCase) {
  const entriesByPlaceholder = new Map(getDependencyEntries(calcJson, constantsByName, allConstantsByName).map(entry => [entry.placeholder, entry]));
  const lines = Array.isArray(calcJson?.Custom)
    ? calcJson.Custom.map(line => String(line).trim()).filter(Boolean)
    : [];
  const variables = {};
  const context = { entriesByPlaceholder, variables, testCase };

  for (let index = 0; index < lines.length; index++) {
    const inlineIfMatch = lines[index].match(/^if\s*\((.+)\)\s*return\s+(.+);$/);
    if (inlineIfMatch) {
      const conditionMaintainedNames = getConditionMaintainedNames(inlineIfMatch[1], context);
      if (conditionMatchesTestCase(inlineIfMatch[1], context, testCase)) {
        const evaluated = evaluateExpression(inlineIfMatch[2], context);
        const maintainedNames = Array.from(new Set([
          ...conditionMaintainedNames,
          ...(evaluated.maintainedNames || [])
        ]));
        if (evaluated.ok && maintainedNames.length) {
          return {
            constantName: maintainedNames.join(', '),
            constantValue: evaluated.value
          };
        }
      }
      continue;
    }

    const ifMatch = lines[index].match(/^if\s*\((.+)\)\s*(\{)?$/);
    if (ifMatch && (ifMatch[2] || lines[index + 1] === '{')) {
      const blockStartIndex = ifMatch[2] ? index + 1 : index + 2;
      let closeIndex = blockStartIndex;
      while (closeIndex < lines.length && lines[closeIndex] !== '}') {
        closeIndex++;
      }
      const blockLines = lines.slice(blockStartIndex, closeIndex);
      const returnLine = blockLines.find(line => /^return\s+.+;$/.test(line));
      if (returnLine && conditionMatchesTestCase(ifMatch[1], context, testCase)) {
        const evaluated = evaluateExpression(returnLine.replace(/^return\s+/, '').replace(/;$/, ''), context);
        const maintainedNames = Array.from(new Set([
          ...getConditionMaintainedNames(ifMatch[1], context),
          ...(evaluated.maintainedNames || [])
        ]));
        if (evaluated.ok && maintainedNames.length) {
          return {
            constantName: maintainedNames.join(', '),
            constantValue: evaluated.value
          };
        }
      }
      index = closeIndex;
      continue;
    }

    const varMatch = lines[index].match(/^var\s+([A-Za-z_]\w*)\s*=\s*(.+);$/);
    if (varMatch) {
      const evaluated = evaluateExpression(varMatch[2], context);
      if (evaluated.ok) {
        variables[varMatch[1]] = evaluated;
      }
      continue;
    }

    const returnMatch = lines[index].match(/^return\s+(.+);$/);
    if (returnMatch) {
      const evaluated = evaluateExpression(returnMatch[1], context);
      if (evaluated.ok && evaluated.maintainedNames?.length) {
        return {
          constantName: Array.from(new Set(evaluated.maintainedNames)).join(', '),
          constantValue: evaluated.value
        };
      }
    }
  }

  return null;
}

function getConditionalReturnValue(calcJson, constantsByName, allConstantsByName, testCase) {
  const entriesByPlaceholder = new Map(getDependencyEntries(calcJson, constantsByName, allConstantsByName).map(entry => [entry.placeholder, entry]));
  const lines = Array.isArray(calcJson?.Custom)
    ? calcJson.Custom.map(line => String(line).trim()).filter(Boolean)
    : [];
  const context = { entriesByPlaceholder, variables: {}, testCase };

  for (let index = 0; index < lines.length; index++) {
    const ifMatch = lines[index].match(/^(if|else if)\s*\((.+)\)\s*(\{)?$/);
    if (!ifMatch || (!ifMatch[3] && lines[index + 1] !== '{')) {
      continue;
    }

    const blockStartIndex = ifMatch[3] ? index + 1 : index + 2;
    let closeIndex = blockStartIndex;
    while (closeIndex < lines.length && lines[closeIndex] !== '}') {
      closeIndex++;
    }
    const blockLines = lines.slice(blockStartIndex, closeIndex);
    const returnMatch = blockLines
      .find(line => /^return\s+\{\d+\};$/.test(line))
      ?.match(/^return\s+(\{\d+\});$/);

    if (returnMatch && conditionMatchesTestCase(ifMatch[2], context, testCase)) {
      const returnedEntry = entriesByPlaceholder.get(returnMatch[1]);
      if (!returnedEntry) {
        return null;
      }
      if (returnedEntry.dependency?.FieldType === 'Constant' && returnedEntry.constantValue !== undefined) {
        return {
          constantName: returnedEntry.constantName,
          constantValue: returnedEntry.constantValue
        };
      }
      if (isInputLikeDependency(returnedEntry.dependency) && conditionUsesMaintainedConstant(ifMatch[2], context)) {
        const returnedValue = getCaseInputValue(testCase, returnedEntry.dependency);
        if (returnedValue === undefined || returnedValue === null) {
          return null;
        }
        return {
          constantName: 'Returned input value',
          constantValue: cloneValue(returnedValue)
        };
      }
    }

    index = closeIndex;
  }

  return null;
}

function resolveReturnConstant(calcJson, constantsByName, testCase, allConstantsByName = constantsByName) {
  const conditionalReturnValue = getConditionalReturnValue(calcJson, constantsByName, allConstantsByName, testCase);
  if (conditionalReturnValue) {
    return conditionalReturnValue;
  }

  const directReturnConstant = getDirectReturnConstant(calcJson, constantsByName);
  if (directReturnConstant) {
    return directReturnConstant;
  }

  const branches = getConditionalReturnBranches(calcJson, constantsByName, allConstantsByName);
  for (const branch of branches) {
    const inputValue = getCaseInputValue(testCase, branch.inputDependency.dependency);
    if (inputValue === undefined || inputValue === null) {
      continue;
    }
    if (inputMatchesConstant(inputValue, branch.compareDependency.anyConstantValue)) {
      return branch.returnDependency;
    }
  }

  return getComputedReturnConstant(calcJson, constantsByName, allConstantsByName, testCase);
}

function getCalcFieldPath(calcJson) {
  const entity = typeof calcJson?.Entity === 'string' ? calcJson.Entity.trim() : '';
  const form = typeof calcJson?.Form === 'string' ? calcJson.Form.trim() : '';
  const field = typeof calcJson?.Field === 'string' ? calcJson.Field.trim() : '';
  if (!entity || !form || !field) {
    return '';
  }
  return `${entity}/${form}/${field}`;
}

function getDateYearsFromInputValue(value) {
  return flattenValues(value)
    .map(item => parseIsoDate(item))
    .filter(Boolean)
    .map(date => date.getUTCFullYear());
}

function testCaseExpectsBlankOutput(testCase) {
  return Boolean(testCase?.expectsBlank) || testCase?.output?.value === null || testCase?.output?.value === undefined;
}

function buildPreviewRows({ calcJson, testJson, calcFilePath, testFilePath, constantsByName, allConstantsByName = constantsByName }) {
  const rows = [];
  const outputType = calcJson?.Type || '';
  const outputTomType = calcJson?.TomType || '';
  const calcFieldPath = getCalcFieldPath(calcJson);
  const constantDependencies = getConstantDependencies(calcJson, constantsByName);
  const inputRelationships = getInputConstantDateRelationships(calcJson, constantsByName);
  const inputsWithDaysBetweenRelationship = new Set(inputRelationships
    .filter(relationship => relationship.source === 'daysBetween')
    .map(relationship => relationship.inputDependency.placeholder));
  const exactDateRelationships = inputRelationships.filter(relationship => relationship.mode === 'exact');
  const exactRelationshipPriorYear = getPriorYearFromConstantValues(exactDateRelationships.map(relationship => relationship.compareDependency.constantValue));
  const relationshipsByInputPlaceholder = new Map();
  for (const relationship of inputRelationships) {
    if (!relationshipsByInputPlaceholder.has(relationship.inputDependency.placeholder)) {
      relationshipsByInputPlaceholder.set(relationship.inputDependency.placeholder, []);
    }
    relationshipsByInputPlaceholder.get(relationship.inputDependency.placeholder).push(relationship);
  }

  function addInputComparisonRows(testCase, casePathParts, caseName) {
    const candidatesByPath = new Map();

    function buildYearCycleOptions(relationship) {
      const currentYear = Number.parseInt(relationship.compareDependency.constantValue, 10);
      if (!Number.isInteger(currentYear)) {
        return {};
      }

      const yearCycleRelationships = inputRelationships.filter(candidate => candidate.mode === 'yearCycle');
      const relatedYears = yearCycleRelationships.flatMap(candidate => {
        const inputEntry = getCaseInputEntry(testCase, candidate.inputDependency.dependency);
        return inputEntry ? getDateYearsFromInputValue(inputEntry.input.value) : [];
      });
      const hasPriorPriorYearInput = relatedYears.includes(currentYear - 2);
      return {
        shiftPriorYear: hasPriorPriorYearInput || testCaseExpectsBlankOutput(testCase)
      };
    }

    function addCandidate(candidate, inputEntry, relationship) {
      const existingCandidate = candidatesByPath.get(candidate.valuePath);
      if (!existingCandidate) {
        candidatesByPath.set(candidate.valuePath, candidate);
        return;
      }

      const constantNames = new Set(String(existingCandidate.constantName).split(', ').filter(Boolean));
      if (existingCandidate.constantName !== 'Same tax-year cycle') {
        constantNames.add(relationship.compareDependency.constantName);
      }
      existingCandidate.constantName = Array.from(constantNames).join(', ');
      if (!valuesEqual(existingCandidate.proposedValue, candidate.proposedValue)) {
        if (!existingCandidate.conflictingCandidates) {
          existingCandidate.conflictingCandidates = [cloneValue(existingCandidate.proposedValue)];
          existingCandidate.conflictingConstantValues = [relationship.compareDependency.constantValue];
        }
        existingCandidate.conflictingCandidates.push(cloneValue(candidate.proposedValue));
        existingCandidate.conflictingConstantValues.push(relationship.compareDependency.constantValue);
        const shifted = deriveInputYearShiftProposedValue(inputEntry.input, existingCandidate.conflictingConstantValues);
        if (shifted.supported && !valuesEqual(inputEntry.input.value, shifted.proposedValue)) {
          existingCandidate.proposedValue = cloneValue(shifted.proposedValue);
          existingCandidate.canApply = true;
          existingCandidate.reason = '';
        } else {
          existingCandidate.canApply = false;
          existingCandidate.reason = shifted.reason || 'Multiple maintained constants imply different input values.';
          existingCandidate.proposedValue = '';
        }
      }
    }

    for (const relationship of inputRelationships) {
      if (relationship.source === 'dateMethod' && inputsWithDaysBetweenRelationship.has(relationship.inputDependency.placeholder)) {
        continue;
      }
      const inputEntry = getCaseInputEntry(testCase, relationship.inputDependency.dependency);
      if (!inputEntry) {
        continue;
      }

      const fieldPath = [...casePathParts, 'inputs', inputEntry.index].join('.');
      const valuePath = [...casePathParts, 'inputs', inputEntry.index, 'value'].join('.');
      const derived = relationship.mode === 'yearCycle'
        ? deriveInputCalendarYearShiftProposedValue(inputEntry.input, relationship.compareDependency.constantValue, buildYearCycleOptions(relationship))
        : relationship.mode === 'ageAsOf'
          ? deriveAgeAsOfInputProposedValue(inputEntry.input, relationship.compareDependency.constantValue)
          : deriveInputBoundaryProposedValue(inputEntry.input, relationship.compareDependency.constantValue, {
              allowOffset: relationship.mode === 'offset'
            });
      if (!derived.supported) {
        if (derived.skip) {
          continue;
        }
        rows.push({
          rowKind: 'input',
          filePath: testFilePath,
          calcFilePath,
          calcFieldPath,
          caseName,
          fieldPath,
          valuePath,
          type: inputEntry.input.type || '',
          tomType: inputEntry.input.tomType || '',
          constantName: relationship.compareDependency.constantName,
          currentValue: cloneValue(inputEntry.input.value),
          proposedValue: '',
          canApply: false,
          reason: derived.reason
        });
        continue;
      }

      if (valuesEqual(inputEntry.input.value, derived.proposedValue)) {
        continue;
      }

      const nextCandidate = {
        rowKind: 'input',
        filePath: testFilePath,
        calcFilePath,
        calcFieldPath,
        caseName,
        fieldPath,
        valuePath,
        type: inputEntry.input.type || '',
        tomType: inputEntry.input.tomType || '',
        constantName: relationship.compareDependency.constantName,
        currentValue: cloneValue(inputEntry.input.value),
        proposedValue: cloneValue(derived.proposedValue),
        canApply: true,
        reason: ''
      };

      addCandidate(nextCandidate, inputEntry, relationship);
    }

    if (exactRelationshipPriorYear !== null) {
      for (const [placeholder, relationships] of relationshipsByInputPlaceholder.entries()) {
        const representative = relationships[0];
        const inputEntry = getCaseInputEntry(testCase, representative.inputDependency.dependency);
        if (!inputEntry) {
          continue;
        }
        const valuePath = [...casePathParts, 'inputs', inputEntry.index, 'value'].join('.');
        if (candidatesByPath.has(valuePath) || !hasDateValueInYear(inputEntry.input, exactRelationshipPriorYear)) {
          continue;
        }
        const shifted = deriveInputYearShiftProposedValue(inputEntry.input, [representative.compareDependency.constantValue]);
        if (!shifted.supported || valuesEqual(inputEntry.input.value, shifted.proposedValue)) {
          continue;
        }
        const fieldPath = [...casePathParts, 'inputs', inputEntry.index].join('.');
        addCandidate({
          rowKind: 'input',
          filePath: testFilePath,
          calcFilePath,
          calcFieldPath,
          caseName,
          fieldPath,
          valuePath,
          type: inputEntry.input.type || '',
          tomType: inputEntry.input.tomType || '',
          constantName: 'Same tax-year cycle',
          currentValue: cloneValue(inputEntry.input.value),
          proposedValue: cloneValue(shifted.proposedValue),
          canApply: true,
          reason: ''
        }, inputEntry, representative);
      }
    }

    for (const candidate of candidatesByPath.values()) {
      if (candidate.canApply || candidate.reason) {
        rows.push({
          ...candidate,
          currentValue: cloneValue(candidate.currentValue),
          proposedValue: cloneValue(candidate.proposedValue)
        });
      }
    }

    return Array.from(candidatesByPath.values()).filter(candidate => candidate.canApply);
  }

  function buildOutputEvaluationTestCase(testCase, casePathParts, inputRows) {
    const applicableRows = inputRows.filter(row => row?.canApply && row?.valuePath);
    if (!applicableRows.length) {
      return testCase;
    }

    const testCaseForOutput = cloneValue(testCase);
    const prefixLength = casePathParts.length;
    for (const row of applicableRows) {
      const relativePath = row.valuePath.split('.').slice(prefixLength).join('.');
      if (!relativePath) {
        continue;
      }
      setValueAtPath(testCaseForOutput, relativePath, row.proposedValue);
    }
    return testCaseForOutput;
  }

  function visit(node, pathParts, caseName, testCase, selectedConstant) {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, [...pathParts, index], caseName, testCase, selectedConstant));
      return;
    }

    const currentCaseName = (typeof node.name === 'string' || typeof node.name === 'number')
      ? node.name
      : caseName;

    if (matchesCalcOutput(node, calcJson)) {
      if (!selectedConstant) {
        return;
      }
      const fieldPath = pathParts.join('.');
      const derived = deriveProposedValue(node, selectedConstant.constantValue);
      if (!derived.supported) {
        if (derived.skip) {
          return;
        }
        rows.push({
          rowKind: 'output',
          filePath: testFilePath,
          calcFilePath,
          calcFieldPath,
          caseName: currentCaseName,
          fieldPath: fieldPath || '-',
          valuePath: `${fieldPath}.value`,
          type: node.type || outputType,
          tomType: node.tomType || outputTomType,
          constantName: selectedConstant.constantName,
          currentValue: node.value,
          proposedValue: '',
          canApply: false,
          reason: derived.reason
        });
        return;
      }

      if (!valuesEqual(node.value, derived.proposedValue)) {
        rows.push({
          rowKind: 'output',
          filePath: testFilePath,
          calcFilePath,
          calcFieldPath,
          caseName: currentCaseName,
          fieldPath: fieldPath || '-',
          valuePath: `${fieldPath}.value`,
          type: node.type || outputType,
          tomType: node.tomType || outputTomType,
          constantName: selectedConstant.constantName,
          currentValue: cloneValue(node.value),
          proposedValue: cloneValue(derived.proposedValue),
          canApply: true,
          reason: ''
        });
      }
      return;
    }

    Object.entries(node).forEach(([key, value]) => {
      if (key === 'value') return;
      visit(value, [...pathParts, key], currentCaseName, testCase, selectedConstant);
    });
  }

  if (Array.isArray(testJson)) {
    testJson.forEach((testCase, index) => {
      const currentCaseName = (typeof testCase?.name === 'string' || typeof testCase?.name === 'number')
        ? testCase.name
        : null;
      const casePathParts = [index];
      const inputRows = addInputComparisonRows(testCase, casePathParts, currentCaseName);
      const outputEvaluationTestCase = buildOutputEvaluationTestCase(testCase, casePathParts, inputRows);
      const selectedConstant = resolveReturnConstant(calcJson, constantsByName, outputEvaluationTestCase, allConstantsByName);
      visit(testCase, [index], null, testCase, selectedConstant);
    });
  } else {
    const currentCaseName = (typeof testJson?.name === 'string' || typeof testJson?.name === 'number')
      ? testJson.name
      : null;
    const inputRows = addInputComparisonRows(testJson, [], currentCaseName);
    const outputEvaluationTestCase = buildOutputEvaluationTestCase(testJson, [], inputRows);
    const selectedConstant = resolveReturnConstant(calcJson, constantsByName, outputEvaluationTestCase, allConstantsByName);
    visit(testJson, [], null, testJson, selectedConstant);
  }
  return { rows };
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
  current[lastPart] = cloneValue(nextValue);
}

function markRawJsonNumber(value) {
  return `__RAW_JSON_NUMBER__${value}`;
}

function isDecimalFieldType(fieldType) {
  return typeof fieldType === 'string' && /^decimal(\[\])*$/i.test(fieldType.trim());
}

function formatDecimalJsonNumber(value) {
  if (Object.is(value, -0)) {
    return '-0.0';
  }
  if (Number.isInteger(value)) {
    return value.toFixed(1);
  }
  return String(value);
}

function encodeTypedNumericValues(node) {
  if (Array.isArray(node)) {
    return node.map(item => encodeTypedNumericValues(item));
  }

  if (!node || typeof node !== 'object') {
    return node;
  }

  const encoded = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'value' && isDecimalFieldType(node.type)) {
      if (Array.isArray(value)) {
        encoded[key] = encodeDecimalNumericValues(value);
      } else if (typeof value === 'number') {
        encoded[key] = markRawJsonNumber(formatDecimalJsonNumber(value));
      } else {
        encoded[key] = encodeTypedNumericValues(value);
      }
      continue;
    }
    encoded[key] = encodeTypedNumericValues(value);
  }
  return encoded;
}

function encodeDecimalNumericValues(value) {
  if (Array.isArray(value)) {
    return value.map(item => encodeDecimalNumericValues(item));
  }
  return typeof value === 'number' ? markRawJsonNumber(formatDecimalJsonNumber(value)) : value;
}

function serializeTestJson(testJson) {
  return JSON.stringify(encodeTypedNumericValues(testJson), null, 2)
    .replace(/"__RAW_JSON_NUMBER__(.*?)"/g, '$1');
}

function applyPreviewRows(testJson, rows) {
  rows
    .filter(row => row?.canApply !== false)
    .forEach(row => setValueAtPath(testJson, row.valuePath, row.proposedValue));
  return testJson;
}

module.exports = {
  buildPreviewRows,
  applyPreviewRows,
  getDirectReturnConstant,
  deriveProposedValue,
  serializeTestJson
};
