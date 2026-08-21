import assert from 'node:assert/strict';
import { computeRenderGeometry, pixelSamplesLookBlank } from '../assets/pdf-render-recovery.mjs';

const normal = computeRenderGeometry({ viewportWidth: 800, viewportHeight: 1200, devicePixelRatio: 2 });
assert.equal(normal.pixelWidth, 1600);
assert.equal(normal.pixelHeight, 2400);
assert.equal(normal.outputScale, 2);

const huge = computeRenderGeometry({ viewportWidth: 4000, viewportHeight: 5000, devicePixelRatio: 3 });
assert.ok(huge.pixelWidth * huge.pixelHeight <= 16_100_000, 'canvas pixel budget must be capped');
assert.ok(huge.outputScale > 0 && huge.outputScale < 1, 'huge pages may render below DPR 1 to respect memory budget');

const white = Array.from({ length: 49 }, () => [255, 255, 255, 255]).flat();
assert.equal(pixelSamplesLookBlank(white), true);
const ink = white.slice();
ink[0] = 20;
assert.equal(pixelSamplesLookBlank(ink), false);

console.log('qa-render-geometry: PASS');
