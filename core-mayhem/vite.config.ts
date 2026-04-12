import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Vite config
// - base: './' makes built asset URLs relative so the site can be hosted
//   at domain root or any subpath without additional config.
// - build.outDir: ensure outputs go to `core-mayhem/dist`.
//
// NOTE: emptyOutDir and copyPublicDir are both false here because
// public/assets/transformers/ contains git-lfs managed model directories
// with nested .git repos whose object files are read-only on Windows.
// Both Vite's rmSync (emptyOutDir) and copyFileSync (copyPublicDir) fail
// with EPERM on those files. The managePublicDir plugin below handles
// cleanup and copying while skipping .git directories entirely.

function managePublicDir(): Plugin {
  return {
    name: 'manage-public-dir',
    apply: 'build',

    buildStart() {
      // Selectively remove build artifacts from a previous run without
      // touching large static asset subdirectories (transformer models etc.).
      const distDir = join(process.cwd(), 'dist');
      const distAssetsDir = join(distDir, 'assets');

      // Remove entry HTML and other root-level build outputs
      for (const name of ['index.html', '_headers']) {
        try {
          const p = join(distDir, name);
          if (existsSync(p)) rmSync(p);
        } catch { /* ignore */ }
      }

      // Remove only flat files in dist/assets/ (hashed JS, CSS, map bundles).
      // Subdirectories (music/, sprites/, transformers/ …) are left alone so
      // we don't re-copy gigabyte model weights on every build.
      try {
        if (existsSync(distAssetsDir)) {
          for (const entry of readdirSync(distAssetsDir)) {
            const full = join(distAssetsDir, entry);
            if (statSync(full).isFile()) rmSync(full);
          }
        }
      } catch { /* ignore */ }
    },

    closeBundle() {
      // Copy public/ → dist/ while skipping any nested .git directories.
      // Vite's built-in copyPublicDir would call copyFileSync on read-only
      // git object files and fail with EPERM on Windows.
      const publicDir = join(process.cwd(), 'public');
      const outDir = join(process.cwd(), 'dist');
      if (!existsSync(publicDir)) return;
      try {
        cpSync(publicDir, outDir, {
          recursive: true,
          filter: (src: string, _dest: string) =>
            !src.split(/[/\\]/).includes('.git'),
        });
      } catch (e) {
        process.stderr.write(`[manage-public-dir] Warning during copy: ${e}\n`);
      }
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,   // handled by managePublicDir plugin (see above)
    copyPublicDir: false, // handled by managePublicDir plugin (see above)
  },
  plugins: [managePublicDir()],
});
