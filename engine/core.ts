import type { CanvasState, DSLAction, LessonStep } from "../types/dsa";

export const initialCanvas = (): CanvasState => ({
  array: null,
  variables: {},
  linkedList: null,
  tree: null,
  stack: null,
  queue: null,
  graph: null,
  hashTable: null,
  heap: null,
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

    case "update_array_element": {
      if (!state.array) return state;
      const nextVals = [...state.array.values];
      nextVals[action.index] = action.value;
      return {
        ...state,
        array: {
          ...state.array,
          values: nextVals,
          highlightIndices: [action.index],
        },
      };
    }

    case "swap_elements": {
      if (!state.array) return state;
      const nextVals = [...state.array.values];
      const tmp = nextVals[action.i];
      nextVals[action.i] = nextVals[action.j];
      nextVals[action.j] = tmp;
      return {
        ...state,
        array: {
          ...state.array,
          values: nextVals,
          highlightIndices: [action.i, action.j],
        },
      };
    }

    case "set_sorted_region": {
      if (!state.array) return state;
      return {
        ...state,
        array: {
          ...state.array,
          sortedRegion: { start: action.startIndex, end: action.endIndex },
        },
      };
    }

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

    case "create_stack":
      return {
        ...state,
        stack: {
          items: [...action.items],
          topIndex: action.items.length - 1,
        },
      };

    case "push_stack": {
      const currentItems = state.stack ? [...state.stack.items] : [];
      currentItems.push(action.value);
      return {
        ...state,
        stack: {
          items: currentItems,
          topIndex: currentItems.length - 1,
        },
      };
    }

    case "pop_stack": {
      if (!state.stack || state.stack.items.length === 0) return state;
      const currentItems = [...state.stack.items];
      currentItems.pop();
      return {
        ...state,
        stack: {
          items: currentItems,
          topIndex: currentItems.length - 1,
        },
      };
    }

    case "create_queue":
      return {
        ...state,
        queue: {
          items: [...action.items],
          front: 0,
          rear: Math.max(0, action.items.length - 1),
        },
      };

    case "enqueue": {
      const currentItems = state.queue ? [...state.queue.items] : [];
      currentItems.push(action.value);
      return {
        ...state,
        queue: {
          items: currentItems,
          front: 0,
          rear: currentItems.length - 1,
        },
      };
    }

    case "dequeue": {
      if (!state.queue || state.queue.items.length === 0) return state;
      const currentItems = [...state.queue.items];
      currentItems.shift();
      return {
        ...state,
        queue: {
          items: currentItems,
          front: 0,
          rear: Math.max(0, currentItems.length - 1),
        },
      };
    }

    case "create_graph":
      return {
        ...state,
        graph: {
          nodes: action.nodes.map((n) => ({ ...n })),
          edges: action.edges.map((e) => ({ ...e })),
          visited: [],
          activeId: null,
        },
      };

    case "visit_graph_node": {
      if (!state.graph) return state;
      const visited = state.graph.visited.includes(action.id)
        ? state.graph.visited
        : [...state.graph.visited, action.id];
      return {
        ...state,
        graph: {
          ...state.graph,
          visited,
          activeId: action.id,
          nodes: state.graph.nodes.map((n) =>
            n.id === action.id ? { ...n, visited: true } : n
          ),
        },
      };
    }

    case "highlight_edge": {
      if (!state.graph) return state;
      return {
        ...state,
        graph: {
          ...state.graph,
          edges: state.graph.edges.map((e) =>
            (e.from === action.from && e.to === action.to) ||
            (!e.directed && e.from === action.to && e.to === action.from)
              ? { ...e, highlighted: true }
              : e
          ),
        },
      };
    }

    case "create_hash_table":
      return {
        ...state,
        hashTable: {
          buckets: Array.from({ length: action.size }, (_, i) => ({
            index: i,
            items: [],
          })),
          highlightBucket: null,
        },
      };

    case "hash_insert": {
      if (!state.hashTable) return state;
      const buckets = state.hashTable.buckets.map((b) => {
        if (b.index === action.bucket) {
          return {
            ...b,
            items: [...b.items, { key: action.key, value: action.value }],
          };
        }
        return b;
      });
      return {
        ...state,
        hashTable: {
          buckets,
          highlightBucket: action.bucket,
        },
      };
    }

    case "highlight_bucket":
      return state.hashTable
        ? {
            ...state,
            hashTable: {
              ...state.hashTable,
              highlightBucket: action.bucket,
            },
          }
        : state;

    case "create_heap":
      return {
        ...state,
        heap: {
          values: [...action.values],
          activeIndices: null,
        },
      };

    case "swap_heap_nodes": {
      if (!state.heap) return state;
      const vals = [...state.heap.values];
      const tmp = vals[action.i];
      vals[action.i] = vals[action.j];
      vals[action.j] = tmp;
      return {
        ...state,
        heap: {
          values: vals,
          activeIndices: [action.i, action.j],
        },
      };
    }

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
