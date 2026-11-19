import { panels } from '../features/catalogue.editor';
import { compose } from '../player/compose';
import { keep } from '../adapters/storage';
export const App = (): unknown => [panels, compose, keep];
