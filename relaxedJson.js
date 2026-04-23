function stripBom(text) {
  return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

function stripJsonComments(text) {
  let result = '';
  let inString = false;
  let escaping = false;

  for (let index = 0; index < text.length; index++) {
    const current = text[index];
    const next = text[index + 1];

    if (inString) {
      result += current;
      if (escaping) {
        escaping = false;
      } else if (current === '\\') {
        escaping = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }

    if (current === '/' && next === '/') {
      index += 2;
      while (index < text.length && text[index] !== '\n') index++;
      if (index < text.length) result += text[index];
      continue;
    }

    if (current === '/' && next === '*') {
      index += 2;
      while (index < text.length - 1 && !(text[index] === '*' && text[index + 1] === '/')) index++;
      index++;
      continue;
    }

    result += current;
  }

  return result;
}

function stripTrailingCommas(text) {
  let result = '';
  let inString = false;
  let escaping = false;

  for (let index = 0; index < text.length; index++) {
    const current = text[index];

    if (inString) {
      result += current;
      if (escaping) {
        escaping = false;
      } else if (current === '\\') {
        escaping = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }

    if (current === ',') {
      let lookAhead = index + 1;
      while (lookAhead < text.length && /\s/.test(text[lookAhead])) lookAhead++;
      if (text[lookAhead] === '}' || text[lookAhead] === ']') {
        continue;
      }
    }

    result += current;
  }

  return result;
}

function parseRelaxedJson(text) {
  const sanitized = stripTrailingCommas(stripJsonComments(stripBom(text)));
  return JSON.parse(sanitized);
}

module.exports = {
  parseRelaxedJson,
  stripJsonComments,
  stripTrailingCommas
};
