/** Root chart dispatch; focused profiles share the same renderer-independent scenes. */
import { buildStandardScene } from './profile-standard.mjs';
import { buildProjectScene, projectTypes } from './project.mjs';

export function buildScene(spec) {
  return projectTypes.includes(spec.type) ? buildProjectScene(spec) : buildStandardScene(spec);
}
