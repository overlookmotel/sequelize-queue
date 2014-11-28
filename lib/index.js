// --------------------
// Sequelize queue
// --------------------

// modules
var _ = require('lodash'),
	Promise = require('bluebird');

// exports

// Queue class
var Queue = module.exports = function(sequelize, options) {
	// set default options
	this.options = options = _.extend({
		modelName: 'queue'
	}, options || {});
	
	// save options to this
	_.extend(this, {
		model: options.model,
		processors: options.processors || {},
		successHandlers: options.successHandlers || {},
		errorHandlers: options.errorHandlers || {}
	});
	
	// if only one processor or errorHandler, make it of default type
	if (_.isFunction(this.processors)) this.processors = {default: this.processors};
	if (_.isFunction(this.errorHandlers)) this.errorHandlers = {default: this.errorHandlers};
	
	// save sequelize to this
	this.sequelize = sequelize;
	
	// set running as false
	this.running = false;
	this.started = false;
};

// priority constants
_.extend(Queue, {
	PRIORITY_HIGH: 20,
	PRIORITY_DEFAULT: 10,
	PRIORITY_LOW: 0
});

// prototype methods
_.extend(Queue.prototype, {
	// initializes model
	// returns a Promise
	init: function() {
		// create sequelize model for queue
		if (this.model) {
			return Promise.resolve();
		} else {
			var Sequelize = this.sequelize.Sequelize;
			if (!Sequelize.DATETIME) Sequelize.DATETIME = Sequelize.DATE;
			
			this.model = this.sequelize.define(this.options.modelName, {
				type: {
					type: Sequelize.STRING(100),
					allowNull: false
				},
				priority: {
					type: Sequelize.INTEGER,
					allowNull: false,
					defaultValue: Queue.PRIORITY_DEFAULT
				},
				data: {
					type: Sequelize.TEXT,
					allowNull: true
				},
				result: {
					type: Sequelize.TEXT,
					allowNull: true
				},
				running: {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: false
				},
				done: {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: false
				},
				failed: {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: false
				},
				dateAdded: {
					type: Sequelize.DATETIME,
					allowNull: false
				},
				dateStarted: {
					type: Sequelize.DATETIME,
					allowNull: true
				},
				dateFinished: {
					type: Sequelize.DATETIME,
					allowNull: true
				}
			});
			
			return this.model.sync()
			.return();
		}
	},
	
	// starts processing any jobs in the queue
	// does not return
	start: function() {
		this.started = true;
		runQueue(this);
	},
	
	// adds a job to the queue
	// return a Promise
	addJob: function(data, type, priority) {
		// conform input
		if (type == undefined) type = 'default';
		if (priority == undefined) priority = Queue.PRIORITY_DEFAULT;
		
		// check there is a processor for this type of job
		if (!this.processors[type]) return Promise.reject(new Error("No processor defined for a job of type '" + type + "'"));
		
		// turn data into JSON
		data = ((data !== undefined) ? JSON.stringify(data) : null);
		
		return Promise.bind(this).then(function() {
			// add job to queue
			return this.model.create({
				type: type,
				priority: priority,
				data: data,
				dateAdded: new Date()
			});
		}).then(function(job) {
			// run the queue
			if (this.started) runQueue(this);
			
			// return the job model instance
			return job;
		});
	}
});

function runQueue(queue) {
	// if already in process, exit
	if (queue.running) return;
	
	// flag queue as in process
	queue.running = true;
	
	// run the next job
	var transaction;
	return Promise.try(function() {
		// start transaction
		return queue.sequelize.transaction()
		.then(function(_transaction) {
			transaction = _transaction;
		});
	}).then(function() {
		// get next item in queue
		return queue.model.find({where: {done: false, running: false, failed: false}, order: [['priority', 'DESC'], ['dateAdded', 'ASC']]}, {transaction: transaction});
	}).tap(function(job) {
		// set as running
		if (job) return job.updateAttributes({running: true, dateStarted: new Date()}, {transaction: transaction});
	})
	.tap(function() {
		// commit transaction
		return transaction.commit();
	})
	.catch(function(err) {
		// if error, rollback transaction and rethrow error
		return Promise.try(function() {
			if (transaction) return transaction.rollback();
		})
		.then(function() {
			// rethrow error
			return Promise.reject(err);
		});
	})
	.then(function(job) {
		// if no job found, stop queue running until another job is added
		if (!job) {
			queue.running = false;
			return;
		}
		
		// run the job
		return queue.processors[job.type](JSON.parse(job.data))
		.then(function(result) {
			// mark job as done
			job.running = false;
			job.done = true;
			job.dateFinished = new Date();
			job.result = JSON.stringify(result);
			return job.save()
			.then(function() {
				var successHandler = queue.successHandlers[job.type];
				if (successHandler) successHandler(job.result, job.id);
			})
			.catch(function(err) {
				var errorHandler = queue.errorHandlers[job.type];
				if (errorHandler) errorHandler(err, job.data, job.id);
			});
		})
		.catch(function(err) {
			// mark job as failed
			job.running = false;
			job.failed = true;
			job.dateFinished = new Date();
			job.result = JSON.stringify(err);
			return job.save()
			.then(function() {
				var errorHandler = queue.errorHandlers[job.type];
				if (errorHandler) errorHandler(err, job.data);
			});
		})
		.then(function() {
			// flag as not currently running
			queue.running = false;
			
			// run again
			process.nextTick(function() {
				runQueue(queue);
			});
		});
	});
}
