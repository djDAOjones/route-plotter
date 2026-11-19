import { useState } from 'react';
import { Slider } from '../../../editor/kit/Slider';
import { gap } from '../../../ui/tokens';
import { evaluate } from '../model/settings';
import { Section } from './Section';
export const Panel = (): unknown => [useState, Slider, gap, evaluate, Section];
