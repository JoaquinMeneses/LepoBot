import * as command from './command.js';
import * as scheduler from './scheduler.js';

export default {
  name: 'birthdays',
  commands: [{ data: command.data, execute: command.execute }],
  components: [{ prefix: 'lc-birthdays', handle: command.handle }],
  init: (client) => scheduler.start(client),
};
