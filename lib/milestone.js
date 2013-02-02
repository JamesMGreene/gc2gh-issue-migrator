/*
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2013 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

/**
* Definition of properties gleaned from:
*   http://developer.github.com/v3/issues/milestones/#create-a-milestone
*   https://gist.github.com/7f75ced1fa7576412901/006a7c69f57521e026be85937c9641e861e81802
*/
var milestoneFields = [
	'number',
	'title',
	'state',
	'description',
	'due_on',
	'created_at',
	'updated_at',
	'creator'
];

/**
*
*/
var Milestone = function(values) {
	// Allow `Milestone()` to work the same as `new Milestone()`
	if (!(this instanceof Milestone)) {
		return new Milestone(values);
	}
	
	var me = this;
	
	milestoneFields.map(function(e) {
		Object.defineProperty(me, e, {
			value: values ? (values[e] || null) : null,
			writable: true,
			enumerable: true
		});
	});
	
	// Seal it off!
	Object.seal(me);
	
	return me;
};

/**
*
*/
Milestone.prototype.toRawMilestone = function() {
	var rawMilestone = {
		'number': this.number,
		'title': this.title,
		'state': (typeof this.state !== 'string' || this.state.toLowerCase() !== 'closed' ? 'open' : 'closed'),
		'description': this.description,
		'due_on': this.due_on || null,
		'created_at': this.created_at || null,
		'updated_at': this.updated_at || this.created_at || null,
		'creator':
			(function(creator) {
				var userObj = {},
					userKeyType = (creator.indexOf('@') !== -1) ? 'email' : 'login';
				userObj[userKeyType] = creator;
				return userObj;
			})(this.creator)
	};
	return rawMilestone;
};


// Export!
module.exports = Milestone;
