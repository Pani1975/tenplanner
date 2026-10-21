"use client";

import type { ObjectiveItem } from "@/lib/objectives-taxonomy";
import {
  ObjectivesManager,
  type ManagerScope,
} from "@/components/objectives/objectives-manager";
import {
  createWorkspaceObjective,
  duplicateWorkspaceObjective,
  moveWorkspaceObjective,
  placeWorkspaceObjective,
  removeWorkspaceObjective,
  restoreWorkspaceObjective,
  updateWorkspaceObjective,
} from "./actions";

/** Catálogo de objetivos del modo de trabajo actual (menú "Objetivos"). */
export function WorkspaceObjectivesManager({
  items,
  scope,
}: {
  items: ObjectiveItem[];
  scope: ManagerScope;
}) {
  return (
    <ObjectivesManager
      items={items}
      scope={scope}
      actions={{
        create: (v) =>
          createWorkspaceObjective({
            ball: v.ball,
            aspect: v.aspect,
            block: v.block,
            title: v.title,
            criterion: v.criterion,
          }),
        update: (objectiveId, v) =>
          updateWorkspaceObjective({
            objectiveId,
            title: v.title,
            criterion: v.criterion,
          }),
        remove: (objectiveId) => removeWorkspaceObjective({ objectiveId }),
        restore: (objectiveId) => restoreWorkspaceObjective({ objectiveId }),
        move: (objectiveId, direction) =>
          moveWorkspaceObjective({ objectiveId, direction }),
        place: (objectiveId, target, beforeId) =>
          placeWorkspaceObjective({ objectiveId, target, beforeId }),
        duplicate: (objectiveId) =>
          duplicateWorkspaceObjective({ objectiveId }),
      }}
    />
  );
}
