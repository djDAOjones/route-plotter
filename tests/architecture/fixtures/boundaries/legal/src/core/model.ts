import { MAX } from './config/limits';
export const frame = (time: number): number => Math.min(MAX, time * 2);
