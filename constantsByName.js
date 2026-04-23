function buildConstantsByName(data, options = {}) {
  const constants = Array.isArray(data?.Constants) ? data.Constants : [];
  const yearOverYearOnly = options.yearOverYearOnly === true;
  return Object.fromEntries(constants
    .filter(entry => !yearOverYearOnly || entry?.Maintenance === 'Year Over Year')
    .filter(entry => typeof entry?.Name === 'string' && entry.Name.trim())
    .map(entry => [entry.Name.trim(), entry.Value]));
}

module.exports = {
  buildConstantsByName
};
