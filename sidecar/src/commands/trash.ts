import { readFile } from "node:fs/promises";

import type { TrashRequest, TrashResult } from "../../../shared/protocol";
import {
  moveSelectedFilesToTrash,
  type TrashServiceDependencies
} from "../services/trashService";

export async function runTrashCommand(
  requestPath: string,
  dependencies: TrashServiceDependencies = {}
): Promise<TrashResult> {
  const request = JSON.parse(await readFile(requestPath, "utf8")) as TrashRequest;

  return moveSelectedFilesToTrash(request, dependencies);
}
