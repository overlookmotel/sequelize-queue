// --------------------
// Sequelize queue
// Tests
// --------------------

// modules
var chai = require('chai'),
	expect = chai.expect,
	promised = require('chai-as-promised'),
	Support = require(__dirname + '/support'),
	Sequelize = Support.Sequelize,
	Promise = Sequelize.Promise,
	_ = require('lodash'),
	Queue = require('../lib/');

// init
chai.use(promised);
chai.config.includeStack = true;

// tests

describe(Support.getTestDialectTeaser('Tests'), function () {
	it('It works!', function() {
		var results = [];
		var queue = new Queue(this.sequelize, {
			processors: {
				default: function(data) {
					return Promise.delay(100).then(function() {
						results.push({b: data.a});
						return {b: data.a};
					});
				}
			}
		});
		
		return queue.init()
		.then(function() {
			queue.start();
			
			return Promise.each([1, 2, 3], function(num) {
				return queue.addJob({a: num});
			})
			.delay(500)
			.then(function() {
				expect(results).to.deep.equal([{b: 1}, {b: 2}, {b: 3}]);
				
				return queue.model.findAll({order: [['id']]})
				.then(function(results) {
					expect(results).to.be.ok;
					expect(results.length).to.equal(3);
					
					results.forEach(function(result, index) {
						var data = JSON.parse(result.result);
						expect(data.b).to.equal(index + 1);
					});
				});
			});
		});
	});
});
