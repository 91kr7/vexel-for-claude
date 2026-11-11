# Dependency licenses

Production npm dependencies of Vexel for Claude (direct and transitive), with the license each one declares in its `package.json`. Development-only tools (TypeScript, Vite, Vitest, Playwright, and so on) are not included, because they are not part of what the app runs or ships.

Generated from the installed dependency tree (`npm ls --omit=dev --all`). Regenerate it when dependencies change and before every release.

## Summary

| License | Packages |
|---------|----------|
| MIT | 99 |
| ISC | 8 |
| BlueOak-1.0.0 | 6 |
| BSD-3-Clause | 4 |
| Apache-2.0 | 1 |

Total: 118 packages. All licenses are permissive: no copyleft (GPL, LGPL, AGPL) license is declared.

## Packages

| Package | License |
|---------|---------|
| @electron-internal/extract-zip@1.0.8 | MIT |
| @electron/get@5.1.0 | MIT |
| @esbuild/linux-x64@0.28.2 | MIT |
| @fastify/accept-negotiator@2.1.2 | MIT |
| @fastify/ajv-compiler@4.0.7 | MIT |
| @fastify/deepmerge@3.2.4 | MIT |
| @fastify/error@4.2.1 | MIT |
| @fastify/fast-json-stringify-compiler@5.1.1 | MIT |
| @fastify/forwarded@3.1.2 | MIT |
| @fastify/merge-json-schemas@0.2.2 | MIT |
| @fastify/proxy-addr@5.1.2 | MIT |
| @fastify/send@4.2.1 | MIT |
| @fastify/static@10.1.10 | MIT |
| @fastify/websocket@11.3.7 | MIT |
| @isaacs/nonrecursive-glob-match@1.0.3 | BlueOak-1.0.0 |
| @jellybrick/dbus-next@0.11.4 | MIT |
| @lukeed/ms@2.0.2 | MIT |
| @nodable/entities@3.1.0 | MIT |
| @pinojs/redact@0.4.0 | MIT |
| @types/node@24.19.2 | MIT |
| @xterm/addon-fit@0.11.0 | MIT |
| @xterm/addon-search@0.16.0 | MIT |
| @xterm/addon-serialize@0.14.0 | MIT |
| @xterm/addon-web-links@0.12.0 | MIT |
| @xterm/headless@6.0.0 | MIT |
| @xterm/xterm@6.0.0 | MIT |
| abstract-logging@2.0.1 | MIT |
| ajv-formats@3.0.1 | MIT |
| ajv@8.20.0 | MIT |
| anynum@1.0.1 | MIT |
| atomic-sleep@1.0.0 | MIT |
| avvio@9.3.1 | MIT |
| balanced-match@4.0.4 | MIT |
| brace-expansion@5.0.12 | MIT |
| content-disposition@3.0.0 | MIT |
| cookie@2.0.1 | MIT |
| debug@4.4.3 | MIT |
| depd@2.0.0 | MIT |
| dequal@2.0.3 | MIT |
| duplexify@4.1.3 | MIT |
| electron@45.2.3 | MIT |
| end-of-stream@1.4.5 | MIT |
| env-paths@3.0.0 | MIT |
| esbuild@0.28.2 | MIT |
| escape-html@1.0.3 | MIT |
| fast-decode-uri-component@1.0.1 | MIT |
| fast-deep-equal@3.1.3 | MIT |
| fast-json-stringify@7.3.0 | MIT |
| fast-querystring@1.1.2 | MIT |
| fast-uri@3.1.9 | BSD-3-Clause |
| fast-uri@4.2.3 | BSD-3-Clause |
| fast-xml-builder@1.3.1 | MIT |
| fast-xml-parser@5.12.0 | MIT |
| fastify-plugin@6.0.1 | MIT |
| fastify@5.12.8 | MIT |
| fastq@1.20.3 | ISC |
| find-my-way@9.10.0 | MIT |
| glob@14.0.3 | BlueOak-1.0.0 |
| graceful-fs@4.2.11 | ISC |
| http-errors@2.0.1 | MIT |
| inherits@2.0.4 | ISC |
| ipaddr.js@2.5.0 | MIT |
| is-unsafe@2.0.3 | MIT |
| js-tokens@4.0.0 | MIT |
| json-schema-ref-resolver@3.0.1 | MIT |
| json-schema-traverse@1.0.0 | MIT |
| light-my-request@6.8.0 | BSD-3-Clause |
| loose-envify@1.4.0 | MIT |
| lru-cache@11.5.3 | BlueOak-1.0.0 |
| mime@3.0.0 | MIT |
| minimatch@11.0.4 | BlueOak-1.0.0 |
| minipass@7.1.3 | BlueOak-1.0.0 |
| ms@2.1.3 | MIT |
| node-addon-api@7.1.1 | MIT |
| node-pty@1.1.0 | MIT |
| on-exit-leak-free@2.1.2 | MIT |
| once@1.4.0 | ISC |
| path-expression-matcher@1.6.2 | MIT |
| path-scurry@3.0.0 | BlueOak-1.0.0 |
| pino-abstract-transport@3.0.0 | MIT |
| pino-std-serializers@7.1.0 | MIT |
| pino@10.4.0 | MIT |
| process-warning@5.1.1 | MIT |
| progress@2.0.3 | MIT |
| quick-format-unescaped@4.0.4 | MIT |
| react-dom@18.3.1 | MIT |
| react@18.3.1 | MIT |
| readable-stream@3.6.2 | MIT |
| real-require@1.0.0 | MIT |
| require-from-string@2.0.2 | MIT |
| ret@0.5.1 | MIT |
| reusify@1.1.0 | MIT |
| rfdc@1.4.1 | MIT |
| safe-buffer@5.2.1 | MIT |
| safe-regex2@5.1.2 | MIT |
| safe-stable-stringify@2.5.0 | MIT |
| scheduler@0.23.2 | MIT |
| secure-json-parse@4.1.1 | BSD-3-Clause |
| semver@7.8.6 | ISC |
| set-cookie-parser@3.2.2 | MIT |
| setprototypeof@1.2.0 | ISC |
| sonic-boom@4.2.1 | MIT |
| split2@4.2.0 | ISC |
| statuses@2.0.2 | MIT |
| stream-shift@1.0.3 | MIT |
| string_decoder@1.3.0 | MIT |
| strnum@2.5.1 | MIT |
| sumchecker@3.0.1 | Apache-2.0 |
| thread-stream@4.2.1 | MIT |
| toad-cache@3.7.4 | MIT |
| toidentifier@1.0.1 | MIT |
| tsx@4.23.15 | MIT |
| undici-types@7.24.6 | MIT |
| undici@7.30.2 | MIT |
| util-deprecate@1.0.2 | MIT |
| wrappy@1.0.2 | ISC |
| ws@8.22.1 | MIT |
| xml-naming@0.3.0 | MIT |
