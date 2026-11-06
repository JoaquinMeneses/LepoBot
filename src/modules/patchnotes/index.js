import * as command from './command.js';

export default {
  name: 'patchnotes',
  commands: [{ data: command.data, execute: command.execute }],
};
