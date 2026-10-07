import { lessons, routeSkill as sharedRouteSkill } from "../public/tutor-skills.js";

export { lessons };
export type LessonId = keyof typeof lessons;
export type TutorMode = "auto" | "quantity" | "spatial" | "review" | "verbal" | "logic" | "data" | "knowledge" | "shenlun";

export function routeSkill(mode: TutorMode, question: string, lesson?: string, hasImage = false): {
  routedMode: Exclude<TutorMode, "auto">;
  system: string;
} {
  return sharedRouteSkill(mode, question, lesson, hasImage) as {
    routedMode: Exclude<TutorMode, "auto">;
    system: string;
  };
}
