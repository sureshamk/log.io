module.exports = {
  apps: [
    {
      name: 'server',
      script: './lib/index.js',
      watch: process.env.FILE_WATCH === '1',
      cwd: '.',
      ignore_watch:
                [
                  '[\\/\\\\]\\./',
                  'pids',
                  'logs',
                  'log',
                  'node_modules',
                  'bower_components',
                  '.git',
                  '.idea'
                ]
    }
  ]
};
