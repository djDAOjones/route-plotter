class App {}
const playback = { play: (): number => 1 };
Object.assign(App.prototype, playback);
App.prototype['stop'] = (): number => 0;
export const app = new App();
