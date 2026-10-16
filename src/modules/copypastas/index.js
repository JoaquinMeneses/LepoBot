import * as command from './command.js';
import * as components from './components.js';
import * as events from './events.js';

export default {
  name: 'copypastas',
  commands: [{ data: command.data, execute: command.execute }],
  components: [{ prefix: 'lc-copypastas', handle: components.handle }],
  init: (client) => events.register(client),
};
