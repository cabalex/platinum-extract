import esbuild from 'esbuild';
import { execSync } from 'child_process'
import path from 'path';
import fs from 'fs';
import {wasmLoader} from 'esbuild-plugin-wasm';

let wasmPlugin = {
    name: 'wasm',
    setup(build) {
  
      // Resolve ".wasm" files to a path with a namespace
      build.onResolve({ filter: /\.wasm$/ }, args => {
        if (args.resolveDir === '') {
          return // Ignore unresolvable paths
        }
        return {
          path: path.isAbsolute(args.path) ? args.path : path.join(args.resolveDir, args.path),
            namespace: 'wasm-binary',
        }
      })
  
      // Virtual modules in the "wasm-binary" namespace contain the
      // actual bytes of the WebAssembly file. This uses esbuild's
      // built-in "binary" loader instead of manually embedding the
      // binary data inside JavaScript code ourselves.
      build.onLoad({ filter: /.*/, namespace: 'wasm-binary' }, async (args) => ({
        contents: await fs.promises.readFile(args.path),
        loader: 'binary',
      }))
    },
  }
  

esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    plugins: [
      wasmLoader({mode: 'embedded'}),
      {
        name: 'TypeScriptDeclarationsPlugin',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length > 0) return
            execSync('tsc --emitDeclarationOnly --declaration --outFile dist/index.d.ts')
          })
        }
      }
  ],
    minify: false, // Debugging
    sourcemap: true,
    target: 'esnext',
    format: 'esm',
    watch: {
        onRebuild(error, result) {
            if (error) console.error('watch build failed.', error)
            else console.log('watch build succeeded.', ...result.errors, ...result.warnings)
        }
    }
}).catch(() => process.exit(1));
  

// --bundle --minify --sourcemap --format=esm --target=chrome58,firefox57,safari11,edge18 --outfile=dist/platinum-extract.min.js --watch