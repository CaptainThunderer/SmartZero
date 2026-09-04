/**
 * SmartZero Teach Mode — Deterministic Command Parser
 *
 * Parses lightweight slash commands into typed Teach AST objects without LLM or eval().
 */

export type TeachCommand =
  | { type: "array"; values: number[] }
  | { type: "var"; name: string; value: string | number }
  | { type: "set"; name: string; value: string | number }
  | { type: "set_element"; arrayName: string; index: number; value: string | number }
  | { type: "push"; value: number }
  | { type: "pop" }
  | { type: "pointer"; name: string; index: number }
  | { type: "list"; values: number[] }
  | { type: "stack"; values: (number | string)[] }
  | { type: "queue"; values: (number | string)[] }
  | { type: "tree"; values: number[] }
  | { type: "bst"; values: number[] }
  | { type: "heap"; values: number[]; variant?: "min" | "max" }
  | { type: "setdata"; values: (number | string)[] }
  | { type: "map"; entries: Record<string, string | number> }
  | { type: "graph"; edges: { from: string; to: string; directed?: boolean }[]; directed?: boolean }
  | { type: "clear" }
  | { type: "reset" }
  | { type: "undo" };

export interface ParseResult {
  success: boolean;
  command?: TeachCommand;
  error?: string;
}

export const TEACH_AUTOCOMPLETE_COMMANDS = [
  { cmd: "/array", label: "/array(1,2,3,4,5)", desc: "Create an array" },
  { cmd: "/list", label: "/list(1,2,3,4,5)", desc: "Create a linked list" },
  { cmd: "/var", label: "/var(name=value)", desc: "Declare a variable" },
  { cmd: "/set", label: "/set(name=value)", desc: "Update a variable or array element (e.g. /set(arr[0]=99))" },
  { cmd: "/push", label: "/push(val)", desc: "Append an element to array" },
  { cmd: "/pop", label: "/pop", desc: "Remove last element from array" },
  { cmd: "/pointer", label: "/pointer(name,index)", desc: "Attach pointer to array index" },
  { cmd: "/stack", label: "/stack(10,20,30)", desc: "Create a stack" },
  { cmd: "/queue", label: "/queue(10,20,30)", desc: "Create a queue" },
  { cmd: "/tree", label: "/tree(50,30,70)", desc: "Create a general tree" },
  { cmd: "/bst", label: "/bst(50,30,70,20,40)", desc: "Create a Binary Search Tree" },
  { cmd: "/heap", label: "/heap(20,10,30,5,15)", desc: "Create a heap (min or max)" },
  { cmd: "/setdata", label: "/setdata(1,2,2,3,3)", desc: "Create a set of unique elements" },
  { cmd: "/map", label: '/map(name:"Alice",age:20)', desc: "Create a key/value dictionary" },
  { cmd: "/graph", label: "/graph(A-B,B-C,C-D)", desc: "Create an undirected or directed graph" },
  { cmd: "/clear", label: "/clear", desc: "Clear Teach canvas" },
  { cmd: "/reset", label: "/reset", desc: "Reset Teach canvas" },
  { cmd: "/undo", label: "/undo", desc: "Undo last Teach action" },
] as const;

/* ──── Helper: Split argument string cleanly by commas, respecting quotes ──── */
function splitArgs(argsStr: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if ((ch === '"' || ch === "'") && (i === 0 || argsStr[i - 1] !== "\\")) {
      if (inQuote === ch) {
        inQuote = null;
      } else if (!inQuote) {
        inQuote = ch;
      }
      current += ch;
    } else if (ch === "," && !inQuote) {
      tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    tokens.push(current.trim());
  }
  return tokens;
}

/* ──── Helper: Parse a list of numbers ──── */
function parseNumberList(argsStr: string): { numbers: number[]; error?: string } {
  const trimmed = argsStr.replace(/^\s*\[/, "").replace(/\]\s*$/, "").trim();
  if (!trimmed) return { numbers: [] };

  const tokens = splitArgs(trimmed);
  const numbers: number[] = [];
  for (const t of tokens) {
    const n = Number(t);
    if (isNaN(n) || t === "") {
      return { numbers: [], error: `Invalid number: "${t}"` };
    }
    numbers.push(n);
  }
  return { numbers };
}

/* ──── Main Parser Function ──── */
export function parseTeachCommand(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) {
    return {
      success: false,
      error: "Teach command must start with '/' (e.g. /array(1,2,3,4,5))",
    };
  }

  // Quick bare commands
  if (trimmed === "/clear") return { success: true, command: { type: "clear" } };
  if (trimmed === "/reset") return { success: true, command: { type: "reset" } };
  if (trimmed === "/undo") return { success: true, command: { type: "undo" } };

  // Match: /command(arguments) or /command
  const match = trimmed.match(/^\/([a-zA-Z0-9_-]+)(?:\(([\s\S]*)\))?$/);
  if (!match) {
    return {
      success: false,
      error: `Malformed command syntax: "${trimmed}". Expected /command(args).`,
    };
  }

  const name = match[1].toLowerCase();
  const rawArgs = match[2] !== undefined ? match[2].trim() : "";

  switch (name) {
    case "array": {
      if (!rawArgs) {
        return { success: false, error: "Array needs at least one value." };
      }
      const { numbers, error } = parseNumberList(rawArgs);
      if (error) return { success: false, error };
      if (numbers.length === 0) {
        return { success: false, error: "Array needs at least one value." };
      }
      return { success: true, command: { type: "array", values: numbers } };
    }

    case "var": {
      if (!rawArgs) {
        return { success: false, error: "Usage: /var(name=value)" };
      }
      const eqIdx = rawArgs.indexOf("=");
      if (eqIdx === -1) {
        return { success: false, error: "Usage: /var(name=value)" };
      }
      const varName = rawArgs.slice(0, eqIdx).trim();
      const valStr = rawArgs.slice(eqIdx + 1).trim();
      if (!varName) {
        return { success: false, error: "Variable name is required." };
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
        return { success: false, error: `Invalid variable identifier: "${varName}". Must be alphanumeric.` };
      }
      const numVal = Number(valStr);
      const value = !isNaN(numVal) && valStr !== "" ? numVal : valStr.replace(/^["']|["']$/g, "");
      return { success: true, command: { type: "var", name: varName, value } };
    }

    case "set": {
      if (!rawArgs) {
        return { success: false, error: "Usage: /set(name=value) or /set(arr[0]=99)" };
      }
      const eqIdx = rawArgs.indexOf("=");
      if (eqIdx === -1) {
        return { success: false, error: "Usage: /set(name=value) or /set(arr[0]=99)" };
      }
      const varName = rawArgs.slice(0, eqIdx).trim();
      const valStr = rawArgs.slice(eqIdx + 1).trim();
      if (!varName) {
        return { success: false, error: "Variable or array element name is required." };
      }
      const numVal = Number(valStr);
      const value = !isNaN(numVal) && valStr !== "" ? numVal : valStr.replace(/^["']|["']$/g, "");

      const arrMatch = varName.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]$/);
      if (arrMatch) {
        const arrName = arrMatch[1];
        const index = parseInt(arrMatch[2], 10);
        return { success: true, command: { type: "set_element", arrayName: arrName, index, value } };
      }

      return { success: true, command: { type: "set", name: varName, value } };
    }

    case "push": {
      if (!rawArgs) {
        return { success: false, error: "Usage: /push(number)" };
      }
      const num = Number(rawArgs.trim());
      if (isNaN(num)) {
        return { success: false, error: "Value to push must be a number." };
      }
      return { success: true, command: { type: "push", value: num } };
    }

    case "pop": {
      return { success: true, command: { type: "pop" } };
    }

    case "pointer": {
      if (!rawArgs) {
        return { success: false, error: "Usage: /pointer(name,index)" };
      }
      const tokens = splitArgs(rawArgs);
      if (tokens.length < 2) {
        return { success: false, error: "Usage: /pointer(name,index)" };
      }
      const ptrName = tokens[0].trim();
      const idxNum = parseInt(tokens[1].trim(), 10);
      if (!ptrName) {
        return { success: false, error: "Pointer name is required." };
      }
      if (isNaN(idxNum)) {
        return { success: false, error: "Pointer index must be a valid integer." };
      }
      return { success: true, command: { type: "pointer", name: ptrName, index: idxNum } };
    }

    case "list": {
      if (!rawArgs) {
        return { success: false, error: "Linked list needs at least one value." };
      }
      const { numbers, error } = parseNumberList(rawArgs);
      if (error) return { success: false, error };
      if (numbers.length === 0) {
        return { success: false, error: "Linked list needs at least one value." };
      }
      return { success: true, command: { type: "list", values: numbers } };
    }

    case "stack": {
      if (!rawArgs) {
        return { success: false, error: "Stack needs at least one value." };
      }
      const tokens = splitArgs(rawArgs);
      if (tokens.length === 0) {
        return { success: false, error: "Stack needs at least one value." };
      }
      const values = tokens.map((t) => {
        const n = Number(t);
        return !isNaN(n) && t !== "" ? n : t.replace(/^["']|["']$/g, "");
      });
      return { success: true, command: { type: "stack", values } };
    }

    case "queue": {
      if (!rawArgs) {
        return { success: false, error: "Queue needs at least one value." };
      }
      const tokens = splitArgs(rawArgs);
      if (tokens.length === 0) {
        return { success: false, error: "Queue needs at least one value." };
      }
      const values = tokens.map((t) => {
        const n = Number(t);
        return !isNaN(n) && t !== "" ? n : t.replace(/^["']|["']$/g, "");
      });
      return { success: true, command: { type: "queue", values } };
    }

    case "tree": {
      if (!rawArgs) {
        return { success: false, error: "Tree needs at least one value." };
      }
      const { numbers, error } = parseNumberList(rawArgs);
      if (error) return { success: false, error };
      if (numbers.length === 0) {
        return { success: false, error: "Tree needs at least one value." };
      }
      return { success: true, command: { type: "tree", values: numbers } };
    }

    case "bst": {
      if (!rawArgs) {
        return { success: false, error: "BST needs at least one value." };
      }
      const { numbers, error } = parseNumberList(rawArgs);
      if (error) return { success: false, error };
      if (numbers.length === 0) {
        return { success: false, error: "BST needs at least one value." };
      }
      return { success: true, command: { type: "bst", values: numbers } };
    }

    case "heap": {
      if (!rawArgs) {
        return { success: false, error: "Heap needs at least one value." };
      }
      const tokens = splitArgs(rawArgs);
      let variant: "min" | "max" | undefined = undefined;
      let startIdx = 0;
      if (tokens[0]?.toLowerCase() === "min" || tokens[0]?.toLowerCase() === "max") {
        variant = tokens[0].toLowerCase() as "min" | "max";
        startIdx = 1;
      }
      const numTokens = tokens.slice(startIdx);
      const numbers: number[] = [];
      for (const t of numTokens) {
        const n = Number(t);
        if (isNaN(n) || t === "") {
          return { success: false, error: `Invalid number for heap: "${t}"` };
        }
        numbers.push(n);
      }
      if (numbers.length === 0) {
        return { success: false, error: "Heap needs at least one value." };
      }
      return { success: true, command: { type: "heap", values: numbers, variant } };
    }

    case "setdata": {
      if (!rawArgs) {
        return { success: false, error: "Set needs at least one value." };
      }
      const tokens = splitArgs(rawArgs);
      if (tokens.length === 0) {
        return { success: false, error: "Set needs at least one value." };
      }
      const values = tokens.map((t) => {
        const n = Number(t);
        return !isNaN(n) && t !== "" ? n : t.replace(/^["']|["']$/g, "");
      });
      return { success: true, command: { type: "setdata", values } };
    }

    case "map": {
      if (!rawArgs) {
        return { success: false, error: "Map needs at least one key:value pair." };
      }
      const tokens = splitArgs(rawArgs);
      const entries: Record<string, string | number> = {};
      for (const t of tokens) {
        const colonIdx = t.indexOf(":");
        if (colonIdx === -1) {
          return { success: false, error: `Invalid map entry "${t}". Expected key:value` };
        }
        const k = t.slice(0, colonIdx).trim().replace(/^["']|["']$/g, "");
        const vRaw = t.slice(colonIdx + 1).trim();
        if (!k) {
          return { success: false, error: `Map key cannot be empty in "${t}"` };
        }
        const numV = Number(vRaw);
        const v = !isNaN(numV) && vRaw !== "" ? numV : vRaw.replace(/^["']|["']$/g, "");
        entries[k] = v;
      }
      if (Object.keys(entries).length === 0) {
        return { success: false, error: "Map needs at least one key:value pair." };
      }
      return { success: true, command: { type: "map", entries } };
    }

    case "graph": {
      if (!rawArgs) {
        return { success: false, error: "Graph needs at least one edge." };
      }
      const tokens = splitArgs(rawArgs);
      let directed = false;
      let startIdx = 0;
      if (tokens[0]?.toLowerCase() === "directed") {
        directed = true;
        startIdx = 1;
      }
      const edgeTokens = tokens.slice(startIdx);
      const edges: { from: string; to: string; directed?: boolean }[] = [];
      for (const et of edgeTokens) {
        if (et.includes("->")) {
          const parts = et.split("->");
          if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
            edges.push({ from: parts[0].trim(), to: parts[1].trim(), directed: true });
          }
        } else if (et.includes("-")) {
          const parts = et.split("-");
          if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
            edges.push({ from: parts[0].trim(), to: parts[1].trim(), directed });
          }
        } else {
          return { success: false, error: `Invalid edge format: "${et}". Use A-B or A->B.` };
        }
      }
      if (edges.length === 0) {
        return { success: false, error: "Graph needs at least one edge (e.g. A-B,B-C)." };
      }
      return { success: true, command: { type: "graph", edges, directed } };
    }

    case "clear":
      return { success: true, command: { type: "clear" } };

    case "reset":
      return { success: true, command: { type: "reset" } };

    case "undo":
      return { success: true, command: { type: "undo" } };

    default:
      return {
        success: false,
        error: `Unknown Teach command: /${name}. Supported commands: /array, /list, /var, /set, /pointer, /stack, /queue, /tree, /bst, /heap, /setdata, /map, /graph, /clear, /reset, /undo`,
      };
  }
}
