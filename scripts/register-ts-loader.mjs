import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      const resolved = resolveRelativeSpecifier(specifier, context.parentURL);
      if (resolved) {
        return { url: resolved, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (!url.startsWith("file:") || extname(fileURLToPath(url)) !== ".ts") {
      return nextLoad(url, context);
    }

    const source = readFileSync(fileURLToPath(url), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      },
      fileName: fileURLToPath(url),
    });

    return {
      format: "module",
      source: output.outputText,
      shortCircuit: true,
    };
  },
});

function resolveRelativeSpecifier(specifier, parentURL) {
  if (!parentURL?.startsWith("file:")) {
    return null;
  }

  const parentDirectory = dirname(fileURLToPath(parentURL));
  const candidate = resolvePath(parentDirectory, specifier);
  const extension = extname(candidate);
  const candidates = extension === ".ts" || extension === ".js" || extension === ".mjs"
    ? [candidate]
    : [candidate, `${candidate}.ts`, `${candidate}.js`, resolvePath(candidate, "index.ts"), resolvePath(candidate, "index.js")];

  const existing = candidates.find((path) => existsSync(path));
  return existing ? pathToFileURL(existing).href : null;
}
