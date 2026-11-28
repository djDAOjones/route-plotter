import { panels } from '../features/catalogue.editor';
import { mountCanvas } from './host';
import { keep } from '../adapters/storage';
export const App = (): unknown => [panels, mountCanvas, keep];
