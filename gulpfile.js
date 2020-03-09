/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

const fsextra = require("fs-extra");
const gulp = require("gulp");
const tsc = require("gulp-typescript");
const tslint = require("gulp-tslint");
const typedoc = require("gulp-typedoc");
const path = require("path");

/**
 * Clean distribution folder
 */
gulp.task("clean", () => {
    return fsextra.emptyDir("dist");
});

/**
 * Transpile TS into JS code, using TS compiler in local typescript npm package.
 * Remove all comments except copyright header comments, and do not generate
 * corresponding .d.ts files (see task "transpile:dts").
 */
gulp.task("transpile:ts", () => {
    const tscConfig = require("./tsconfig.json");
    return gulp
        .src(["src/**/*.ts"])
        .pipe(tsc(Object.assign(tscConfig.compilerOptions, {
            removeComments: true,
            declaration: false,
        })))
        .pipe(gulp.dest("dist"));
});

/**
 * Only emit TS declaration files, using TS compiler in local typescript npm
 * package. The generated declaration files include all comments so that IDEs
 * can provide this information to developers.
 */
gulp.task("transpile:dts", () => {
    const tscConfig = require("./tsconfig.json");
    return gulp
        .src(["src/**/*.ts"])
        .pipe(tsc(Object.assign(tscConfig.compilerOptions, {
            removeComments: false,
            declaration: true,
        })))
        .dts
        .pipe(gulp.dest("dist"));
});

gulp.task("copy:assets", () => {
    return gulp
        .src([
            "README.md",
            "LICENSE",
            "package.json",
        ])
        .pipe(gulp.dest("dist"));
});

/**
 * Lint the code
 */
gulp.task("lint", () => {
    return gulp
        .src(["src/**/*.ts"])
        .pipe(tslint({
            configuration: "./tslint.json",
            formatter: "verbose",
        }))
        .pipe(tslint.report({
            emitError: false,
            summarizeFailureOutput: true
        }));
});

/**
 * Lint the code and fix lint errors
 */
gulp.task("lint:fix", () => {
    return gulp
        .src(["src/**/*.ts"])
        .pipe(tslint({
            configuration: "./tslint.json",
            formatter: "verbose",
            fix: true
        }))
        .pipe(tslint.report({
            emitError: false,
            summarizeFailureOutput: true
        }));
});

/** 
 * Generate TypeDoc HTML documentation
 */
gulp.task("doc", () => {
    const typedocOptions = require(path.resolve("./typedoc.js"));

    fsextra.emptyDirSync(typedocOptions.out);

    return gulp
        .src(["src/**/*.ts"])
        .pipe(typedoc(Object.assign(typedocOptions)));
});

gulp.task("build", gulp.series("clean", "transpile:ts", "transpile:dts", "copy:assets", "lint"));

gulp.task("default", gulp.series("build"));
