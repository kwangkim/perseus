const assert = require("assert");
const PerseusMarkdown = require("../../perseus-markdown.jsx");
const TreeTransformer = require("../tree-transformer.js");

describe("Individual lint rules tests", () => {
    function testRule(rule, markdown) {
        const tree = PerseusMarkdown.parse(markdown);
        const tt = new TreeTransformer(tree);
        const warnings = [];
        tt.traverse((node, state, content) => {
            const check = rule.check(node, state, content);
            if (check) {
                warnings.push(check);
            }
        });

        return warnings.length === 0 ? null : warnings;
    }

    function expectWarning(rule, strings) {
        if (typeof strings === "string") {
            strings = [strings];
        }

        it(`Rule ${rule.name} warns`, () => {
            for (const string of strings) {
                assert.ok(
                    testRule(rule, string) !== null,
                    `Expected ${rule.name} to warn for:\n'${string}'`
                );
            }
        });
    }

    function expectPass(rule, strings) {
        if (typeof strings === "string") {
            strings = [strings];
        }

        it(`Rule ${rule.name} passes`, () => {
            for (const string of strings) {
                assert.ok(
                    testRule(rule, string) === null,
                    `Expected ${rule.name} to pass for:\n'${string}'`
                );
            }
        });
    }

    // 299 characters
    const sentence = new Array(25).fill("lorem ipsum").join(" ");

    // long-paragraph rule warns about paragraphs over 500 characters
    expectWarning(require("../rules/long-paragraph.js"), sentence + sentence);
    expectPass(require("../rules/long-paragraph.js"), [
        sentence,
        sentence + "\n\n" + sentence,
    ]);

    expectWarning(require("../rules/heading-level-1.js"), "# Level 1 heading");
    expectPass(
        require("../rules/heading-level-1.js"),
        "## Level 1 heading\n\n### Level 3 heading"
    );

    expectWarning(
        require("../rules/heading-level-skip.js"),
        "## heading 1\n\n#### heading 2"
    );
    expectPass(require("../rules/heading-level-skip.js"), [
        "## heading 1\n\n### heading 2\n\n#### heading 3\n\n### heading 4",
        "## heading 1\n\n##heading 2\n\n##heading3",
    ]);

    expectWarning(
        require("../rules/heading-title-case.js"),
        "## This Heading is in Title Case"
    );
    expectPass(require("../rules/heading-title-case.js"), [
        "## This heading is in sentence case",
        "## Acronyms: The CIA, NSA, DNI, and FBI",
        "## The Great War",
    ]);

    expectWarning(require("../rules/heading-sentence-case.js"), [
        "## this heading is uncapitalized",
        "## 'this' heading is uncapitalized",
        "##   this heading is uncapitalized",
    ]);
    expectPass(require("../rules/heading-sentence-case.js"), [
        "## This heading is in sentence case",
        "## 'This heading too'",
        "## 2 + 2 = 4",
    ]);

    expectWarning(require("../rules/nested-lists.js"), [
        "1. outer\n  * nested\n  *nested",
        " + outer\n\n   1. nested",
    ]);
    expectPass(require("../rules/nested-lists.js"), [
        "-one\n-two\n-three",
        "1. one\n 2. two\n3. three",
        " * one\n\n * two\n\n * three",
    ]);

    expectWarning(require("../rules/image-alt-text.js"), [
        "![](http://google.com/)",
        '![](http://google.com/ "title")',
        "![][url-ref]",
        "![ ](http://google.com/)",
        "![ \t\n ](http://google.com/)", // all whitespace
        "![blah](http://google.com/)", // too short to be meaningful
    ]);

    expectPass(require("../rules/image-alt-text.js"), [
        "![alt-text](http://google.com)",
        '![alternative text](http://google.com/ "title")',
        "![alt alt alt][url-ref]",
    ]);

    expectWarning(require("../rules/blockquoted-math.js"), [
        "> $1$",
        "Quote:\n\n> $x$\n\n",
    ]);
    expectPass(require("../rules/blockquoted-math.js"), [
        "$x$",
        "\n$x$\n  $y$\n",
        "> bq #1\n\n$x+y=1$\n\n> bq #2",
    ]);

    expectWarning(require("../rules/blockquoted-widget.js"), [
        "> [[☃ passage 1]]",
    ]);
    expectPass(require("../rules/blockquoted-widget.js"), [
        "[[☃ passage 1]]",
        "> bq #1\n\nTesting [[☃ passage 1]] testing\n\n> bq #2",
    ]);

    expectWarning(require("../rules/link-click-here.js"), [
        "[click here](http://google.com)",
        "[Click here, please](http://google.com)",
        "[For a good time, Click Here](http://google.com)",
    ]);
    expectPass(require("../rules/link-click-here.js"), [
        "[click to activate this link here](http://google.com)",
    ]);

    expectWarning(require("../rules/link-image-url.js"), [
        // Warn about absolute khanacademy.org urls
        "[target](http://khanacademy.org/about)",
        "[target](https://khanacademy.org/about)",
        "[target](http://www.khanacademy.org/about)",
        "[target](https://www.khanacademy.org/about)",
        "[target](http://es.khanacademy.org/about)",
        "[target](https://es.khanacademy.org/about)",
        "[target](//www.khanacademy.org/about)",
        "[target](//www.khanacademy.org/about)",

        // Warn about URLs to non-ka sites
        "[target](https://google.com/)",
        "[target](https://s3.amazonaws.com/)",
        "[target](https://mykhanacademy.org/)",
        "[target](https://khanacademy.org:81/)",
        "[target](https://sal@khanacademy.org/)",

        // We should get the same warnings for images
        "![alt text](http://khanacademy.org/about)",
        "![alt text](https://www.khanacademy.org/about)",
        "![alt text](https://es.khanacademy.org/about)",
        "![alt text](https://google.com/)",
        "![alt text](https://s3.amazonaws.com/)",
    ]);
    expectPass(require("../rules/link-image-url.js"), [
        "[target](/about)", // relative URLs okay
        "[target](https://kasandbox.org/path)",
        "[target](https://fastly.kastatic.org/path)",
        "[target](https://cdn.kastatic.org/path)",
        "[target](https://ka-perseus-images.s3.amazonaws.com/path)",
        "[target](https://KA-youtube-converted.s3.amazonaws.com)",
        // Same warnings for images
        "![alt text](/about)",
        "![alt text](https://cdn.kastatic.org/path)",
        "![alt text](https://ka-perseus-images.s3.amazonaws.com/path)",
    ]);

    expectWarning(require("../rules/image-in-table.js"), [
        "|col1|col2|\n|----|----|\n|![alt-text](/link.gif)|cell2|",
    ]);
    expectPass(require("../rules/image-in-table.js"), [
        "![alt-text](/link.gif)\n|col1|col2|\n|----|----|\n|cell1|cell2|",
    ]);

    expectWarning(require("../rules/widget-in-table.js"), [
        "|col1|col2|\n|----|----|\n|[[☃ passage 1]]|cell2|",
    ]);
    expectPass(require("../rules/widget-in-table.js"), [
        "[[☃ passage 1]]\n|col1|col2|\n|----|----|\n|cell1|cell2|",
    ]);

    expectWarning(require("../rules/table-missing-cells.js"), [
        "|col1|col2|col3|\n|----|----|----|\n|col1|col2|col3|\n|cell1|cell2|",
        "|col1|col2|col3|\n|----|----|----|\n|col1|col2|\n|cell1|cell2|",
        "|col1|col2|\n|----|----|\n|cell1|cell2|\n|cell1|cell2|cell3|",
        "|col1|\n|----|----|\n|col1|\n|cell1|cell2|",
        "|col1|col2|\n|----|----|\n|col1|\n|cell1|cell2|",
    ]);
    expectPass(require("../rules/table-missing-cells.js"), [
        "|col1|col2|\n|----|----|\n|cell1|cell2|\n|cell1|cell2|",
        "|cell1|\n|----|\n|cell2|\n|cell3|",
    ]);
});
