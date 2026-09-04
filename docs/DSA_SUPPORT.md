# SmartZero — Comprehensive DSA Support & Capability Catalog

> An authoritative reference of all 22 Data Structure & Algorithm categories, 37 canonical registered topics, 29 canonical lessons, and 42 dynamic natural-language problem solvers supported in SmartZero.

---

## 1. Summary of Algorithmic Capabilities

SmartZero's coverage spans the entire breadth of undergraduate computer science and competitive programming curricula:

- **Total Registered Canonical Topics**: 37 topics across 22 categories (`engine/registry.ts`).
- **Deterministic Step-by-Step Execution Engines**: 18 canonical algorithms with mathematical state transitions.
- **Canonical Interactive Lessons**: 29 guided lessons (`engine/lessons.ts`).
- **Specialized Natural-Language Problem Solvers**: 42 problem types with story normalization (`agent/problemSolver.ts`).
- **Multi-Language Code Synchronization**: Full line-mapped implementations in **JavaScript**, **Python**, and **C++**.

---

## 2. Canonical Topic Registry (37 Topics)

The following table documents the exact capabilities of all 37 canonical topics defined in `engine/registry.ts`:

| Category | Topic Name (`id`) | Deterministic Engine | Visualizer Layout | Multi-Language Code | Average Time | Space Complexity | Status |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Sorting** | Bubble Sort (`bubble-sort`) | **Yes** | Array Cells | JS, Python, C++ | $O(n^2)$ | $O(1)$ | Fully Verified |
| **Sorting** | Selection Sort (`selection-sort`) | **Yes** | Array Cells | JS, Python, C++ | $O(n^2)$ | $O(1)$ | Fully Verified |
| **Sorting** | Insertion Sort (`insertion-sort`) | **Yes** | Array Cells | JS, Python, C++ | $O(n^2)$ | $O(1)$ | Fully Verified |
| **Sorting** | Merge Sort (`merge-sort`) | **Yes** | Array Cells / Split | JS, Python, C++ | $O(n \log n)$ | $O(n)$ | Fully Verified |
| **Sorting** | Quick Sort (`quick-sort`) | **Yes** | Array Cells / Pivot | JS, Python, C++ | $O(n \log n)$ | $O(\log n)$ | Fully Verified |
| **Sorting** | Heap Sort (`heap-sort`) | **Yes** | Array Cells | JS, Python, C++ | $O(n \log n)$ | $O(1)$ | Fully Verified |
| **Sorting** | Counting Sort (`counting-sort`) | **Yes** | Array Cells / Freq | JS, Python, C++ | $O(n + k)$ | $O(k)$ | Fully Verified |
| **Sorting** | Radix Sort (`radix-sort`) | **Yes** | Array Cells / Digit | JS, Python, C++ | $O(d \cdot (n + k))$ | $O(n + k)$ | Fully Verified |
| **Sorting** | Bucket Sort (`bucket-sort`) | **Yes** | Array Cells / Bins | JS, Python, C++ | $O(n)$ | $O(n)$ | Fully Verified |
| **Searching** | Binary Search (`binary-search`) | **Yes** | Array Cells / low,mid,high | JS, Python, C++ | $O(\log n)$ | $O(1)$ | Fully Verified |
| **Searching** | Linear Search (`linear-search`) | No | Conceptual | JS, Python, C++ | $O(n)$ | $O(1)$ | Pedagogical |
| **Arrays** | Second Maximum (`second-max`) | **Yes** | Array Cells / Pointers | JS, Python, C++ | $O(n)$ | $O(1)$ | Fully Verified |
| **Arrays** | Array Traversal (`array-traversal`) | No | Conceptual | JS, Python, C++ | $O(n)$ | $O(1)$ | Pedagogical |
| **Arrays** | Two Pointers (`two-pointers`) | No | Conceptual | JS, Python, C++ | $O(n)$ | $O(1)$ | Pedagogical |
| **Arrays** | Sliding Window (`sliding-window`) | No | Conceptual | JS, Python, C++ | $O(n)$ | $O(1)$ | Pedagogical |
| **Linked Lists**| Reversal (`linked-list-reverse`) | **Yes** | Node-Pointer Chain | JS, Python, C++ | $O(n)$ | $O(1)$ | Fully Verified |
| **Stacks** | Stack Operations (`stack-ops`) | **Yes** | Vertical LIFO Buffer | JS, Python, C++ | $O(1)$ | $O(n)$ | Fully Verified |
| **Stacks** | Monotonic Stack (`monotonic-stack`) | No | Stack Buffer | JS, Python, C++ | $O(n)$ | $O(n)$ | Pedagogical |
| **Queues** | Queue Operations (`queue-ops`) | **Yes** | Horizontal FIFO Buffer | JS, Python, C++ | $O(1)$ | $O(n)$ | Fully Verified |
| **Hashing** | Hash Table & Collisions (`hash-table-ops`) | **Yes** | Key-Value Slots | JS, Python, C++ | $O(1)$ | $O(n)$ | Fully Verified |
| **Trees** | BST Insertion (`bst-insert`) | **Yes** | Hierarchical Tree | JS, Python, C++ | $O(\log n)$ | $O(h)$ | Fully Verified |
| **Balanced Trees**| AVL Tree (`avl-tree`) | No | Conceptual | JS, Python, C++ | $O(\log n)$ | $O(n)$ | Pedagogical |
| **Heaps** | Heaps & Priority Queues (`heap-ops`) | No | Conceptual | JS, Python, C++ | $O(\log n)$ | $O(n)$ | Pedagogical |
| **Graphs** | Breadth-First Search (`graph-bfs`) | **Yes** | Planar Network + Queue | JS, Python, C++ | $O(V + E)$ | $O(V)$ | Fully Verified |
| **Graphs** | Depth-First Search (`graph-dfs`) | **Yes** | Planar Network + Stack | JS, Python, C++ | $O(V + E)$ | $O(V)$ | Fully Verified |
| **Graphs** | Dijkstra's Shortest Path (`dijkstra`) | **Yes** | Weighted Graph + Table | JS, Python, C++ | $O((V + E)\log V)$ | $O(V)$ | Fully Verified |
| **DP** | Dynamic Programming (`dynamic-programming`) | No | Conceptual | JS, Python, C++ | $O(n \cdot W)$ | $O(n)$ | Pedagogical |
| **Sets** | Set Operations (`set-ops`) | No | Conceptual | JS, Python, C++ | $O(1)$ | $O(n)$ | Pedagogical |
| **Strings** | String Manipulation (`strings`) | No | Conceptual | JS, Python, C++ | $O(n)$ | $O(n)$ | Pedagogical |
| **Strings** | Palindrome Check (`palindrome`) | No | Conceptual | JS, Python, C++ | $O(n)$ | $O(1)$ | Pedagogical |
| **Tries** | Prefix Trees (`trie-prefix-tree`) | No | Tree Structure | JS, Python, C++ | $O(k)$ | $O(\Sigma \cdot k \cdot N)$ | Pedagogical |
| **DSU** | Disjoint Set Union (`disjoint-set-union`) | No | Conceptual | JS, Python, C++ | $O(\alpha(n))$ | $O(n)$ | Pedagogical |
| **Recursion** | Recursion & Call Stack (`recursion-basics`)| No | Conceptual | JS, Python, C++ | $O(n)$ | $O(n)$ | Pedagogical |
| **Backtracking**| Decision Trees (`backtracking`) | No | Conceptual | JS, Python, C++ | $O(k^n)$ | $O(n)$ | Pedagogical |
| **Greedy** | Greedy Intervals (`greedy-algorithms`) | No | Conceptual | JS, Python, C++ | $O(n \log n)$ | $O(1)$ | Pedagogical |
| **Bitwise** | Bit Manipulation (`bit-manipulation`) | No | Conceptual | JS, Python, C++ | $O(1)$ | $O(1)$ | Pedagogical |
| **Complexity** | Big-O Analysis (`complexity-analysis`) | No | Conceptual | JS, Python, C++ | $O(1)$ | $O(1)$ | Pedagogical |

---

## 3. Canonical Interactive Lessons (29 Lessons)

SmartZero defines 29 pre-built interactive lessons in `engine/lessons.ts` accessible directly via the Teach Mode palette:

1. `second-max`: Second Maximum Element Traversal
2. `binary-search`: Binary Search on Sorted Array
3. `bst-insert`: Binary Search Tree Insertion
4. `linked-list-reverse`: Singly Linked List In-Place Reversal
5. `bubble-sort`: Bubble Sort Adjacent Swapping
6. `selection-sort`: Selection Sort Scan & Prefix Placement
7. `insertion-sort`: Insertion Sort Key Shifts
8. `merge-sort`: Merge Sort Divide-and-Conquer
9. `quick-sort`: Quick Sort Lomuto/Hoare Partitioning
10. `heap-sort`: Max-Heapify and Sift-Down
11. `counting-sort`: Frequency Array and Prefix Accumulation
12. `radix-sort`: Least-Significant-Digit Distribution
13. `bucket-sort`: Scatter-and-Gather Distribution
14. `graph-bfs`: Breadth-First Search on a 6-Vertex Graph
15. `graph-dfs`: Depth-First Search on a 6-Vertex Graph
16. `dijkstra`: Dijkstra's Shortest Path on a Weighted Graph
17. `stack-ops`: LIFO Stack Push and Pop Mechanics
18. `queue-ops`: FIFO Queue Enqueue and Dequeue
19. `hash-table-ops`: Direct Chaining Collision Handling
20. `explain-arrays`: Memory Layout & Contiguous Addressing
21. `explain-two-pointers`: Oppositely Directed Pointers
22. `explain-sliding-window`: Dynamic Window Resizing
23. `explain-set`: Unique Elements & Hash Set Mechanics
24. `explain-dp`: Overlapping Subproblems & Memoization
25. `explain-recursion`: Recursive Call Stack Frames
26. `explain-backtracking`: State-Space Tree Exploration & Pruning
27. `compare-array-vs-linked-list`: Array vs Linked List Complexity
28. `compare-bfs-vs-dfs`: Queue vs Call Stack Graph Search
29. `explain-complexity`: Asymptotic Big-O Growth Curves

---

## 4. Specialized Problem Solvers (42 Solvers)

For natural language questions, contest problems, or story-based prompts, SmartZero employs 42 specialized solvers in `agent/problemSolver.ts`. Each solver extracts parameters and generates a dynamic lesson with multi-language code and step-by-step whiteboard execution:

| Solver ID | Problem Class | Parameter Extraction | Optimal Approach | Time / Space |
|:---|:---|:---|:---|:---|
| `two-sum` | Target Pair Search | Numbers array, target | One-Pass Hash Map | $O(n)$ / $O(n)$ |
| `max-subarray` | Maximum Subarray Sum | Numbers array | Kadane's Algorithm | $O(n)$ / $O(1)$ |
| `missing-number`| Missing Number in Range | Numbers array, range | Sum Formula / XOR | $O(n)$ / $O(1)$ |
| `stock-buy-sell`| Single Transaction Profit | Price array | Minimum Tracking | $O(n)$ / $O(1)$ |
| `move-zeroes` | In-Place Partitioning | Numbers array | Two-Pointer Write Head | $O(n)$ / $O(1)$ |
| `remove-duplicates`| In-Place Deduplication | Sorted array | Two-Pointer Unique Write | $O(n)$ / $O(1)$ |
| `longest-substring-no-repeat`| Substring Search | Character string | Sliding Window + Set | $O(n)$ / $O(\min(n, \Sigma))$ |
| `max-subarray-k`| Fixed Window Maximum | Array, window size $k$ | Sliding Window Accumulator | $O(n)$ / $O(1)$ |
| `binary-search` | Logarithmic Search | Array, target | Low/Mid/High Pointers | $O(\log n)$ / $O(1)$ |
| `search-rotated-array`| Modified Binary Search | Rotated array, target | Sorted-Half Detection | $O(\log n)$ / $O(1)$ |
| `reverse-linked-list`| Pointer Reversal | List nodes | 3-Pointer Iteration | $O(n)$ / $O(1)$ |
| `detect-linked-list-cycle`| Cycle Detection | List nodes | Floyd's Tortoise & Hare | $O(n)$ / $O(1)$ |
| `valid-parentheses`| Bracket Matching | String of braces | Stack Validation | $O(n)$ / $O(n)$ |
| `queue-using-stacks`| Amortized Operations | Operation stream | Dual Stack Amortization | $O(1)$ am. / $O(n)$ |
| `first-repeating-element`| Duplication Search | Numbers array | Frequency Hash Set | $O(n)$ / $O(n)$ |
| `top-k-frequent`| Frequency Ranking | Array, $k$ | Min-Heap / Bucket Sort | $O(n \log k)$ / $O(n)$ |
| `tree-traversal`| Tree Exploration | Tree root | Inorder / Preorder DFS | $O(n)$ / $O(h)$ |
| `bst-search` | BST Target Lookup | BST root, key | Logarithmic Search | $O(\log n)$ / $O(h)$ |
| `number-of-islands`| Grid Traversal | 2D Binary Matrix | Flood-Fill BFS/DFS | $O(M \cdot N)$ / $O(M \cdot N)$ |
| `bfs-shortest-path`| Unweighted Shortest Path | Graph, start, target | Level-Order BFS | $O(V + E)$ / $O(V)$ |
| `dfs-connected-components`| Component Count | Graph adjacency | Depth Exploration | $O(V + E)$ / $O(V)$ |
| `dijkstra` | Non-Negative Shortest Path | Weighted graph, source | Priority Queue Dijkstra | $O((V+E)\log V)$ / $O(V)$ |
| `climbing-stairs`| Fibonacci DP | Number of steps $N$ | Tabulation / Variables | $O(N)$ / $O(1)$ |
| `coin-change` | Min Coins for Amount | Coins array, amount | 1D Dynamic Programming | $O(N \cdot A)$ / $O(A)$ |
| `lcs` | Subsequence Matching | Two strings | 2D Dynamic Programming | $O(M \cdot N)$ / $O(M \cdot N)$ |
| `generate-subsets`| Power Set Generation | Element array | Choose-Explore-Unchoose | $O(2^N)$ / $O(N)$ |
| `n-queens` | Constraint Satisfaction | Board size $N$ | Column/Diagonal Pruning | $O(N!)$ / $O(N)$ |
| `next-greater-element`| Suffix Comparison | Numbers array | Monotonic Stack | $O(n)$ / $O(n)$ |
| `prefix-sum` | Range Query Optimization| Numbers array | Cumulative Sum Array | $O(n)$ build, $O(1)$ query |
| `union-find` | Disjoint Connectivity | Vertices & unions | Path Compression + Rank | $O(\alpha(N))$ / $O(N)$ |
| `prime-number` | Primality Verification | Integer $N$ | $6k \pm 1$ Trial Division | $O(\sqrt{N})$ / $O(1)$ |
| `palindrome-check`| String Reversal Equivalence| String | Dual-Pointer Inward Scan | $O(N)$ / $O(1)$ |
| `factorial` | Product Accumulation | Integer $N$ | Iterative Multiplication | $O(N)$ / $O(1)$ |
| `fibonacci` | Sequence Generation | Integer $N$ | Dynamic Programming | $O(N)$ / $O(1)$ |
| `gcd-lcm` | Euclidean Algorithm | Integers $A, B$ | Modulo Division | $O(\log(\min(A, B)))$ / $O(1)$ |
| `armstrong-number`| Digit Power Sum | Integer $N$ | Modulo Digit Extraction | $O(D)$ / $O(1)$ |
| `decrement-or-increment`| Conditional Arithmetic | Integer $N$ | Modulo Branching | $O(1)$ / $O(1)$ |
| `greater-average`| Comparison Condition | Integers $A, B, C$ | Cross-Multiplication | $O(1)$ / $O(1)$ |
| `percentage-change`| Ratio Calculation | Initial, Final | Difference Ratio | $O(1)$ / $O(1)$ |
| `shop-bill` | Cost Evaluation | Items & discounts | Aggregation | $O(N)$ / $O(1)$ |
| `generic-arithmetic-comparison`| Numerical Comparison | Arbitrary arithmetic | Direct Evaluation | $O(1)$ / $O(1)$ |
| `generic-programming-problem`| Custom Interview Question| Unstructured question | Semantic Visual Plan | Context-dependent |

---

*For API documentation and route payload schemas, proceed to [API.md](API.md).*
