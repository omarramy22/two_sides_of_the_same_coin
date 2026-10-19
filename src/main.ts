import { Application } from 'pixi.js';

const app = new Application();
app.init({ resizeTo: window, background: '#1C2046', antialias: true })
  .then(() => document.body.appendChild(app.canvas));
