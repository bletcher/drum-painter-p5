import js from '@eslint/js';
import globals from 'globals';

// p5.js runs in "global mode": its functions and constants are window globals.
// Only the ones this project uses are listed, so typos still get caught.
const p5Globals = Object.fromEntries([
  'p5', 'createCanvas', 'resizeCanvas', 'createGraphics', 'pixelDensity', 'displayDensity',
  'windowWidth', 'windowHeight', 'width', 'height', 'frameCount', 'drawingContext',
  'background', 'clear', 'fill', 'noFill', 'stroke', 'noStroke', 'strokeWeight', 'tint', 'noTint',
  'push', 'pop', 'translate', 'rotate', 'scale', 'blendMode', 'erase', 'noErase', 'cursor',
  'circle', 'ellipse', 'rect', 'square', 'line', 'point', 'triangle', 'quad', 'arc',
  'beginShape', 'endShape', 'vertex', 'curveVertex', 'bezierVertex', 'image', 'imageMode', 'rectMode',
  'text', 'textSize', 'textAlign', 'textStyle', 'textFont',
  'color', 'red', 'green', 'blue', 'alpha', 'hue', 'saturation', 'brightness', 'colorMode', 'lerpColor',
  'random', 'randomGaussian', 'randomSeed', 'noise', 'noiseSeed', 'noiseDetail',
  'map', 'constrain', 'lerp', 'dist', 'floor', 'ceil', 'round', 'abs', 'min', 'max', 'pow', 'sqrt', 'exp',
  'sin', 'cos', 'tan', 'atan2', 'radians', 'degrees', 'createVector',
  'mouseX', 'mouseY', 'pmouseX', 'pmouseY', 'mouseIsPressed', 'key', 'keyCode', 'fullscreen',
  'loadPixels', 'updatePixels', 'pixels', 'millis',
  'BLEND', 'MULTIPLY', 'SCREEN', 'OVERLAY', 'DODGE', 'BURN', 'ADD', 'DIFFERENCE', 'REPLACE',
  'CENTER', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'CORNER', 'CLOSE', 'BOLD', 'NORMAL', 'ITALIC',
  'HSB', 'RGB', 'PI', 'TWO_PI', 'HALF_PI', 'QUARTER_PI', 'ARROW', 'MOVE', 'HAND',
  'LEFT_ARROW', 'RIGHT_ARROW', 'UP_ARROW', 'DOWN_ARROW', 'BACKSPACE', 'DELETE', 'ESCAPE', 'ENTER'
].map(name => [name, 'readonly']));

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'old-version/**', '**/*.backup']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...p5Globals,
        __APP_VERSION__: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-case-declarations': 'off'
    }
  },
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  }
];
