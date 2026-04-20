const OR = require('./OR');
const MN = require('./MN');
const CO = require('./CO');

const ALL_STATE_NAMES = {
  AM: 'Asset Manager',
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DC: 'Washington DC',
  DE: 'Delaware',
  FD: 'Federal',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MIC: 'Michigan Cities',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MOC: 'Missouri Cities',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NYC: 'New York Cities',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OHC: 'Ohio Cities',
  OK: 'Oklahoma',
  OR: 'Oregon',
  ORC: 'Oregon Cities',
  PA: 'Pennsylvania',
  PAC: 'Pennsylvania Cities',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming'
};

function buildGenericState(code, name) {
  return {
    code,
    name,
    formName: 'Constants Maintenance',
    incomeLineLabel: 'Year-over-year DateTime constants',
    filingStatuses: []
  };
}

const STATE_REGISTRY = Object.fromEntries(
  Object.entries(ALL_STATE_NAMES).map(([code, name]) => [code, buildGenericState(code, name)])
);

Object.assign(STATE_REGISTRY, { OR, MN, CO });

module.exports = {
  STATE_REGISTRY,
  getState: (code) => STATE_REGISTRY[code] || null,
  getAllStates: () => Object.values(STATE_REGISTRY).sort((left, right) => left.name.localeCompare(right.name))
};
