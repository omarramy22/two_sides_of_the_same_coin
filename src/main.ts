import { Application } from 'pixi.js';
import { startDemo } from './render/demo';
import { startGreybox } from './render/greybox';

const app = new Application();
app.init({ resizeTo: window, background: '#1C2046', antialias: true }).then(() => {
  document.body.appendChild(app.canvas);
  if (new URLSearchParams(location.search).has('demo')) startDemo(app);
  else startGreybox(app);
});
