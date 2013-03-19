/*!
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2012 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

// External modules
var qify = require('./q-ify');
var gcph = require('gcph-client');

module.exports = function(opts) {
	return qify(new gcph.Client(opts));
};
