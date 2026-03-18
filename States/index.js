const OR = require('./OR');
const MN = require('./MN');

const STATE_REGISTRY = { OR, MN };

module.exports = {
  STATE_REGISTRY,
  getState: (code) => STATE_REGISTRY[code] || null,
  getAllStates: () => Object.values(STATE_REGISTRY)
};
