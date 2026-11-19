import { frame } from '../core/model';
import { paint } from '../adapters/render';
import { catalogue } from '../features/catalogue';
import { tick } from './clock';
export const compose = (time: number): number => paint(frame(time)) + catalogue.length + tick;
