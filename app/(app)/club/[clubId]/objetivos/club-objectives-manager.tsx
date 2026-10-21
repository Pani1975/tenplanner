"use client";

import type { ObjectiveItem } from "@/lib/objectives-taxonomy";
import { ObjectivesManager } from "@/components/objectives/objectives-manager";
import {
  createClubObjective,
  moveClubObjective,
  removeClubObjective,
  restoreClubObjective,
  updateClubObjective,
} from "./actions";

/** Catálogo de objetivos de un club concreto (desde Mi club). */
export function ClubObjectivesManager({
  clubId,
  items,
}: {
  clubId: string;
  items: ObjectiveItem[];
}) {
  return (
    <ObjectivesManager
      items={items}
      scope="club"
      actions={{
        create: (v) =>
          createClubObjective({
            clubId,
            ball: v.ball,
            aspect: v.aspect,
            block: v.block,
            title: v.title,
            criterion: v.criterion,
          }),
        update: (objectiveId, v) =>
          updateClubObjective({
            clubId,
            objectiveId,
            title: v.title,
            criterion: v.criterion,
          }),
        remove: (objectiveId) => removeClubObjective({ clubId, objectiveId }),
        restore: (objectiveId) => restoreClubObjective({ clubId, objectiveId }),
        move: (objectiveId, direction) =>
          moveClubObjective({ clubId, objectiveId, direction }),
      }}
    />
  );
}
