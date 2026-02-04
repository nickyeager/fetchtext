/**
 * TipTap Extensions Index
 *
 * Central export point for all custom TipTap extensions
 * used in the template builder system.
 */

export { VariableBadge, type VariableBadgeOptions } from './extensions/VariableBadge';
export {
  VariableAutocomplete,
  type VariableAutocompleteOptions,
} from './extensions/VariableAutocomplete';
export {
  createSuggestionRenderer,
  getVariableSuggestionOptions,
} from './suggestion-renderer';
