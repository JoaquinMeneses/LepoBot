const command = require('./command');
const scheduler = require('./scheduler');

module.exports = {
  name: 'birthdays',
  commands: [command],
  init: (client) => scheduler.start(client),
};
