import { frame } from '../../../core/model';
import { paint } from '../../../adapters/render';
import { evaluate } from '../model/settings';
import { stroke } from './stroke';
export const draw = (time: number): number => paint(frame(evaluate(time))) + stroke;
