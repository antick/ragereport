import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Linter } from "eslint";
import parser from "@typescript-eslint/parser";
import accessibility from "eslint-plugin-jsx-a11y-x";

test("project service accepts matching default-project files and rejects unmatched files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lint-project-"));
  const options = {
    tsconfigRootDir: directory,
    projectService: { allowDefaultProject: ["*.ts"] },
    filePath: join(directory, ".fixture.ts"),
  };
  try {
    const result = parser.parseForESLint("const value: number = 1;", options);
    assert.ok(result.services.program);
    assert.throws(
      () =>
        parser.parseForESLint("const value = 1;", {
          ...options,
          filePath: join(directory, "nested", "fixture.ts"),
        }),
      /not found by the project service/,
    );
  } finally {
    parser.clearCaches();
    await rm(directory, { recursive: true, force: true });
  }
});

test("accessibility component wildcards still detect missing labels and accept valid controls", () => {
  const linter = new Linter();
  const config = {
    plugins: { accessibility },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      "accessibility/label-has-associated-control": [
        "error",
        { labelComponents: ["Form*"], controlComponents: ["Input*"], assert: "nesting" },
      ],
    },
  };
  assert.deepEqual(linter.verify("<FormLabel>Name<InputText /></FormLabel>;", config), []);
  const errors = linter.verify("<FormLabel>Name</FormLabel>;", config);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].ruleId, "accessibility/label-has-associated-control");
  assert.deepEqual(linter.verify("<OtherLabel>Name</OtherLabel>;", config), []);
});
