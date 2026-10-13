# Nuxt 4.6 + `@storybook-vue/nuxt`: all stories fail with `NUXT_E1001`

Minimal reproduction for [nuxt-modules/storybook](https://github.com/nuxt-modules/storybook).

With Nuxt 4.6.0 or later, each story fails to render. Storybook shows `NUXT_E1001` (Nuxt instance unavailable). With Nuxt 4.5.2, the same project renders correctly.

## Versions

| Package               | Version |
| --------------------- | ------- |
| `nuxt`                | 4.6.1   |
| `@storybook-vue/nuxt` | 10.0.1  |
| `storybook`           | 10.6.1  |
| `vue`                 | 3.5.43  |
| Node.js               | 24.21.0 |
| pnpm                  | 12.9.0  |

The project has one component, one story, no Nuxt modules, and no user plugins.

## Steps

```sh
pnpm install
pnpm storybook
```

Open `http://localhost:6006/?path=/story/components-helloworld--default`.

`pnpm build-storybook` gives the same result when you serve `storybook-static`.

If pnpm stops with `ERR_PNPM_IGNORED_BUILDS` for `esbuild`, the packages are installed. You can continue.

## Result

The story does not render. The error display shows:

```
NUXT_E1001: https://nuxt.com/docs/4.x/errors/e1001
    at useNuxtApp (nuxt/dist/app/nuxt.js:240:45)
    at useRuntimeConfig (nuxt/dist/app/nuxt.js:260:9)
    at setup (nuxt/dist/app/plugins/router.js:62:84)
    at nuxt/dist/app/nuxt.js:127:50
    at fn (nuxt/dist/app/nuxt.js:224:43)
    at Object.runWithContext (@vue/runtime-core/dist/runtime-core.esm-bundler.js:3825:13)
    at callWithNuxt (nuxt/dist/app/nuxt.js:229:22)
```

## Expected result

The story renders the text `Hello`.

## Control

Change `nuxt` to `4.5.2` in `package.json`, then install and start Storybook again. The story renders `Hello`.

| `nuxt` | Result              |
| ------ | ------------------- |
| 4.5.2  | Renders `Hello`     |
| 4.6.1  | `NUXT_E1001`        |

Nuxt 4.6.0 gives the same error in a larger project (57 stories, `@storybook-vue/nuxt` 10.0.0).

## Cause

Nuxt 4.6.0 does not use `unctx` in the browser ([nuxt/nuxt#36371](https://github.com/nuxt/nuxt/pull/36371)). On the client, `getNuxtAppCtx()` now reads a store in `globalThis.__nuxt_app_ctx__`:

```ts
// nuxt@4.6.0 packages/nuxt/src/app/internal/context.ts
export function getContext(key, opts) {
  if (import.meta.client) {
    return getClientContext(key); // globalThis.__nuxt_app_ctx__
  }
  return getUnctxContext(key, opts);
}
```

The Storybook preview continues to register the Nuxt instance in `unctx` ([`preview.ts`](https://github.com/nuxt-modules/storybook/blob/v10.0.0/packages/storybook-addon/src/preview.ts#L78)):

```ts
import { getContext } from "unctx";

const storyNuxtCtx = getContext(storyNuxtAppId);
// ...
storyNuxtCtx.set(nuxt, true);
getContext("nuxt-app").set(nuxt, true);
await applyPlugins(nuxt, pluginsTyped);
```

The sequence in the browser is:

1. The preview sets the instance in the `unctx` store for the keys `nuxt-app-storybook-root` and `nuxt-app`.
2. `applyPlugins()` calls `callWithNuxt()`. This sets the instance in the Nuxt store, but only for the key `nuxt._id` (`nuxt-app-storybook-root`).
3. The router plugin calls `useRuntimeConfig()`, which calls `useNuxtApp()` without an id.
4. `useNuxtApp()` reads the default key `nuxt-app` from the Nuxt store. The key is empty, and Nuxt throws `NUXT_E1001`.

Before 4.6.0, step 4 read the `unctx` store, which contained the instance from step 1.

## Possible fix

Use the Nuxt function `getNuxtAppCtx()`. It returns the store that Nuxt reads, so the two sides stay the same when Nuxt changes its implementation.

```diff
-import { getContext } from 'unctx'
+import { getNuxtAppCtx } from '#app/nuxt'

-const storyNuxtCtx = getContext(storyNuxtAppId)
+const storyNuxtCtx = getNuxtAppCtx(storyNuxtAppId)
 // ...
 storyNuxtCtx.set(nuxt, true)
-getContext('nuxt-app').set(nuxt, true)
+getNuxtAppCtx('nuxt-app').set(nuxt, true)
```

This change was applied as a `pnpm patch` to `@storybook-vue/nuxt@10.0.0` in a project with Nuxt 4.6.0. All 57 stories rendered, and the visual regression tests passed.

Not examined:

- `getNuxtAppCtx` is exported from `#app/nuxt` in Nuxt 4.5.2 and 4.6.0. Nuxt 3.x (peer range `^3.18.1`) was not examined.
- The `main` branch (`runtime/nuxt-app.ts`) also imports `getContext` from `unctx`. Its behavior with Nuxt 4.6 was not tested.
