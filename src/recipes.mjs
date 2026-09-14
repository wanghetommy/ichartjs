import { copyJSON, validateDataSchema } from './schema.mjs';
import { validateCommand } from './command.mjs';

export function validateRecipe(recipe, capabilities) {
  const errors = [];
  try { recipe = copyJSON(recipe); } catch (error) { return { valid: false, errors: [{ code: 'INVALID_RECIPE', path: 'recipe', message: error.message }] }; }
  if (!recipe || typeof recipe !== 'object') errors.push({ code: 'INVALID_RECIPE', path: 'recipe', message: 'Recipe must be an object.' });
  if (recipe?.spec) {
    if (!capabilities?.chartTypes?.includes(recipe.spec.type) && !capabilities?.projectManagement?.includes(recipe.spec.type) && !capabilities?.diagrams?.includes(recipe.spec.type)) errors.push({ code: 'RECIPE_TYPE', path: 'recipe.spec.type', message: `Recipe type is not declared in capabilities: ${recipe.spec.type}.` });
  }
  if (recipe?.schema) errors.push(...validateDataSchema(recipe.schema).errors);
  if (recipe?.command) errors.push(...validateCommand(recipe.command).errors);
  return { valid: errors.length === 0, errors, recipe };
}
