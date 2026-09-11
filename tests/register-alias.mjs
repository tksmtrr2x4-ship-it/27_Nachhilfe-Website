// Löst den Next.js-Import-Alias "@/…" (= Projektwurzel) auch unter reinem
// Node auf, damit die Unit-Tests (node --test) dieselben Module laden können
// wie die App – ohne Bundler und ohne die Alias-Konvention im Code zu brechen.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      const root = ${JSON.stringify(pathToFileURL(process.cwd() + "/").href)};
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith("@/")) {
          let target = root + specifier.slice(2);
          if (!/\\.[a-z]+$/i.test(target)) target += ".js";
          return next(target, context);
        }
        return next(specifier, context);
      }
    `),
  import.meta.url
);
