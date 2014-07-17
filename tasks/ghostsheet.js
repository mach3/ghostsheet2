/**
 * Grunt Task: "ghostsheet"
 * ------------------------
 */

module.exports = function(grunt){
	var gs = new (require("../jslib/ghostsheet.js"));

	grunt.registerMultiTask("ghostsheet", "", function(){
		var done = this.async();

		this.files.forEach(function(item){
			var key = item.orig.src[0];

			gs.fetch(key)
			.then(function(data){
				if(grunt.file.write(item.dest, JSON.stringify(data))){
					grunt.log.writeln("Fetch data: " + key);
				} else {
					grunt.log.error("Failed to save: " + item.dest);
				}
			})
			.fail(function(){
				grunt.log.error("Failed to fetch: " + key);
			});
		});
	});

};
