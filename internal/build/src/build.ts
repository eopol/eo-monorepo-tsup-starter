import path from 'path'
import { rm } from 'fs/promises'
import { build as tsup } from 'tsup'
import Vue from 'unplugin-vue/esbuild'
import { resolveModule } from 'local-pkg'
import { PKG_PREFIX, targetNode, targetWeb } from './constants'
import { getPackage } from './workspace'
import { importConfig } from './utils'
import type { BuildOptions } from './config'
import type { Plugin } from 'esbuild'
import type { Options } from 'tsup'

export async function build(packageName?: string, userConfig?: BuildOptions) {
  const pkg = await getPackage(packageName)
  if (!pkg) throw new Error("pkg doesn't exist!")

  const config = await importConfig(pkg, userConfig)
  const outDir = path.resolve(pkg.dir, 'dist')

  const plugins: Plugin[] = [Vue()]
  const options: Options = {
    outDir,
    target: config.platform === 'web' ? targetWeb : targetNode,
    format: config.format,
    splitting: false,
    platform: config.platform === 'web' ? 'browser' : 'node',
    esbuildPlugins: plugins,
    ...config.tsup,
  }

  if (config.dts) {
    options.dts = {
      compilerOptions: {
        paths: {},
      },
    }
    options.tsconfig = resolveModule(
      `${PKG_PREFIX}/ts-config/${config.platform}.json`
    )
  }

  await rm(outDir, { recursive: true, force: true })

  process.chdir(pkg.dir)
  const tasks: Array<Promise<void>> = []
  if (config.minify === false || config.minify === 'both') {
    tasks.push(
      tsup({
        ...options,
        name: 'eo-monorepon-tsup-starter',
        esbuildOptions(options) {
          options.entryNames = `[dir]/[name]`
        },
      })
    )
  }
  if (config.minify === true || config.minify === 'both') {
    tasks.push(
      tsup({
        ...options,
        name: 'eo-monorepon-tsup-starter minify',
        minify: true,
        esbuildOptions(options) {
          options.entryNames = `[dir]/[name].min`
        },
      })
    )
  }

  await Promise.all(tasks)
}
