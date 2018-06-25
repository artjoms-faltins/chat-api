'use strict';

const gulp = require('gulp');
const nodemon = require('gulp-nodemon');

gulp.task('start', () => {
    let app;

    if (app) {
        try {
            app.stop();
        } catch (e) {}
    }
    app = nodemon({
        script: 'server/server.js',
        ext: 'js',
        env: {
            'NODE_ENV': 'development'
        },
        ignore: [
            'node_modules/**/*',
            'server/test/**/*',
            'gulpfile.js',
            '.gitignore'
        ],
    }).on('restart', () => {
        console.log('Server restarting...');
    });
});

gulp.task('default', ['start']);