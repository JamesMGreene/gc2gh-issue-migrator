'use strict';

module.exports = function(grunt) {

	grunt.initConfig({
		jshint: {
			options: {
				jshintrc: '.jshintrc'
			},
			gruntfile: {
				src: 'Gruntfile.js'
			},
			lib: {
				src: ['lib/**/*.js']
			},
			examples: {
				src: ['examples/**/*.js']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');

	// Default task.
	grunt.registerTask('default', ['jshint']);
	// Travis-CI task
	grunt.registerTask('travis', ['jshint']);
};
