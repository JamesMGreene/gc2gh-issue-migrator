/*!
 * gc2gh-issue-migrator
 * https://github.com/JamesMGreene/gc2gh-issue-migrator
 *
 * Copyright (c) 2012 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

// External modules
var Qify = require('./q-ify');
var gcph = require('gcph-client');

module.exports = function(opts) {
	return Qify(new gcph.Client(opts));
};
