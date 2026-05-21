import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const nativeExternals = ['better-sqlite3', 'bindings', 'file-uri-to-path']

function nativeExternalsPlugin() {
  return {
    name: 'native-externals',
    enforce: 'pre',
    resolveId(source) {
      if (nativeExternals.includes(source) || nativeExternals.some(ext => source.startsWith(ext + '/'))) {
        return { id: source, external: true }
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [nativeExternalsPlugin(), externalizeDepsPlugin()],
    build: {
      commonjsOptions: {
        ignoreDynamicRequires: true
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    }
  }
})
