import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("contrato dos botões", () => {
  it("não deixa botão sem ação ou envio de formulário", () => {
    const root = resolve(process.cwd());
    const failures: string[] = [];
    for (const file of sourceFiles(resolve(root, "src"))) {
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          if (node.tagName.getText(source) === "button") {
            const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
            const hasClick = attributes.some((attribute) => attribute.name.getText(source) === "onClick");
            const type = attributes.find((attribute) => attribute.name.getText(source) === "type")?.initializer?.getText(source).replace(/["']/g, "");
            const ariaCurrent = attributes.find((attribute) => attribute.name.getText(source) === "aria-current")?.initializer?.getText(source).replace(/["']/g, "");
            const isCurrentNavigationItem = ariaCurrent === "page";
            if (!hasClick && type !== "submit" && !isCurrentNavigationItem) {
              const position = source.getLineAndCharacterOfPosition(node.getStart(source));
              failures.push(`${relative(root, file)}:${position.line + 1}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(failures, `Botões sem função: ${failures.join(", ")}`).toEqual([]);
  });
});
