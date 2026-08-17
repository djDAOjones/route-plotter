# Automatic Version Display + Local Webserver Configuration

This document explains the full system for **automatic version
display**, including how the **local development webserver** was
configured so the version string is always correct in both local and
production builds.

------------------------------------------------------------------------

# 1. Overview

The final design required:

1.  The UI must always show the correct version.
2.  The value must update automatically on each build.
3.  Local development (`npm run dev`) must also display an accurate
    version.
4.  The local dev server must inject a version even when no "build" step
    runs.
5.  CI builds must be able to override the version.

This led to a combined **build-time + dev-time injection system**.

------------------------------------------------------------------------

# 2. Version Sources

### Primary Sources

-   Git tag/commit (`git describe --tags --always --dirty`)
-   Semantic version from `package.json`

### Fallback Sources

-   CI environment variables (e.g., `BUILD_VERSION`)
-   `"unknown"` if no Git metadata available

------------------------------------------------------------------------

# 3. Build-Time Injection (Production)

During a `vite build`, the Vite config runs:

``` ts
define: {
  __APP_VERSION__: JSON.stringify(getBuildVersion())
}
```

Where:

``` ts
import { execSync } from "child_process";

export function getBuildVersion() {
  try {
    return execSync("git describe --tags --always --dirty").toString().trim();
  } catch {
    return "unknown";
  }
}
```

This makes `__APP_VERSION__` a **static constant** baked into the
production bundle.

Resulting UI output:

    1.4.2 (3f29bd1)

------------------------------------------------------------------------

# 4. Local Development: The Added Challenge

When running:

    npm run dev

Vite does **not** run the same "build hooks" as production.\
If we only injected the version at build time, the dev server would
show:

    Version: undefined

or the previous build's version, which is wrong.

### Requirements for dev mode:

-   Pull fresh Git version on every dev server start.
-   Must NOT break hot-module replacement (HMR).
-   Cannot require a production build to see a version.

------------------------------------------------------------------------

# 5. Dev Webserver Implementation

To fix this, the Vite configuration uses the **config hook** to inject
the version during dev server initialisation.

### In `vite.config.ts`:

``` ts
import { defineConfig } from "vite";
import { getBuildVersion } from "./version.build";

export default defineConfig(() => {
  const version = getBuildVersion();

  return {
    define: {
      __APP_VERSION__: JSON.stringify(version)
    }
  };
});
```

### Why this works

-   When the dev server starts, Vite evaluates the config and assigns
    `__APP_VERSION__`.
-   The value is available instantly to all modules.
-   Edits do not require restart unless version changes (expected).
-   Git operations (commits, tags) trigger the updated version on the
    next restart.

### Example Dev Output

    1.4.2-dev (3f29bd1+ local changes)

------------------------------------------------------------------------

# 6. Preventing Dev Server Crashes

Git metadata is not always available (e.g., downloaded ZIP copies,
shallow CI clones).\
To avoid dev server crashes:

``` ts
try {
  return execSync("git describe --tags --always --dirty")
} catch {
  return "unknown-dev";
}
```

This ensures: - Local dev server always boots. - UI always displays
*something*, even if Git is missing.

------------------------------------------------------------------------

# 7. CI Override Logic

CI may override the version:

``` ts
if (process.env.BUILD_VERSION) {
  return process.env.BUILD_VERSION;
}
```

The dev server respects this override if the CI environment is used to
host ephemeral review apps.

------------------------------------------------------------------------

# 8. Runtime Usage in the App

All runtime code imports the version via a typed wrapper:

``` ts
export const appVersion = __APP_VERSION__;
```

Example UI:

``` tsx
<div className="app-version">
  Version {appVersion}
</div>
```

------------------------------------------------------------------------

# 9. Why This Arrangement Works

  -----------------------------------------------------------------------
  Requirement                      Solved?                  How
  -------------------------------- ------------------------ -------------
  Automatic version update         ✔                        Git describe
                                                            at build +
                                                            dev server
                                                            init

  Works in dev                     ✔                        Vite config
                                                            executes
                                                            version
                                                            script

  Works in production              ✔                        Build injects
                                                            constant

  Works in CI                      ✔                        Env variable
                                                            override

  No manual updates                ✔                        Fully
                                                            automated

  Never crashes if Git missing     ✔                        Safe fallback
                                                            to
                                                            `"unknown"`
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 10. Example End-to-End Version Behaviour

### Local dev:

    1.4.2-dev (3f29bd1+ local changes)

### Production build:

    1.4.2 (3f29bd1)

### CI build:

    1.4.2 (CI-abc123)

------------------------------------------------------------------------

# 11. File Summary

  File                 Purpose
  -------------------- ---------------------------------------------------
  `version.build.ts`   Retrieves version from Git or environment
  `vite.config.ts`     Injects version for **both dev server and build**
  `appVersion.ts`      Safe export of the injected constant
  UI components        Display version

------------------------------------------------------------------------

# 12. Final Outcome

-   Development server shows the correct version.
-   Production builds show the correct version.
-   CI can override.
-   No human intervention required.
-   Clean, deterministic versioning for debugging and user support.
