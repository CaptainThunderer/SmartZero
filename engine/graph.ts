import type { Lesson, LessonStep, GraphNode, GraphEdge } from "../types/dsa";

export function buildBFSGraphLesson(): Lesson {
  const nodes: GraphNode[] = [
    { id: "A", label: "A", x: 200, y: 50 },
    { id: "B", label: "B", x: 100, y: 140 },
    { id: "C", label: "C", x: 300, y: 140 },
    { id: "D", label: "D", x: 60, y: 230 },
    { id: "E", label: "E", x: 160, y: 230 },
    { id: "F", label: "F", x: 300, y: 230 },
  ];

  const edges: GraphEdge[] = [
    { from: "A", to: "B" },
    { from: "A", to: "C" },
    { from: "B", to: "D" },
    { from: "B", to: "E" },
    { from: "C", to: "F" },
  ];

  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "create_graph", nodes, edges },
        { action: "create_queue", items: ["A"] },
        { action: "show_message", text: "BFS: Enqueue root node A and mark it as visited." },
      ],
      codeLine: "init",
      explanation: "Breadth-First Search uses a FIFO queue. We start at vertex A, enqueue it, and explore level by level.",
    },
    {
      actions: [
        { action: "visit_graph_node", id: "A" },
        { action: "dequeue" },
        { action: "show_message", text: "Dequeue A. Inspect its adjacent neighbors: B and C." },
      ],
      codeLine: "dequeue",
      explanation: "Dequeue vertex A. Its unvisited neighbors are B and C.",
    },
    {
      actions: [
        { action: "highlight_edge", from: "A", to: "B" },
        { action: "enqueue", value: "B" },
        { action: "show_message", text: "Enqueue neighbor B into the queue." },
      ],
      codeLine: "enqueue",
      explanation: "Discovered neighbor B. Add B to the queue.",
    },
    {
      actions: [
        { action: "highlight_edge", from: "A", to: "C" },
        { action: "enqueue", value: "C" },
        { action: "show_message", text: "Enqueue neighbor C into the queue." },
      ],
      codeLine: "enqueue",
      explanation: "Discovered neighbor C. Queue now contains [B, C]. Level 1 discovery complete.",
    },
    // Decision Point:
    {
      actions: [],
      codeLine: "dequeue",
      pause: true,
      explanation: "Decision point: Queue has [B, C]. Which vertex must BFS process next?",
      question: {
        prompt: "The queue contains [B, C]. Which vertex will be dequeued next in FIFO order?",
        choices: [
          { id: "a", text: "Vertex B (front of the queue)" },
          { id: "b", text: "Vertex C (rear of the queue)" },
          { id: "c", text: "Vertex D (not yet in queue)" },
        ],
        correctId: "a",
        hints: [
          "BFS relies on a FIFO (First-In, First-Out) queue.",
          "The first item inserted into the queue is the first item removed.",
          "B was enqueued before C.",
        ],
        misconceptions: {
          b: {
            code: "QUEUE_FIFO_MISCONCEPTION",
            feedback: "C was added after B. A queue removes elements from the front, so B is next.",
          },
        },
      },
    },
    {
      actions: [
        { action: "visit_graph_node", id: "B" },
        { action: "dequeue" },
        { action: "show_message", text: "Dequeue B. Neighbors of B are D and E." },
      ],
      codeLine: "dequeue",
      explanation: "Dequeue vertex B. Explore its unvisited neighbors D and E.",
    },
    {
      actions: [
        { action: "highlight_edge", from: "B", to: "D" },
        { action: "enqueue", value: "D" },
        { action: "highlight_edge", from: "B", to: "E" },
        { action: "enqueue", value: "E" },
        { action: "show_message", text: "Enqueue D and E. Queue: [C, D, E]." },
      ],
      codeLine: "enqueue",
      explanation: "Neighbors D and E added to queue.",
    },
    {
      actions: [
        { action: "visit_graph_node", id: "C" },
        { action: "dequeue" },
        { action: "highlight_edge", from: "C", to: "F" },
        { action: "enqueue", value: "F" },
        { action: "show_message", text: "Dequeue C, enqueue its neighbor F. Queue: [D, E, F]." },
      ],
      codeLine: "dequeue",
      explanation: "Dequeue C and discover neighbor F.",
    },
    {
      actions: [
        { action: "visit_graph_node", id: "D" },
        { action: "dequeue" },
        { action: "visit_graph_node", id: "E" },
        { action: "dequeue" },
        { action: "visit_graph_node", id: "F" },
        { action: "dequeue" },
        { action: "show_message", text: "All vertices visited: A → B → C → D → E → F." },
        { action: "show_complexity", time: "O(V + E)", space: "O(V)" },
      ],
      codeLine: "done",
      explanation: "Queue is empty. BFS complete! Every node was discovered in shortest-hop order.",
    },
  ];

  return {
    id: "graph-bfs",
    title: "Graph BFS (Breadth-First Search)",
    dataStructure: "Graph",
    pattern: "Level-Order Queue Traversal",
    objective: "Traverse a graph level-by-level using a FIFO queue to guarantee shortest path",
    difficulty: "Medium",
    steps,
    code: {
      javascript: [
        "function bfs(graph, start) {",
        "  const visited = new Set([start]);",
        "  const queue = [start];",
        "  while (queue.length > 0) {",
        "    const node = queue.shift();",
        "    for (const neighbor of graph[node]) {",
        "      if (!visited.has(neighbor)) {",
        "        visited.add(neighbor);",
        "        queue.push(neighbor);",
        "      }",
        "    }",
        "  }",
        "}",
      ],
      cpp: [
        "void bfs(vector<vector<int>>& graph, int start) {",
        "  vector<bool> visited(graph.size(), false);",
        "  queue<int> q;",
        "  visited[start] = true; q.push(start);",
        "  while (!q.empty()) {",
        "    int node = q.front(); q.pop();",
        "    for (int next : graph[node]) {",
        "      if (!visited[next]) {",
        "        visited[next] = true; q.push(next);",
        "      }",
        "    }",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 2, dequeue: 5, enqueue: 9, done: 12 },
      cpp: { init: 3, dequeue: 6, enqueue: 9, done: 12 },
    },
  };
}

export function buildDFSGraphLesson(): Lesson {
  const nodes: GraphNode[] = [
    { id: "A", label: "A", x: 200, y: 50 },
    { id: "B", label: "B", x: 100, y: 140 },
    { id: "C", label: "C", x: 300, y: 140 },
    { id: "D", label: "D", x: 60, y: 230 },
    { id: "E", label: "E", x: 160, y: 230 },
    { id: "F", label: "F", x: 300, y: 230 },
  ];

  const edges: GraphEdge[] = [
    { from: "A", to: "B" },
    { from: "A", to: "C" },
    { from: "B", to: "D" },
    { from: "B", to: "E" },
    { from: "C", to: "F" },
  ];

  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "create_graph", nodes, edges },
        { action: "create_stack", items: ["A"] },
        { action: "show_message", text: "DFS: Start at node A. Dive as deep as possible along each branch." },
      ],
      codeLine: "init",
      explanation: "Depth-First Search explores deeply down each subtree before backtracking, using an implicit call stack or explicit stack.",
    },
    {
      actions: [
        { action: "visit_graph_node", id: "A" },
        { action: "highlight_edge", from: "A", to: "B" },
        { action: "push_stack", value: "B" },
        { action: "visit_graph_node", id: "B" },
        { action: "show_message", text: "Visit A → B. Push B to call stack." },
      ],
      codeLine: "recurse",
      explanation: "From A, branch to neighbor B. Call stack: [A, B].",
    },
    {
      actions: [
        { action: "highlight_edge", from: "B", to: "D" },
        { action: "push_stack", value: "D" },
        { action: "visit_graph_node", id: "D" },
        { action: "show_message", text: "Visit B → D. D has no unvisited neighbors (leaf)." },
      ],
      codeLine: "recurse",
      explanation: "From B, continue down to D. Call stack: [A, B, D].",
    },
    {
      actions: [
        { action: "pop_stack" },
        { action: "show_message", text: "Backtrack from D to B. Next unvisited neighbor of B is E." },
      ],
      codeLine: "backtrack",
      explanation: "Backtrack to B and explore remaining neighbor E.",
    },
    {
      actions: [
        { action: "highlight_edge", from: "B", to: "E" },
        { action: "push_stack", value: "E" },
        { action: "visit_graph_node", id: "E" },
        { action: "show_message", text: "Visit E. B's branch fully explored." },
      ],
      codeLine: "recurse",
      explanation: "Visit E. Call stack: [A, B, E].",
    },
    {
      actions: [
        { action: "pop_stack" },
        { action: "pop_stack" },
        { action: "show_message", text: "Backtrack E → B → A. Explore A's second neighbor: C." },
      ],
      codeLine: "backtrack",
      explanation: "Backtrack all the way back to root A to explore vertex C.",
    },
    {
      actions: [
        { action: "highlight_edge", from: "A", to: "C" },
        { action: "push_stack", value: "C" },
        { action: "visit_graph_node", id: "C" },
        { action: "highlight_edge", from: "C", to: "F" },
        { action: "push_stack", value: "F" },
        { action: "visit_graph_node", id: "F" },
        { action: "show_message", text: "Visit C → F. All reachable vertices visited!" },
        { action: "show_complexity", time: "O(V + E)", space: "O(V)" },
      ],
      codeLine: "done",
      explanation: "DFS traversal complete! Traversal order: A → B → D → E → C → F.",
    },
  ];

  return {
    id: "graph-dfs",
    title: "Graph DFS (Depth-First Search)",
    dataStructure: "Graph",
    pattern: "Recursive Deep Branching & Backtracking",
    objective: "Traverse a graph by searching deeply along each path before backtracking",
    difficulty: "Medium",
    steps,
    code: {
      javascript: [
        "function dfs(graph, node, visited = new Set()) {",
        "  visited.add(node);",
        "  for (const neighbor of graph[node]) {",
        "    if (!visited.has(neighbor)) {",
        "      dfs(graph, neighbor, visited);",
        "    }",
        "  }",
        "}",
      ],
      cpp: [
        "void dfs(vector<vector<int>>& graph, int node, vector<bool>& visited) {",
        "  visited[node] = true;",
        "  for (int next : graph[node]) {",
        "    if (!visited[next]) dfs(graph, next, visited);",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, recurse: 5, backtrack: 6, done: 7 },
      cpp: { init: 1, recurse: 4, backtrack: 4, done: 5 },
    },
  };
}
