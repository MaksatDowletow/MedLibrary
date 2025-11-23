import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'styles.css', dest: '' },
        { src: 'pwa.js', dest: '' },
        { src: 'scripts.js', dest: '' },
        { src: 'config.js', dest: '' },
        { src: 'manifest.webmanifest', dest: '' },
        { src: 'service-worker.js', dest: '' },
        { src: 'data', dest: 'data' },
        { src: 'icons', dest: 'icons' },
        { src: 'BookCategory.html', dest: '' },
        { src: 'book.html', dest: '' },
        { src: 'Book.xlsx', dest: '' },
        { src: 'Book.xls', dest: '' },
        { src: 'Book.mht', dest: '' },
        { src: 'public/hero-preview.svg', dest: '' },
        { src: 'public/gallery', dest: 'gallery' }
      ]
    })
  ]
});
