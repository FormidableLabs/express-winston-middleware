var _ = require("lodash"),
  dox = require("dox");

// Marked: Process heading text into ID.
var _headingId = function (text) {
  return text.toLowerCase().replace(/[^\w]+/g, "-");
};

// Generate Markdown API snippets from dox object.
var _genApi = function (obj) {
  var toc = [],
    tocTmpl = _.template("* [<%= heading %>](#<%= id %>)\n"),
    sectionTmpl = _.template("### <%= summary %>\n\n<%= body %>\n");

  // Finesse comment markdown data.
  // Also, statefully create TOC.
  var sections = _.chain(obj)
    .filter(function (c) {
      return !c.isPrivate && !c.ignore && _.any(c.tags, function (t) {
        return t.type === "api" && t.visibility === "public";
      });
    })
    .map(function (c) {
      // Add to TOC.
      toc.push(tocTmpl({
        heading: c.description.summary,
        id: _headingId(c.description.summary)
      }));

      return sectionTmpl(c.description);
    })
    .value()
    .join("");

  return "\n" + toc.join("") + "\n" + sections;
};

module.exports = function (grunt) {
  // Strip comments from JsHint JSON files (naive).
  var _jshintCfg = function (name) {
    if (!grunt.file.exists(name)) { return "{}"; }

    var raw = grunt.file.read(name);
    return JSON.parse(raw.replace(/\/\/.*\n/g, ""));
  };

  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),

    jshint: {
      all: {
        options: _jshintCfg(".jshintrc-backend.json"),
        files: {
          src:  [
            "*.js",
            "examples/**/*.js"
          ]
        }
      }
    },

    jade: {
      compile: {
        options: {
          pretty: true
        },
        files: {
          "index.html": ["_templates/index.jade"],
        }
      }
    },

    watch: {
      "build-api": {
        files: [
          "index.js"
        ],
        tasks: [
          "build:api"
        ],
        options: {
          spawn: false,
          atBegin: true
        }
      },
      jade: {
        files: [
          "_templates/**/*.jade",
          "*.md",
          "index.js"
        ],
        tasks: [
          "jade"
        ],
        options: {
          spawn: false,
          atBegin: true
        }
      }
    }

  });

  // Dependencies
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-contrib-jade");

  // Build.
  grunt.registerTask("build:api", "Insert API into README", function () {
    var readme = grunt.file.read("README.md"),
      buf = grunt.file.read("index.js"),
      data = dox.parseComments(buf, { raw: true }),
      start = "## API",
      end = "## Contributions",
      re = new RegExp(start + "(\n|.)*" + end, "m"),
      md = _genApi(data),
      updated = readme.replace(re, start + "\n" + md + end);

    grunt.file.write("README.md", updated);
  });
  grunt.registerTask("build",     ["build:api", "jade"]);

  // Tasks.
  grunt.registerTask("check",     ["jshint"]);
  grunt.registerTask("default",   ["check", "build"]);
};
