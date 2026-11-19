import { compose } from '../player/compose';
import { boot } from './boot';
export const play = (): number => compose(boot);
