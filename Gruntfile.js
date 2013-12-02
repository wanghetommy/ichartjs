module.exports = function(grunt){

    var banner = '/**\n'+
        '* <%= pkg.name %> Library v<%= pkg.version %> http://www.ichartjs.com/\n'+
        '* @date <%= grunt.template.today("yyyy-mm-dd hh:MM") %>\n'+
        '* @author taylor wong\n'+
        '* @Copyright 2013 wanghetommy@gmail.com Licensed under the Apache License, Version 2.0 (the "License");\n'+
        '* you may not use this file except in compliance with the License.\n'+
        '* You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0\n'+
        '*/;\n';

    var srcFile =  'ichart.<%= pkg.version %>.src.js';
    var minFile =  'ichart.<%= pkg.version %>.min.js';


    grunt.file.defaultEncoding = 'utf8';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            cat:{
                options: {
                },
                src: [
                    'src/ichart.element.js',
                    'src/ichart.html.js',
                    'src/ichart.painter.js',
                    'src/ichart.component.js',
                    'src/ichart.legend.js',
                    'src/ichart.label.js',
                    'src/ichart.chart.js',
                    'src/ichart.custom.js',
                    'src/ichart.sector.js',
                    'src/ichart.sector2d.js',
                    'src/ichart.sector3d.js',
                    'src/ichart.rectangle.js',
                    'src/ichart.rectangle2d.js',
                    'src/ichart.rectangle3d.js',
                    'src/ichart.column.js',
                    'src/ichart.column2d.js',
                    'src/ichart.column3d.js',
                    'src/ichart.columnmulti2d.js',
                    'src/ichart.columnmulti3d.js',
                    'src/ichart.columnstacked2d.js',
                    'src/ichart.columnstacked3d.js',
                    'src/ichart.bar.js',
                    'src/ichart.bar2d.js',
                    'src/ichart.barstacked2d.js',
                    'src/ichart.barmulti2d.js',
                    'src/ichart.tip.js',
                    'src/ichart.text.js',
                    'src/ichart.pie.js',
                    'src/ichart.pie2d.js',
                    'src/ichart.pie3d.js',
                    'src/ichart.donut2d.js',
                    'src/ichart.coordinate.js',
                    'src/ichart.crosshair.js',
                    'src/ichart.linesegment.js',
                    'src/ichart.crosshair.js',
                    'src/ichart.line.js',
                    'src/ichart.linebasic2d.js',
                    'src/ichart.area2d.js'
                ],
                dest: srcFile
            },
            dog:{
                options: {
                    //separator: ';',
                    banner:banner
                },
                src: [
                    'src/ichart.core.js',
                    srcFile
                ],
                dest: srcFile
            }
        },
        uglify: {
            options: {
                banner:banner
            },
            build: {
                src: srcFile,
                dest: minFile
            }               
        },
        build:{
            options: {
                banner:'(function($){\n',
                footer:'\n})(iChart);',
                target:srcFile,
                date:'<%= grunt.template.today("yyyy-mm-dd hh:MM") %>'
            }
        },
        copy:{
            options: {
                src:srcFile,
                min:minFile,
                destSrc :  'ichart.<%= pkg.version %>.src.beta.<%=grunt.template.today("yyyymmdd")%>.js',
                destMin:'ichart.<%= pkg.version %>.min.beta.<%=grunt.template.today("yyyymmdd")%>.js',
                dir:'../build_ichartjs/<%=grunt.template.today("yyyymmdd")%>/'
            }
        }
    });

    grunt.registerTask('build', 'build code', function() {
        var options = grunt.config.get(this.name).options;
        var target = options.target;
        if(!grunt.file.exists(target)){
            grunt.fail.warn(target+' is not found.');
        }
        var content = grunt.file.read(target);
        content = options.banner + content.replace(/iChart/g,"$")+options.footer;
        grunt.file.write(target,content);
        grunt.log.writeln("File "+target+" build success.");
    });

    grunt.registerTask('copy', 'copy js to build', function() {
        var options = grunt.config.get(this.name).options;
        grunt.file.copy(options.src,options.dir+options.destSrc);
        grunt.file.copy(options.min,options.dir+options.destMin);
        grunt.log.writeln("File copy to "+options.dir+" success.");
    });


    //loading plugins
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');

    //default task
    grunt.registerTask('default', ['concat:cat','build','concat:dog','uglify','copy']);
}
