
module.exports = function(grunt){

	grunt.initConfig({
		php: {
			demo: {
				options: {
					hostname: "localhost",
					port: 8080,
					base: ".",
					keepalive: true
				}
			}
		}
	});

	grunt.registerTask("dev", ["php:demo"]);

	grunt.loadNpmTasks("grunt-php");

};