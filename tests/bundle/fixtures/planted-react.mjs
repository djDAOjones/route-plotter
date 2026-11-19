// A planted fault for tests/bundle/player.test.mjs: a player entry that imports React, which the player's build refuses.
import { createElement } from 'react';

export const planted = createElement('p');
