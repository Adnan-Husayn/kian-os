/** Standard result shape for mutating server actions. */
export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ActionResultWithId extends ActionResult {
  id?: string;
}
