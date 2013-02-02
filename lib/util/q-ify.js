/*
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2012 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

// External modules
var Q = require('q');

/**
* @returns The same object but with all functions turned into Q promises
*/
var Qify = function(obj) {
	if (obj == null) {
		throw new TypeError('`obj` is not an object');
	}

	// Pre-bind all the Node promises for Q
	Object.keys(obj).forEach(function(key) {
		console.log('typeof obj[' + key + '] = ' + (typeof obj[key]));
		if (typeof obj[key] === 'function') {
			obj[key] = Q.nfbind(obj[key].bind(obj));
		}
	});

	return obj;
};


// Export!
module.exports = Qify;
