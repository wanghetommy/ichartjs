module.exports = function(grunt){

    var banner = '/**\n'+
        '* <%= pkg.name %> Library v<%= pkg.version %> http://www.ichartjs.com/\n'+
        '* @date <%= grunt.template.today("yyyy-mm-dd") %>\n'+
        '* @author taylor wong\n'+
        '* @Copyright 2013 wanghetommy@gmail.com Licensed under the Apache License, Version 2.0 (the "License");\n'+
        '* you may not use this file except in compliance with the License.\n'+
        '* You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0\n'+
        '*/;\n';

    // 项目配置
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                //separator: ';',
                banner:banner
            },
            dist: {
                src: [
                    'src/ichart.core.js',
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
                dest: 'ichart.<%= pkg.version %>.src.js'
            }
        },
        uglify: {
            options: {
                banner:banner
            },
            build: {
                src: 'ichart.<%= pkg.version %>.src.js',
                dest: 'ichart.<%= pkg.version %>.min.js'
            }               
        }

    });

    // 加载提供"uglify"任务的插件
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');

    // 默认任务
    grunt.registerTask('default', ['concat','uglify']);
}
