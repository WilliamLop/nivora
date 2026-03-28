import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveExistingPath(candidatePath) {
  const extensions = ["", ".ts", ".tsx", ".js", ".mjs", ".cjs"];

  for (const extension of extensions) {
    const resolvedPath = `${candidatePath}${extension}`;
    if (existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  for (const extension of extensions.slice(1)) {
    const indexPath = path.join(candidatePath, `index${extension}`);
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }

  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  let candidatePath = null;

  if (specifier.startsWith("@/")) {
    candidatePath = path.join(process.cwd(), specifier.slice(2));
  }

  if (!candidatePath && (specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    candidatePath = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (candidatePath) {
    const resolvedPath = resolveExistingPath(candidatePath);
    if (resolvedPath) {
      return defaultResolve(pathToFileURL(resolvedPath).href, context, defaultResolve);
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
