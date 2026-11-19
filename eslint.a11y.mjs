// V31-A11Y stage 3: the ESLint fragment for the accessibility pack — eslint-plugin-jsx-a11y's strict set over JSX and
// TSX, merged into the project's own flat configuration (`...a11y` in eslint.config.mjs); it overwrites nothing.
// CREDITS names the rules the lint method credits to each of its five catalogue rows: a candidate mapping read from
// eslint-plugin-jsx-a11y 6.10.2's strict configuration, fixed into the catalogue only when Set 1 pins the plugin. The
// recorded conflict holds: ESLint 9, or no jsx-a11y.
// cspell:ignore proptypes activedescendant
import jsxA11y from 'eslint-plugin-jsx-a11y';

export const CREDITS = {
  '1.1.1': ['alt-text', 'img-redundant-alt'],
  '1.3.1': ['label-has-associated-control', 'scope', 'heading-has-content'],
  '1.3.5': ['autocomplete-valid'],
  '3.3.2': ['label-has-associated-control'],
  '4.1.2': ['aria-props', 'aria-proptypes', 'aria-role', 'aria-unsupported-elements', 'role-has-required-aria-props', 'role-supports-aria-props', 'aria-activedescendant-has-tabindex', 'anchor-has-content', 'iframe-has-title', 'interactive-supports-focus', 'no-interactive-element-to-noninteractive-role', 'no-noninteractive-element-to-interactive-role'],
};

export default [{ files: ['**/*.{jsx,tsx}'], ...jsxA11y.flatConfigs.strict }];
