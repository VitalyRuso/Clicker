export type RectSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageElementSnapshot = {
  elementId: string;
  tagName: string;
  text: string;
  ariaLabel: string;
  placeholder: string;
  title: string;
  role: string;
  inputType: string;
  href: string;
  rect: RectSnapshot;
  visible: boolean;
  clickable: boolean;
};

export type PageScanResult = {
  pageTitle: string;
  pageUrl: string;
  scannedAtIso: string;
  elements: PageElementSnapshot[];
};

export type PlannedAction = {
  actionId: string;
  kind: "click";
  elementId: string;
  confidence: number;
  risk: "low" | "blocked";
  reason: string;
  matchedText: string;
  instruction: string;
};

export type PlannerResult =
  | {
      ok: true;
      plan: PlannedAction;
    }
  | {
      ok: false;
      reason: string;
      blocked: boolean;
      candidates?: PageElementSnapshot[];
    };

export type ExecuteActionRequest = {
  action: PlannedAction;
};

export type ExecuteActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export type RuntimeRequest =
  | { type: "SCAN_PAGE" }
  | { type: "EXECUTE_ACTION"; payload: ExecuteActionRequest };

export type RuntimeResponse =
  | { ok: true; type: "SCAN_PAGE_RESULT"; payload: PageScanResult }
  | { ok: true; type: "EXECUTE_ACTION_RESULT"; payload: ExecuteActionResult }
  | { ok: false; error: string };
