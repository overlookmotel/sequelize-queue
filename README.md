# sequelize-queue.js

[![Greenkeeper badge](https://badges.greenkeeper.io/overlookmotel/sequelize-queue.svg)](https://greenkeeper.io/)

# A worker queue persisted to a Sequelize model

## What's it for?

Uses [Sequelize](http://sequelizejs.com/) to implement a worker queue.

Packages like [queue](https://www.npmjs.org/package/queue) do a very nice job of keeping an in-memory job queue. But what about longer jobs where there's a danger that the process might crash before all the jobs are complete? Saving the jobs to a database via Sequelize comes to the rescue!

## Current status

[![Build Status](https://secure.travis-ci.org/overlookmotel/sequelize-queue.png?branch=master)](http://travis-ci.org/overlookmotel/sequelize-queue)
[![Dependency Status](https://david-dm.org/overlookmotel/sequelize-queue.png)](https://david-dm.org/overlookmotel/sequelize-queue)

API should be stable. It's not well-tested yet and doesn't have features like retrying on unsuccessful job execution etc.

## Usage

### Loading module

To load module:

	var Queue = require('sequelize-queue');

### Initialization

	// create queue
	var queue = new Queue(this.sequelize, {
		processors: function(data) {
			// worker function that executes the jobs
			// return a Promise
		}
	});
	
	// initialize the MySQL table which will contain the job list
	queue.init().then(function() {
		// this runs once the queue is up and running
		
		// start workers running
		queue.start();
		
		// now do something else - the jobs will execute in the background
	});

### Add jobs to the queue

	queue.addJob(data).then(function(job) {
		// this executes once the job is added to the queue NOT when the job is complete
		
		// `job` is a sequelize model instance with the details of the job
		// it can be reloaded from db and examined to get current status of the job
	});

## Tests

Use `npm test` to run the tests.
Requires a database called 'sequelize_test' and a db user 'sequelize_test' with no password.

## Changelog

See changelog.md

## Issues

### Known issues

* Does not work with SQLite

### Reporting issues

If you discover a bug, please raise an issue on Github. https://github.com/overlookmotel/sequelize-queue/issues
