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

export function buildDijkstraGraphLesson(): Lesson {
  const nodes: GraphNode[] = [
    { id: "A", label: "A (0)", x: 150, y: 140 },
    { id: "B", label: "B (∞)", x: 270, y: 60 },
    { id: "C", label: "C (∞)", x: 270, y: 220 },
    { id: "D", label: "D (∞)", x: 420, y: 60 },
    { id: "E", label: "E (∞)", x: 420, y: 220 },
  ];

  const edges: GraphEdge[] = [
    { from: "A", to: "B", weight: 4, directed: true },
    { from: "A", to: "C", weight: 2, directed: true },
    { from: "C", to: "B", weight: 1, directed: true },
    { from: "B", to: "D", weight: 5, directed: true },
    { from: "C", to: "E", weight: 4, directed: true },
    { from: "D", to: "E", weight: 1, directed: true },
  ];

  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        {
          action: "set_board_header",
          title: "Dijkstra's Shortest Path",
          subtitle: "Greedy Edge Relaxation • Min-Priority Queue",
          badge: "O((V + E) log V)",
        },
        { action: "create_graph", nodes, edges },
        { action: "create_variable", name: "dist_A", value: 0 },
        { action: "create_variable", name: "dist_B", value: "∞" },
        { action: "create_variable", name: "dist_C", value: "∞" },
        { action: "create_variable", name: "dist_D", value: "∞" },
        { action: "create_variable", name: "dist_E", value: "∞" },
        {
          action: "compare",
          text: "Start at source A with dist = 0. All other vertices initialize with dist = ∞.\nMin-heap has (0, A).",
        },
      ],
      codeLine: "init",
      explanation: "Dijkstra's algorithm finds the shortest path from a source vertex to all other vertices in a weighted graph with non-negative edge weights.",
      narrative: {
        currentStep: "Initialize Distances",
        why: "Tentative distance to source is 0; unknown vertices start at infinity.",
        whatChanged: "dist[A] = 0; dist[B..E] = ∞. Min-priority queue initialized with (0, A).",
        whatToNotice: "All edge weights are non-negative, which is required for the greedy choice property.",
        keyInsight: "Always extract the unvisited vertex with the minimum tentative distance.",
        nextStep: "Extract vertex A and relax its outgoing edges.",
      },
    },
    {
      actions: [
        { action: "visit_graph_node", id: "A" },
        { action: "highlight_edge", from: "A", to: "C" },
        { action: "highlight_edge", from: "A", to: "B" },
        { action: "update_variable", name: "dist_C", value: 2 },
        { action: "update_variable", name: "dist_B", value: 4 },
        {
          action: "compare",
          text: "Extract A (min dist 0). Relax outgoing edges:\n• Edge A → C (weight 2): 0 + 2 = 2 < ∞ → dist[C] = 2\n• Edge A → B (weight 4): 0 + 4 = 4 < ∞ → dist[B] = 4",
        },
      ],
      codeLine: "relax",
      explanation: "Extract min-distance vertex A. Relax edge A->C (dist 2) and A->B (dist 4).",
      narrative: {
        currentStep: "Relax Outgoing Edges from A",
        why: "Paths A→C and A→B improve upon the initial infinity values.",
        whatChanged: "dist[C] updated to 2; dist[B] updated to 4.",
        whatToNotice: "C has tentative distance 2, which is smaller than B's distance 4.",
        keyInsight: "Vertex with the smallest tentative distance is guaranteed optimal and never needs revisiting.",
        nextStep: "Extract vertex C next (distance 2 < distance 4).",
      },
    },
    {
      actions: [],
      codeLine: "relax",
      pause: true,
      explanation: "Which vertex will the min-priority queue extract next?",
      question: {
        prompt: "Tentative distances: dist[C] = 2, dist[B] = 4. Which vertex does Dijkstra extract next?",
        choices: [
          { id: "c", text: "Vertex C (minimum tentative distance = 2)" },
          { id: "b", text: "Vertex B (tentative distance = 4)" },
          { id: "d", text: "Vertex D (tentative distance = ∞)" },
        ],
        correctId: "c",
        hints: [
          "Dijkstra greedily chooses the unvisited vertex with the smallest tentative distance.",
          "Compare dist[C] = 2 and dist[B] = 4.",
        ],
        misconceptions: {
          b: { code: "GREEDY_CHOICE_VIOLATION", feedback: "dist[C] is 2, which is strictly smaller than dist[B] = 4. Dijkstra always picks the minimum." },
        },
      },
      narrative: {
        currentStep: "Interactive Check: Min-Queue Extraction",
        why: "Confirms the learner understands the greedy choice property.",
        whatChanged: "Paused for decision.",
        whatToNotice: "Min-heap returns node with smallest tentative distance.",
        keyInsight: "The greedy choice ensures optimal substructure holds.",
        nextStep: "Extract C and relax its neighbors.",
      },
    },
    {
      actions: [
        { action: "visit_graph_node", id: "C" },
        { action: "highlight_edge", from: "C", to: "B" },
        { action: "highlight_edge", from: "C", to: "E" },
        { action: "update_variable", name: "dist_B", value: 3 },
        { action: "update_variable", name: "dist_E", value: 6 },
        {
          action: "compare",
          text: "Extract C (min dist 2). Relax outgoing edges:\n• Edge C → B (weight 1): dist[C] + 1 = 2 + 1 = 3 < dist[B] (4) → SHORTER PATH TO B FOUND! dist[B] = 3\n• Edge C → E (weight 4): dist[C] + 4 = 2 + 4 = 6 < ∞ → dist[E] = 6",
        },
      ],
      codeLine: "relax",
      explanation: "From C, edge C->B has weight 1. Since 2 + 1 = 3 < 4, we find a shorter path to B via C! Update dist[B] = 3.",
      narrative: {
        currentStep: "Shorter Path Discovered via C",
        why: "Path A → C → B has length 3, which is shorter than direct edge A → B of length 4.",
        whatChanged: "dist[B] reduced from 4 to 3! dist[E] set to 6.",
        whatToNotice: "Edge relaxation successfully improves an existing tentative distance.",
        keyInsight: "Dijkstra dynamically updates distances whenever a superior path through an intermediate node is found.",
        nextStep: "Next minimum in priority queue is B (distance 3).",
      },
    },
    {
      actions: [
        { action: "visit_graph_node", id: "B" },
        { action: "highlight_edge", from: "B", to: "D" },
        { action: "update_variable", name: "dist_D", value: 8 },
        {
          action: "compare",
          text: "Extract B (min dist 3). Relax outgoing edge:\n• Edge B → D (weight 5): dist[B] + 5 = 3 + 5 = 8 < ∞ → dist[D] = 8",
        },
      ],
      codeLine: "relax",
      explanation: "Extract B (distance 3). Relax edge B->D: 3 + 5 = 8. Update dist[D] = 8.",
      narrative: {
        currentStep: "Relax from Vertex B",
        why: "Path A → C → B → D gives tentative distance 8 to D.",
        whatChanged: "dist[D] updated to 8.",
        whatToNotice: "Queue now has E (6) and D (8).",
        keyInsight: "Vertex B is now finalized; its distance 3 can never be improved.",
        nextStep: "Extract E (distance 6 < 8).",
      },
    },
    {
      actions: [
        { action: "visit_graph_node", id: "E" },
        {
          action: "compare",
          text: "Extract E (min dist 6). All reachable neighbors already relaxed or finalized.",
        },
      ],
      codeLine: "relax",
      explanation: "Extract E (distance 6). No unvisited outgoing edges to relax.",
      narrative: {
        currentStep: "Finalize Vertex E",
        why: "E is the next minimum. Distance 6 is optimal.",
        whatChanged: "E marked as visited.",
        whatToNotice: "Only vertex D remains in the queue.",
        keyInsight: "Vertices are finalized in non-decreasing order of their shortest path distances.",
        nextStep: "Extract remaining vertex D.",
      },
    },
    {
      actions: [
        { action: "visit_graph_node", id: "D" },
        {
          action: "show_insight_card",
          title: "Shortest Paths from Source A",
          text: "Final shortest distances from A:\n• A: 0\n• B: 3 (via A → C → B)\n• C: 2 (via A → C)\n• E: 6 (via A → C → E)\n• D: 8 (via A → C → B → D)",
        },
        {
          action: "compare",
          text: "ALL VERTICES FINALIZED! Shortest paths: A=0, C=2, B=3, E=6, D=8",
        },
        { action: "show_complexity", time: "O((V + E) log V)", space: "O(V)" },
      ],
      codeLine: "done",
      explanation: "Dijkstra's algorithm complete! Found shortest path from source A to all vertices.",
      narrative: {
        currentStep: "Algorithm Complete",
        why: "All reachable vertices visited and finalized with their guaranteed shortest paths.",
        whatChanged: "All vertices marked finalized; result card rendered.",
        whatToNotice: "Notice how B's final path went through C rather than directly from A.",
        keyInsight: "Greedy choice + edge relaxation guarantees optimal shortest paths in non-negative weighted graphs.",
        nextStep: "Review implementation in JS, C++, and Python.",
      },
    },
  ];

  return {
    id: "dijkstra",
    title: "Dijkstra's Shortest Path",
    dataStructure: "Graph",
    pattern: "Greedy Choice & Edge Relaxation",
    objective: "Find the shortest path from a source vertex to all other vertices in a weighted graph",
    difficulty: "Advanced",
    steps,
    code: {
      javascript: [
        "function dijkstra(graph, start) {",
        "  const dist = { [start]: 0 };",
        "  const pq = new MinPriorityQueue();",
        "  pq.enqueue(start, 0);",
        "  while (!pq.isEmpty()) {",
        "    const { element: u, priority: d } = pq.dequeue();",
        "    if (d > (dist[u] ?? Infinity)) continue;",
        "    for (const [v, weight] of graph[u]) {",
        "      if (d + weight < (dist[v] ?? Infinity)) {",
        "        dist[v] = d + weight;",
        "        pq.enqueue(v, dist[v]);",
        "      }",
        "    }",
        "  }",
        "  return dist;",
        "}",
      ],
      cpp: [
        "vector<int> dijkstra(int n, vector<vector<pair<int,int>>>& adj, int src) {",
        "    vector<int> dist(n, 1e9);",
        "    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<>> pq;",
        "    dist[src] = 0;",
        "    pq.push({0, src});",
        "    while (!pq.empty()) {",
        "        auto [d, u] = pq.top(); pq.pop();",
        "        if (d > dist[u]) continue;",
        "        for (auto& [v, w] : adj[u]) {",
        "            if (d + w < dist[v]) {",
        "                dist[v] = d + w;",
        "                pq.push({dist[v], v});",
        "            }",
        "        }",
        "    }",
        "    return dist;",
        "}",
      ],
      python: [
        "import heapq",
        "",
        "def dijkstra(graph, start):",
        "    dist = {start: 0}",
        "    pq = [(0, start)]",
        "    while pq:",
        "        d, u = heapq.heappop(pq)",
        "        if d > dist.get(u, float('inf')):",
        "            continue",
        "        for v, weight in graph.get(u, []):",
        "            if d + weight < dist.get(v, float('inf')):",
        "                dist[v] = d + weight",
        "                heapq.heappush(pq, (dist[v], v))",
        "    return dist",
      ],
    },
    lineMap: {
      javascript: { init: 2, relax: 10, done: 15 },
      cpp: { init: 4, relax: 11, done: 17 },
      python: { init: 4, relax: 11, done: 14 },
    },
  };
}

