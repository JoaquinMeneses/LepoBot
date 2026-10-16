const command = require('./command');
const components = require('./components');
const scheduler = require('./scheduler');

module.exports = {
  name: 'lepocine',
  commands: [command],
  components: [{ prefix: 'lepocine', handle: components.handle }],
  init: (client) => scheduler.start(client),
};
