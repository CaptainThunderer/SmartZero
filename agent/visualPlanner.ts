import type {Lesson} from "../types/dsa";
/** Visual planning boundary: lessons already contain semantic DSL actions; renderers decide coordinates. */
export function getVisualActions(lesson:Lesson){return lesson.steps.flatMap(step=>step.actions);}
