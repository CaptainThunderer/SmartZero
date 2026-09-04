import type { CanvasState, DSLAction, LessonStep } from "../types/dsa";

export const initialCanvas = (): CanvasState => ({
  array: null,
  variables: {},
  linkedList: null,
  tree: null,
  bounds: null,
  compareText: null,
  message: null,
});

export function applyAction(
  state: CanvasState,
  action: DSLAction
): CanvasState {
  switch (action.action) {
    case "reset_scene":
      return initialCanvas();

    case "create_array":
      return {
        ...state,
        array: {
          id: action.id,
          values: [...action.values],
          highlightIndices: [],
          dimIndices: [],
          pointers: {},
        },
      };

    case "create_variable":
    case "update_variable":
      return {
        ...state,
        variables: { ...state.variables, [action.name]: action.value },
      };

    case "create_pointer":
    case "move_pointer":
      return state.array
        ? {
            ...state,
            array: {
              ...state.array,
              pointers: {
                ...state.array.pointers,
                [action.pointer]: action.targetIndex,
              },
            },
          }
        : state;

    case "highlight_element":
      return state.array
        ? {
            ...state,
            array: { ...state.array, highlightIndices: [...action.indices] },
          }
        : state;

    case "dim_elements":
      return state.array
        ? {
            ...state,
            array: { ...state.array, dimIndices: [...action.indices] },
          }
        : state;

    case "compare":
      return { ...state, compareText: action.text };

    case "set_bounds":
      return {
        ...state,
        bounds: { low: action.low, mid: action.mid, high: action.high },
      };

    case "create_linked_list":
      return {
        ...state,
        linkedList: {
          nodes: action.values.map((value, i) => ({
            id: `n${i}`,
            value,
          })),
          pointers: {},
        },
      };

    case "move_ll_pointer":
      return state.linkedList
        ? {
            ...state,
            linkedList: {
              ...state.linkedList,
              pointers: {
                ...state.linkedList.pointers,
                [action.pointer]: action.targetId,
              },
            },
          }
        : state;

    case "relink":
      return state.linkedList
        ? {
            ...state,
            linkedList: {
              ...state.linkedList,
              order: [...action.order],
              reversedUpTo: action.reversedUpTo,
            },
          }
        : state;

    case "create_tree":
      return {
        ...state,
        tree: {
          nodes: action.nodes.map((n) => ({ ...n })),
          edges: [...action.edges],
          highlightId: null,
        },
      };

    case "reveal_tree_node":
      return state.tree
        ? {
            ...state,
            tree: {
              ...state.tree,
              nodes: state.tree.nodes.map((n) =>
                n.id === action.id ? { ...n, visible: true } : n
              ),
              edges: action.edge
                ? [...state.tree.edges, action.edge]
                : state.tree.edges,
            },
          }
        : state;

    case "highlight_tree_node":
      return state.tree
        ? { ...state, tree: { ...state.tree, highlightId: action.id } }
        : state;

    case "show_message":
      return { ...state, message: action.text };

    case "show_complexity":
      return {
        ...state,
        complexity: { time: action.time, space: action.space },
      };
  }
}

export function replay(steps: LessonStep[], upto: number): CanvasState {
  let s = initialCanvas();
  for (let i = 0; i <= upto && i < steps.length; i++) {
    for (const a of steps[i].actions) {
      s = applyAction(s, a);
    }
  }
  return s;
}
