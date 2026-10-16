import * as command from './command.js';
import * as components from './components.js';
import * as scheduler from './scheduler.js';

export default {
  name: 'lepocine',
  commands: [{ data: command.data, execute: command.execute }],
  components: [{ prefix: 'lepocine', handle: components.handle }],
  init: (client) => scheduler.start(client),
};
