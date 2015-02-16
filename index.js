#!/usr/bin/env node
var fs = require('fs')
var respawn = require('respawn')
var chalk = require('chalk')
var updateNotifier = require('update-notifier')
var yargs = require('yargs')
var gaze = require('gaze')
var _ = require('lodash')
var debug = require('debug')('cult')
var pkg = require('./package.json')

args = yargs
  .alias('w', 'watch')
  .argv

/*
* Functions
*/

function findGulpfile() {
  var filenames = fs.readdirSync(process.cwd())
  for (var i in filenames) {
    if (filenames[i].toLowerCase().indexOf('gulpfile.') !== -1) return filenames[i]
  }
}

function log(str) {
  console.log('[' + chalk.cyan('cult') + '] ' + str)
}

/*
* Program
*/

// Check for updates
updateNotifier({packageName: pkg.name, packageVersion: pkg.version}).notify()

// Files to watch
var watched = [];

// Keep gulp arguments
var gulpArgs = _.rest(process.argv, 2)

if (args.watch) {
  gulpArgs = args._
  watched.push(args.watch)
}

// Find gulpfile
var gulpfile = findGulpfile()

// Set process options
var options = {
  kill: 5000, // kill after 5 seconds
  stdio: 'inherit'
}

// Create process monitor
var monitor = respawn(['gulp'].concat(gulpArgs), options)
monitor.maxRestarts = 0

// If on Windows and gulp fails, try to replace it with gulp.cmd
monitor.on('warn', function(err) {
  if (err.code === 'ENOENT') {
    if (process.platform === 'win32') {
      monitor = respawn(['gulp.cmd'].concat(gulpArgs), options)
      monitor.maxRestarts = 0
      monitor.on('warn', function(err) {
        if (err.code === 'ENOENT') {
          log(
            'Error, can\'t find ' + chalk.magenta('gulp') + ' or '
            + chalk.magenta('gulp.cmd') + ' command in $PATH, try running: '
            + 'npm install -g gulp'
          )
          process.exit(1)
        }
      })
      monitor.start()
    } else {
      log('Error, can\'t find ' + chalk.magenta('gulp') + ' command in $PATH, '
      + 'try running: npm install -g gulp')
      process.exit(1)
    }
  }
})

// Start cult
if (gulpfile) {
  watched.unshift(gulpfile)

  debug('process.argv %o', process.argv)
  debug('All args %o', args)
  debug('Gulp args %o', gulpArgs)
  debug('Watching %o', watched)

  log('Watching ' + chalk.magenta(watched.join(', ')))

  gaze(watched, function(err, watcher) {
    if (err) { throw err }

    this.on('changed', function (filepath) {
      log('Gulpfile changed, reloading...')
      debug('File path:' + filepath)

      monitor.stop(function() {
        monitor.start()
      })
    })
  })

  process.on('SIGINT', function() {
    monitor.stop(function() {
      process.exit()
    })
  })

  monitor.start()
} else {
  return log('Can\'t find gulpfile')
}
