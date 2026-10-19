import { Application } from 'pixi.js';
import { startGreybox } from './render/greybox';

const app = new Application();
app.init({ resizeTo: window, background: '#1C2046', antialias: true }).then(() => {
  document.body.appendChild(app.canvas);
  startGreybox(app);
});
