import * as command from './command.js';
import * as components from './components.js';
import * as events from './events.js';

export default {
  name: 'tagrole',
  commands: [{ data: command.data, execute: command.execute }],
  components: [{ prefix: 'lc-tagrole', handle: components.handle }],
  init: (client) => events.register(client),
};
