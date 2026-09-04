export interface DSATopicDefinition {
  id: string;
  name: string;
  category:
    | "arrays"
    | "strings"
    | "linked-lists"
    | "stacks"
    | "queues"
    | "hashing"
    | "sets"
    | "trees"
    | "balanced-trees"
    | "heaps"
    | "tries"
    | "dsu"
    | "graphs"
    | "shortest-paths"
    | "sorting"
    | "searching"
    | "recursion"
    | "backtracking"
    | "dp"
    | "greedy"
    | "bit-manipulation"
    | "complexity"
    | "patterns";
  aliases: string[];
  keywords: string[];
  operations: string[];
  timeComplexity: {
    best: string;
    avg: string;
    worst: string;
  };
  spaceComplexity: string;
  hasDeterministicEngine: boolean;
  lessonId?: string;
  defaultInput?: number[];
  summary: string;
  whyItMatters: string;
  visualType:
    | "array"
    | "linked-list"
    | "tree"
    | "graph"
    | "stack"
    | "queue"
    | "hash-table"
    | "heap"
    | "conceptual";
  misconceptions: Record<string, string>;
}

export const DSA_CATEGORIES = [
  { id: "arrays", label: "Arrays", description: "Contiguous memory, direct indexing, traversal, two-pointers, and sliding windows" },
  { id: "strings", label: "Strings", description: "Character arrays, palindromes, substrings, and string manipulation" },
  { id: "linked-lists", label: "Linked Lists", description: "Node-pointer chains, dynamic size, reversal, and cycle detection" },
  { id: "stacks", label: "Stacks", description: "Last-In First-Out (LIFO), function calls, and monotonic tracking" },
  { id: "queues", label: "Queues", description: "First-In First-Out (FIFO), BFS buffers, and circular queues" },
  { id: "hashing", label: "Hash Tables", description: "Key-value indexing, hash functions, and collision resolution" },
  { id: "sets", label: "Sets & Unique Elements", description: "Deduplication, hash sets, membership testing, and set operations" },
  { id: "trees", label: "Trees & Binary Trees", description: "Hierarchical branching, BST invariants, and recursive traversals" },
  { id: "balanced-trees", label: "Balanced Trees", description: "AVL trees, red-black trees, rotations, and strict height balancing" },
  { id: "heaps", label: "Heaps & Priority Queues", description: "Complete binary trees satisfying heap order for priority queues" },
  { id: "tries", label: "Tries & Prefix Trees", description: "Retrieval trees for efficient prefix search, auto-complete, and dictionary lookups" },
  { id: "dsu", label: "Disjoint Set Union (DSU)", description: "Union-Find structure with path compression and union by rank" },
  { id: "graphs", label: "Graphs & Traversals", description: "Networks of vertices and edges, BFS/DFS, and topological sorting" },
  { id: "shortest-paths", label: "Shortest Paths & MST", description: "Dijkstra, Bellman-Ford, Prim, and Kruskal algorithms" },
  { id: "sorting", label: "Sorting", description: "Ordering collections: comparison-based and linear distribution sorts" },
  { id: "searching", label: "Searching", description: "Locating targets via linear scans or logarithmic divide-and-conquer" },
  { id: "recursion", label: "Recursion & Call Stack", description: "Self-referential functions, base cases, call stacks, and divide-and-conquer" },
  { id: "backtracking", label: "Backtracking", description: "Systematic search with choose-explore-unchoose and constraint pruning" },
  { id: "dp", label: "Dynamic Programming", description: "Breaking problems into overlapping subproblems with memoization/tabulation" },
  { id: "greedy", label: "Greedy Algorithms", description: "Making locally optimal choices to achieve globally optimal solutions" },
  { id: "bit-manipulation", label: "Bit Manipulation & Math", description: "Hardware-level bitwise operations, masking, power of 2, and XOR tricks" },
  { id: "complexity", label: "Complexity & Big-O", description: "Theoretical analysis of algorithm time and space resource scaling" },
] as const;

export const DSA_TOPIC_REGISTRY: Record<string, DSATopicDefinition> = {
  /* ──── SORTING ──── */
  "bubble-sort": {
    id: "bubble-sort",
    name: "Bubble Sort",
    category: "sorting",
    aliases: ["bubblesort", "bubble sort", "sinking sort"],
    keywords: ["bubble", "swap adjacent", "pass through"],
    operations: ["compare adjacent", "swap", "shrink unsorted window"],
    timeComplexity: { best: "O(n)", avg: "O(n²)", worst: "O(n²)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: true,
    defaultInput: [9, 4, 7, 3, 10],
    visualType: "array",
    summary: "Repeatedly steps through the list, compares adjacent elements and swaps them if they are in the wrong order.",
    whyItMatters: "Simple educational introduction to sorting and in-place swapping mechanics.",
    misconceptions: {
      SORTING_WRONG_SWAP: "Swapping elements when the left is smaller than the right inverts sorted order.",
    },
  },
  "selection-sort": {
    id: "selection-sort",
    name: "Selection Sort",
    category: "sorting",
    aliases: ["selectionsort", "selection sort"],
    keywords: ["selection", "find minimum", "select min"],
    operations: ["find min in suffix", "swap to prefix", "advance boundary"],
    timeComplexity: { best: "O(n²)", avg: "O(n²)", worst: "O(n²)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: true,
    defaultInput: [29, 10, 14, 37, 13],
    visualType: "array",
    summary: "Divides the array into sorted and unsorted regions, repeatedly finding the minimum element from the unsorted region and moving it to the sorted region.",
    whyItMatters: "Minimizes the total number of swaps (exactly n-1 swaps maximum).",
    misconceptions: {
      SORTING_WRONG_SWAP: "Swapping before finding the true minimum across the entire suffix corrupts sorted order.",
    },
  },
  "insertion-sort": {
    id: "insertion-sort",
    name: "Insertion Sort",
    category: "sorting",
    aliases: ["insertionsort", "insertion sort"],
    keywords: ["insertion", "shift elements", "insert into sorted"],
    operations: ["extract key", "shift greater right", "insert key"],
    timeComplexity: { best: "O(n)", avg: "O(n²)", worst: "O(n²)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: true,
    defaultInput: [12, 11, 13, 5, 6],
    visualType: "array",
    summary: "Builds the final sorted array one item at a time by repeatedly taking the next element and inserting it into its correct position among the already-sorted prefix.",
    whyItMatters: "Highly efficient for nearly-sorted data (O(n) time) and small arrays.",
    misconceptions: {
      SORTING_WRONG_SWAP: "Failing to shift elements creates duplicate values and loses items.",
    },
  },
  "merge-sort": {
    id: "merge-sort",
    name: "Merge Sort",
    category: "sorting",
    aliases: ["mergesort", "merge sort"],
    keywords: ["merge", "divide and conquer", "split subarrays"],
    operations: ["divide in halves", "recursively sort", "merge two sorted arrays"],
    timeComplexity: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: true,
    defaultInput: [38, 27, 43, 3, 9, 82, 10],
    visualType: "array",
    summary: "A divide-and-conquer algorithm that divides the array into two halves, recursively sorts each half, and merges the two sorted halves back together.",
    whyItMatters: "Guaranteed O(n log n) worst-case performance and stable ordering.",
    misconceptions: {
      SORTING_PARTITION_ERROR: "Forgetting to copy remaining elements from either half during merge leaves data unsorted.",
    },
  },
  "quick-sort": {
    id: "quick-sort",
    name: "Quick Sort",
    category: "sorting",
    aliases: ["quicksort", "quick sort", "partition sort"],
    keywords: ["quick", "pivot", "partition", "lomuto", "hoare"],
    operations: ["choose pivot", "partition array", "recurse on left and right"],
    timeComplexity: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n²)" },
    spaceComplexity: "O(log n)",
    hasDeterministicEngine: true,
    defaultInput: [8, 3, 5, 1, 9, 2],
    visualType: "array",
    summary: "Selects a pivot element and partitions the array such that elements smaller than the pivot are placed before it and larger elements after it, then recurses on the partitions.",
    whyItMatters: "Fastest practical in-place comparison sort with excellent cache locality.",
    misconceptions: {
      SORTING_PARTITION_ERROR: "Choosing an already sorted pivot without randomization leads to O(n²) worst case.",
    },
  },
  "heap-sort": {
    id: "heap-sort",
    name: "Heap Sort",
    category: "sorting",
    aliases: ["heapsort", "heap sort"],
    keywords: ["heap sort", "max heap sort", "heapify sort"],
    operations: ["build max heap", "swap root with end", "sift down / heapify"],
    timeComplexity: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: true,
    defaultInput: [12, 11, 13, 5, 6, 7],
    visualType: "array",
    summary: "Builds a max-heap from the input data, then repeatedly extracts the maximum element and places it at the end of the array, shrinking the heap boundary.",
    whyItMatters: "Combines guaranteed O(n log n) runtime with in-place O(1) auxiliary space.",
    misconceptions: {
      HEAP_PROPERTY_VIOLATION: "Failing to re-heapify the root after swap corrupts the heap order.",
    },
  },
  "counting-sort": {
    id: "counting-sort",
    name: "Counting Sort",
    category: "sorting",
    aliases: ["countingsort", "counting sort"],
    keywords: ["counting", "non comparison sort", "frequency array"],
    operations: ["count frequencies", "prefix sums", "place in output array"],
    timeComplexity: { best: "O(n + k)", avg: "O(n + k)", worst: "O(n + k)" },
    spaceComplexity: "O(k)",
    hasDeterministicEngine: true,
    defaultInput: [4, 2, 2, 8, 3, 3, 1],
    visualType: "array",
    summary: "An integer sorting algorithm that counts the occurrences of each distinct value and calculates their positions directly without comparisons.",
    whyItMatters: "Breaches the O(n log n) comparison barrier for bounded integer ranges.",
    misconceptions: {
      SORTING_PARTITION_ERROR: "Using Counting Sort on arbitrary unbounded floats causes massive memory exhaustion.",
    },
  },
  "radix-sort": {
    id: "radix-sort",
    name: "Radix Sort",
    category: "sorting",
    aliases: ["radixsort", "radix sort", "digit sort"],
    keywords: ["radix", "least significant digit", "LSD", "digit by digit"],
    operations: ["extract digit", "bucket by place value", "recollect"],
    timeComplexity: { best: "O(d · (n + k))", avg: "O(d · (n + k))", worst: "O(d · (n + k))" },
    spaceComplexity: "O(n + k)",
    hasDeterministicEngine: true,
    defaultInput: [170, 45, 75, 90, 802, 24, 2, 66],
    visualType: "array",
    summary: "Sorts numbers digit by digit starting from the least significant digit (LSD) to the most significant digit using a stable subroutine like counting sort.",
    whyItMatters: "Linear time O(d·n) sorting for fixed-length keys and large datasets.",
    misconceptions: {
      SORTING_WRONG_SWAP: "Using an unstable inner sort in Radix Sort breaks previously sorted digit orders.",
    },
  },
  "bucket-sort": {
    id: "bucket-sort",
    name: "Bucket Sort",
    category: "sorting",
    aliases: ["bucketsort", "bucket sort", "bin sort"],
    keywords: ["bucket", "scatter gather", "distribute into buckets"],
    operations: ["scatter into buckets", "sort individual buckets", "concatenate"],
    timeComplexity: { best: "O(n + k)", avg: "O(n)", worst: "O(n²)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: true,
    defaultInput: [78, 17, 39, 26, 72, 94, 21, 12],
    visualType: "array",
    summary: "Distributes elements into a number of buckets, sorts each bucket individually using insertion sort, and then concatenates the buckets.",
    whyItMatters: "Exceptional linear average performance when input is uniformly distributed.",
    misconceptions: {
      SORTING_PARTITION_ERROR: "Uneven bucket distribution can degrade runtime to worst-case O(n²).",
    },
  },

  /* ──── ARRAYS ──── */
  "second-max": {
    id: "second-max",
    name: "Second Maximum Element",
    category: "arrays",
    aliases: ["second largest", "second maximum", "second biggest"],
    keywords: ["second max", "second largest", "runner up"],
    operations: ["linear scan", "track max", "track secondMax"],
    timeComplexity: { best: "O(n)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: true,
    lessonId: "second-max",
    defaultInput: [10, 5, 20, 8, 15],
    visualType: "array",
    summary: "Finds the second largest distinct element in an unsorted array in a single pass without sorting.",
    whyItMatters: "Demonstrates state tracking, pointer traversal, and avoiding unnecessary O(n log n) sorting.",
    misconceptions: {
      SECONDMAX_MAX_CONFUSION: "When a new maximum is found, the old maximum must first demote into secondMax.",
    },
  },
  "array-traversal": {
    id: "array-traversal",
    name: "Array Operations",
    category: "arrays",
    aliases: ["arrays", "array", "array traversal", "array insertion"],
    keywords: ["array", "index", "contiguous memory", "element"],
    operations: ["index access O(1)", "traversal O(n)", "insertion O(n)", "deletion O(n)"],
    timeComplexity: { best: "O(1)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: false,
    lessonId: "explain-arrays",
    defaultInput: [10, 20, 30, 40, 50],
    visualType: "conceptual",
    summary: "A fundamental linear data structure storing elements in contiguous memory locations, enabling constant-time indexing by address arithmetic.",
    whyItMatters: "Foundation of computer memory layouts, cache performance, and all contiguous structures.",
    misconceptions: {
      INCORRECT_COMPARISON: "Inserting at index 0 requires shifting all n elements right (O(n) time).",
    },
  },
  "two-pointers": {
    id: "two-pointers",
    name: "Two Pointer Technique",
    category: "arrays",
    aliases: ["two pointers", "two pointer", "two pointer technique", "left right pointers"],
    keywords: ["two pointers", "opposite ends", "shrink window", "sorted pair", "converge"],
    operations: ["left pointer", "right pointer", "inward convergence", "partitioning"],
    timeComplexity: { best: "O(n)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: false,
    lessonId: "explain-two-pointers",
    visualType: "conceptual",
    summary: "An algorithmic technique using two pointers to iterate across a data structure simultaneously, typically converging from opposite ends or moving at different speeds.",
    whyItMatters: "Solves pair-sum, container with most water, and palindrome checks in linear O(n) time with O(1) space.",
    misconceptions: {
      INCORRECT_COMPARISON: "Two pointers converging from ends requires the array to be sorted to know which pointer to move.",
    },
  },
  "sliding-window": {
    id: "sliding-window",
    name: "Sliding Window Technique",
    category: "arrays",
    aliases: ["sliding window", "sliding window technique", "window technique", "subarray window"],
    keywords: ["sliding window", "window", "expand contract", "fixed window", "variable window", "max subarray"],
    operations: ["expand right", "contract left", "maintain window state", "update answer"],
    timeComplexity: { best: "O(n)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: false,
    lessonId: "explain-sliding-window",
    visualType: "conceptual",
    summary: "Maintains a computational window over a linear collection that slides across elements, adding new incoming elements and discarding outgoing ones.",
    whyItMatters: "Converts brute-force O(n·k) or O(n²) contiguous subarray/substring problems into optimal O(n) single passes.",
    misconceptions: {
      INCORRECT_COMPARISON: "A sliding window problem only applies to contiguous subarrays or substrings, not arbitrary subsets.",
    },
  },

  /* ──── SEARCHING ──── */
  "binary-search": {
    id: "binary-search",
    name: "Binary Search",
    category: "searching",
    aliases: ["binary search", "bsearch", "half-interval search"],
    keywords: ["binary search", "search sorted", "mid", "low high"],
    operations: ["calculate mid", "compare with target", "halve search space"],
    timeComplexity: { best: "O(1)", avg: "O(log n)", worst: "O(log n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: true,
    defaultInput: [10, 20, 30, 40, 50, 60, 70, 80],
    visualType: "array",
    summary: "Searches a sorted array by repeatedly dividing the search space in half based on comparison with the middle element.",
    whyItMatters: "The canonical logarithmic divide-and-conquer search pattern.",
    misconceptions: {
      BINARY_SEARCH_WRONG_HALF: "When target is greater than mid in an ascending array, eliminate the left half.",
    },
  },
  "linear-search": {
    id: "linear-search",
    name: "Linear Search",
    category: "searching",
    aliases: ["linear search", "sequential search"],
    keywords: ["linear scan", "sequential scan", "find in unsorted"],
    operations: ["inspect element", "compare with target", "advance pointer"],
    timeComplexity: { best: "O(1)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: false,
    defaultInput: [4, 9, 1, 7, 3, 8],
    visualType: "conceptual",
    summary: "Sequentially checks each element of the list until a match is found or the whole list has been searched.",
    whyItMatters: "Works on unsorted collections and requires no prerequisites or preprocessing.",
    misconceptions: {
      INCORRECT_COMPARISON: "Linear search does not require the input array to be sorted.",
    },
  },

  /* ──── LINKED LISTS ──── */
  "linked-list-reverse": {
    id: "linked-list-reverse",
    name: "Linked List Reversal",
    category: "linked-lists",
    aliases: ["linked list", "linked lists", "reverse linked list", "linked list reversal", "reverse list"],
    keywords: ["reverse", "prev curr next", "pointer manipulation", "node pointer", "linked list"],
    operations: ["save next", "relink next to prev", "advance prev", "advance curr"],
    timeComplexity: { best: "O(n)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: true,
    lessonId: "linked-list-reverse",
    defaultInput: [1, 2, 3, 4],
    visualType: "linked-list",
    summary: "Reverses a singly linked list in-place by updating each node's next pointer to point to its predecessor.",
    whyItMatters: "Fundamental test of pointer safety, temporary pointer storage, and avoiding memory loss.",
    misconceptions: {
      LINKED_LIST_POINTER_CONFUSION: "Reassigning curr.next before saving next loses the remainder of the linked list.",
    },
  },

  /* ──── STACKS & QUEUES ──── */
  "stack-ops": {
    id: "stack-ops",
    name: "Stack Operations (LIFO)",
    category: "stacks",
    aliases: ["stack", "stacks", "push pop", "lifo", "undo", "undo redo", "undo stack"],
    keywords: ["stack", "push", "pop", "peek", "top", "lifo", "undo"],
    operations: ["push O(1)", "pop O(1)", "peek O(1)"],
    timeComplexity: { best: "O(1)", avg: "O(1)", worst: "O(1)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: true,
    defaultInput: [10, 20, 30],
    visualType: "stack",
    summary: "A linear data structure following Last-In First-Out (LIFO) semantics, where elements are inserted and removed from the top.",
    whyItMatters: "Powers function call stacks, undo/redo mechanisms, and monotonic tracking.",
    misconceptions: {
      STACK_LIFO_MISCONCEPTION: "Stacks remove the most recently pushed item first, unlike queues.",
    },
  },
  "queue-ops": {
    id: "queue-ops",
    name: "Queue Operations (FIFO)",
    category: "queues",
    aliases: ["queue", "queues", "enqueue dequeue", "fifo"],
    keywords: ["queue", "enqueue", "dequeue", "front", "rear", "fifo"],
    operations: ["enqueue O(1)", "dequeue O(1)", "peek O(1)"],
    timeComplexity: { best: "O(1)", avg: "O(1)", worst: "O(1)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: true,
    defaultInput: [15, 25, 35],
    visualType: "queue",
    summary: "A linear data structure following First-In First-Out (FIFO) semantics, where items enter at the rear and exit from the front.",
    whyItMatters: "Powers BFS traversal, task schedulers, print spoolers, and buffer streams.",
    misconceptions: {
      QUEUE_FIFO_MISCONCEPTION: "Queues process elements in arrival order, preserving order of entry.",
    },
  },

  /* ──── HASHING ──── */
  "hash-table-ops": {
    id: "hash-table-ops",
    name: "Hash Table & Collisions",
    category: "hashing",
    aliases: ["hash table", "hash map", "hashing", "hash collision", "dictionary", "dict", "map"],
    keywords: ["hash", "bucket", "collision", "chaining", "key value", "dictionary", "map"],
    operations: ["hash function", "modulo indexing", "bucket insertion", "chaining"],
    timeComplexity: { best: "O(1)", avg: "O(1)", worst: "O(n)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: true,
    defaultInput: [12, 22, 15, 35, 7],
    visualType: "hash-table",
    summary: "Maps keys to array indices via a hash function, using separate chaining to handle collisions when multiple keys hash to the same bucket.",
    whyItMatters: "Enables average O(1) lookups, insertions, and deletions across all computing.",
    misconceptions: {
      INCORRECT_COMPARISON: "Hash tables achieve O(1) average time, but degrade to O(n) under severe collisions without resizing.",
    },
  },

  /* ──── TREES ──── */
  "bst-insert": {
    id: "bst-insert",
    name: "BST Insertion & Traversal",
    category: "trees",
    aliases: ["binary search tree", "bst", "bst insertion", "insert bst"],
    keywords: ["bst", "binary search tree", "tree insertion", "left smaller right larger"],
    operations: ["compare with root", "branch left or right", "insert at leaf"],
    timeComplexity: { best: "O(log n)", avg: "O(log n)", worst: "O(n)" },
    spaceComplexity: "O(h)",
    hasDeterministicEngine: true,
    defaultInput: [50, 30, 70, 20, 40, 60, 80],
    visualType: "tree",
    summary: "Inserts a new value into a Binary Search Tree by preserving the invariant: left child < node < right child.",
    whyItMatters: "Foundation of ordered associative maps and logarithmic hierarchical lookups.",
    misconceptions: {
      BST_WRONG_BRANCH: "Values less than the node must branch left; values greater must branch right.",
    },
  },
  "avl-tree": {
    id: "avl-tree",
    name: "AVL Tree (Self-Balancing)",
    category: "balanced-trees",
    aliases: ["avl", "avl tree", "balanced bst", "tree rotations"],
    keywords: ["avl", "balance factor", "rotations", "LL RR LR RL"],
    operations: ["calculate balance factor", "single rotation", "double rotation"],
    timeComplexity: { best: "O(log n)", avg: "O(log n)", worst: "O(log n)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    visualType: "conceptual",
    summary: "A self-balancing BST where the difference between heights of left and right subtrees (balance factor) cannot exceed 1 for any node, using tree rotations to restore balance.",
    whyItMatters: "Guarantees strict O(log n) worst-case time by preventing tree skewing.",
    misconceptions: {
      BST_WRONG_BRANCH: "AVL rotations do not change the inorder traversal ordering of the tree.",
    },
  },

  /* ──── HEAPS ──── */
  "heap-ops": {
    id: "heap-ops",
    name: "Heap & Priority Queue",
    category: "heaps",
    aliases: ["heap", "max heap", "min heap", "priority queue"],
    keywords: ["heap", "heapify", "sift up", "sift down", "priority queue"],
    operations: ["insert O(log n)", "extract-min/max O(log n)", "peek O(1)", "build heap O(n)"],
    timeComplexity: { best: "O(1)", avg: "O(log n)", worst: "O(log n)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    defaultInput: [10, 40, 30, 5, 20, 50],
    visualType: "conceptual",
    summary: "A complete binary tree satisfying the heap property: in a max-heap, every parent is ≥ its children.",
    whyItMatters: "Optimal implementation of priority queues, Dijkstra's algorithm, and Huffman coding.",
    misconceptions: {
      HEAP_PROPERTY_VIOLATION: "A heap is not a BST: left and right children have no relative ordering between each other.",
    },
  },

  /* ──── GRAPHS ──── */
  "graph-bfs": {
    id: "graph-bfs",
    name: "Breadth-First Search (BFS)",
    category: "graphs",
    aliases: ["bfs", "breadth first search", "graph bfs", "level order"],
    keywords: ["bfs", "breadth first", "queue traversal", "shortest path unweighted"],
    operations: ["enqueue start", "dequeue node", "visit unvisited neighbors"],
    timeComplexity: { best: "O(V + E)", avg: "O(V + E)", worst: "O(V + E)" },
    spaceComplexity: "O(V)",
    hasDeterministicEngine: true,
    visualType: "graph",
    summary: "Explores a graph level by level using a queue, discovering all vertices at distance k before moving to distance k+1.",
    whyItMatters: "Guarantees the shortest path on unweighted graphs.",
    misconceptions: {
      GRAPH_CYCLE_CONFUSION: "Failing to mark nodes as visited when enqueuing causes infinite loops in cyclic graphs.",
    },
  },
  "graph-dfs": {
    id: "graph-dfs",
    name: "Depth-First Search (DFS)",
    category: "graphs",
    aliases: ["dfs", "depth first search", "graph dfs"],
    keywords: ["dfs", "depth first", "recursion", "backtracking", "cycle detection"],
    operations: ["visit node", "recurse on first unvisited neighbor", "backtrack"],
    timeComplexity: { best: "O(V + E)", avg: "O(V + E)", worst: "O(V + E)" },
    spaceComplexity: "O(V)",
    hasDeterministicEngine: true,
    visualType: "graph",
    summary: "Explores as deep as possible along each branch before backtracking, utilizing an implicit call stack or explicit stack.",
    whyItMatters: "Key algorithm for topological sorting, connected components, and cycle detection.",
    misconceptions: {
      GRAPH_CYCLE_CONFUSION: "DFS does not find the shortest path; it dives deep before searching alternative routes.",
    },
  },
  "dijkstra": {
    id: "dijkstra",
    name: "Dijkstra's Shortest Path",
    category: "graphs",
    aliases: ["dijkstra", "dijkstra algorithm", "shortest path"],
    keywords: ["dijkstra", "shortest path", "weighted graph", "priority queue relax"],
    operations: ["initialize distances", "extract min distance", "relax adjacent edges"],
    timeComplexity: { best: "O((V + E) log V)", avg: "O((V + E) log V)", worst: "O((V + E) log V)" },
    spaceComplexity: "O(V)",
    hasDeterministicEngine: false,
    visualType: "conceptual",
    summary: "A greedy algorithm that finds the shortest paths from a single source vertex to all other vertices in a weighted graph with non-negative edge weights.",
    whyItMatters: "The standard algorithm powering GPS routing and network packet transmission.",
    misconceptions: {
      GRAPH_CYCLE_CONFUSION: "Dijkstra's algorithm fails or loops endlessly when edges have negative weights (use Bellman-Ford instead).",
    },
  },

  /* ──── DYNAMIC PROGRAMMING ──── */
  "dynamic-programming": {
    id: "dynamic-programming",
    name: "Dynamic Programming & Memoization",
    category: "dp",
    aliases: ["dp", "dynamic programming", "memoization", "tabulation"],
    keywords: ["dp", "memoization", "tabulation", "subproblem", "optimal substructure"],
    operations: ["define state", "formulate recurrence", "memoize / build table"],
    timeComplexity: { best: "O(n)", avg: "O(n · W)", worst: "Polynomial" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    lessonId: "explain-dp",
    visualType: "conceptual",
    summary: "An algorithmic optimization technique that solves complex problems by breaking them into overlapping subproblems and storing subproblem results to avoid redundant calculations.",
    whyItMatters: "Transforms exponential O(2ⁿ) recursive algorithms into efficient polynomial O(n) or O(n·W) solutions.",
    misconceptions: {
      UNCERTAIN: "DP applies only when the problem exhibits both Optimal Substructure and Overlapping Subproblems.",
    },
  },

  /* ──── SETS ──── */
  "set-ops": {
    id: "set-ops",
    name: "Set & Unique Elements",
    category: "sets",
    aliases: ["set", "sets", "hashset", "unique elements", "deduplication", "set operations"],
    keywords: ["set", "unique", "distinct", "deduplicate", "hash set", "union", "intersection", "difference"],
    operations: ["add element", "has element O(1)", "delete element", "union / intersection"],
    timeComplexity: { best: "O(1)", avg: "O(1)", worst: "O(n)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    lessonId: "explain-set",
    visualType: "conceptual",
    summary: "An abstract collection that stores unique elements in no particular order, automatically rejecting duplicates and providing average O(1) membership lookups.",
    whyItMatters: "Essential for duplicate elimination, visited sets in graph search, and constant-time set algebra.",
    misconceptions: {
      INCORRECT_COMPARISON: "A standard HashSet does not maintain insertion order or sorted order; use LinkedHashSet or TreeSet for ordering.",
    },
  },

  /* ──── STRINGS ──── */
  "strings": {
    id: "strings",
    name: "String Manipulation",
    category: "strings",
    aliases: ["string", "strings", "string manipulation", "character array"],
    keywords: ["string", "character", "substring", "immutable", "ascii"],
    operations: ["charAt O(1)", "substring O(k)", "concatenation", "pattern match"],
    timeComplexity: { best: "O(1)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    visualType: "conceptual",
    summary: "Sequences of characters stored contiguously, often immutable in high-level languages, requiring array builders for efficient concatenation.",
    whyItMatters: "Core of text processing, parsing, tokenization, serialization, and string matching algorithms.",
    misconceptions: {
      INCORRECT_COMPARISON: "Concatenating strings inside an n-step loop without a builder results in O(n²) time due to repeated memory allocations.",
    },
  },
  "palindrome": {
    id: "palindrome",
    name: "Palindrome Verification",
    category: "strings",
    aliases: ["palindrome", "valid palindrome", "check palindrome"],
    keywords: ["palindrome", "mirror", "symmetric string", "two pointer palindrome"],
    operations: ["compare left and right", "advance left", "retreat right"],
    timeComplexity: { best: "O(1)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: false,
    visualType: "conceptual",
    summary: "Checks whether a string reads the same forwards and backwards by converging two pointers inward.",
    whyItMatters: "Classic two-pointer pattern demonstrating symmetry verification in O(1) auxiliary space.",
    misconceptions: {
      INCORRECT_COMPARISON: "Allocating a reversed copy of the string uses O(n) memory, whereas two pointers requires only O(1) auxiliary space.",
    },
  },

  /* ──── STACKS (EXTENDED) ──── */
  "monotonic-stack": {
    id: "monotonic-stack",
    name: "Monotonic Stack",
    category: "stacks",
    aliases: ["monotonic stack", "next greater element", "daily temperatures", "previous smaller"],
    keywords: ["monotonic stack", "next greater", "next smaller", "stock span", "histogram"],
    operations: ["maintain monotonic order", "pop smaller/greater", "record next greater", "push element"],
    timeComplexity: { best: "O(n)", avg: "O(n)", worst: "O(n)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    visualType: "stack",
    summary: "A stack that maintains its elements in strictly increasing or decreasing order, popping elements that violate the invariant before pushing a new value.",
    whyItMatters: "Solves next greater element, stock span, and largest rectangle in histogram in optimal O(n) time.",
    misconceptions: {
      STACK_LIFO_MISCONCEPTION: "Although there is a while loop inside a for loop, each element is pushed and popped at most once, yielding amortized O(n) time.",
    },
  },

  /* ──── TRIES ──── */
  "trie-prefix-tree": {
    id: "trie-prefix-tree",
    name: "Trie (Prefix Tree)",
    category: "tries",
    aliases: ["trie", "prefix tree", "trie tree", "autocomplete"],
    keywords: ["trie", "prefix", "character children", "isEndOfWord", "autocomplete", "dictionary"],
    operations: ["insert word O(k)", "search word O(k)", "startsWith prefix O(k)"],
    timeComplexity: { best: "O(k)", avg: "O(k)", worst: "O(k)" },
    spaceComplexity: "O(Σ · k · N)",
    hasDeterministicEngine: false,
    visualType: "tree",
    summary: "A tree where each node represents a character along a prefix path, allowing words sharing common prefixes to share nodes.",
    whyItMatters: "Provides O(k) prefix and word lookup time independent of dictionary size, powering auto-complete and spell check.",
    misconceptions: {
      INCORRECT_COMPARISON: "Lookup time in a Trie depends only on the length of the query key k, not on how many thousands of words are stored in the tree.",
    },
  },

  /* ──── DISJOINT SET UNION ──── */
  "disjoint-set-union": {
    id: "disjoint-set-union",
    name: "Disjoint Set Union (DSU / Union-Find)",
    category: "dsu",
    aliases: ["disjoint set union", "dsu", "union find", "union-find", "disjoint sets"],
    keywords: ["dsu", "union find", "path compression", "union by rank", "connected components", "cycle detection"],
    operations: ["find with path compression", "union by rank/size", "connected check"],
    timeComplexity: { best: "O(α(n))", avg: "O(α(n))", worst: "O(α(n))" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    visualType: "conceptual",
    summary: "A data structure tracking elements partitioned into non-overlapping subsets, supporting near-constant time Find and Union operations.",
    whyItMatters: "Enables near-linear O(α(n)) cycle detection in undirected graphs and powers Kruskal's Minimum Spanning Tree algorithm.",
    misconceptions: {
      INCORRECT_COMPARISON: "Without path compression or union by rank, trees can degrade into degenerate linked lists of height O(n).",
    },
  },

  /* ──── RECURSION & DIVIDE-AND-CONQUER ──── */
  "recursion-basics": {
    id: "recursion-basics",
    name: "Recursion & Call Stack",
    category: "recursion",
    aliases: ["recursion", "recursive function", "call stack", "base case"],
    keywords: ["recursion", "base case", "call stack", "stack frame", "recursive leap of faith"],
    operations: ["check base case", "decompose problem", "invoke self", "combine results"],
    timeComplexity: { best: "O(n)", avg: "O(n)", worst: "O(2ⁿ)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    lessonId: "explain-recursion",
    visualType: "conceptual",
    summary: "A fundamental computational technique where a function solves a problem by calling copies of itself on smaller subproblems until a base case is reached.",
    whyItMatters: "Foundation of divide-and-conquer, tree/graph traversals, and dynamic programming.",
    misconceptions: {
      UNCERTAIN: "Forgetting a base case causes an infinite recursion loop and a Stack Overflow error because stack frames exhaust memory.",
    },
  },

  /* ──── BACKTRACKING ──── */
  "backtracking": {
    id: "backtracking",
    name: "Backtracking & Decision Trees",
    category: "backtracking",
    aliases: ["backtracking", "backtrack", "decision tree", "n queens", "permutations", "subsets"],
    keywords: ["backtracking", "decision tree", "choose explore unchoose", "prune branch", "constraint satisfaction"],
    operations: ["choose candidate", "explore recursively", "unchoose / backtrack", "prune invalid state"],
    timeComplexity: { best: "O(1)", avg: "O(kⁿ)", worst: "O(n!)" },
    spaceComplexity: "O(n)",
    hasDeterministicEngine: false,
    lessonId: "explain-backtracking",
    visualType: "conceptual",
    summary: "An algorithmic technique that systematically explores all possible candidates via a decision tree, abandoning candidates ('backtracking') as soon as constraints are violated.",
    whyItMatters: "Solves constraint satisfaction and combinatorial optimization problems (N-Queens, Sudoku, Hamiltonian paths, Subset Sum).",
    misconceptions: {
      UNCERTAIN: "Backtracking differs from naive brute-force through pruning: invalid branches are abandoned early before exploring deeper.",
    },
  },

  /* ──── GREEDY ALGORITHMS ──── */
  "greedy-algorithms": {
    id: "greedy-algorithms",
    name: "Greedy Algorithms",
    category: "greedy",
    aliases: ["greedy", "greedy algorithm", "greedy choice", "interval scheduling", "activity selection"],
    keywords: ["greedy", "locally optimal", "activity selection", "fractional knapsack", "huffman coding"],
    operations: ["sort by criteria", "make local choice", "commit choice", "advance state"],
    timeComplexity: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: false,
    visualType: "conceptual",
    summary: "An algorithmic paradigm that makes the locally optimal choice at each stage with the intent of reaching a global optimum.",
    whyItMatters: "Fast and memory-efficient when the problem exhibits the Greedy-Choice Property and Optimal Substructure (e.g., Dijkstra, Kruskal).",
    misconceptions: {
      UNCERTAIN: "Greedy algorithms fail on 0/1 Knapsack and arbitrary coin systems because local choices can prevent the global optimum.",
    },
  },

  /* ──── BIT MANIPULATION ──── */
  "bit-manipulation": {
    id: "bit-manipulation",
    name: "Bit Manipulation & Binary Math",
    category: "bit-manipulation",
    aliases: ["bit manipulation", "bitwise operations", "bits", "power of two", "xor tricks"],
    keywords: ["bit manipulation", "bitwise AND", "bitwise XOR", "bitwise OR", "bit shift", "power of 2", "hamming weight"],
    operations: ["bitwise AND (&)", "bitwise OR (|)", "bitwise XOR (^)", "bit shifts (<<, >>)", "masking"],
    timeComplexity: { best: "O(1)", avg: "O(1)", worst: "O(1)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: false,
    visualType: "conceptual",
    summary: "Directly manipulating integer binary representations using bitwise operators at single-CPU-cycle speed.",
    whyItMatters: "Produces O(1) bit hacks (e.g. n & (n - 1) checks power of two or clears lowest set bit, x ^ x = 0 finds single unique element).",
    misconceptions: {
      INCORRECT_COMPARISON: "Bitwise operators have lower precedence than comparison operators in JS/C++; write (n & (n - 1)) === 0, not n & (n - 1) === 0.",
    },
  },

  /* ──── COMPLEXITY ANALYSIS ──── */
  "complexity-analysis": {
    id: "complexity-analysis",
    name: "Complexity & Big-O Analysis",
    category: "complexity",
    aliases: ["complexity", "big o", "time complexity", "space complexity", "asymptotic analysis", "big omega", "big theta"],
    keywords: ["big o", "time complexity", "space complexity", "asymptotic", "growth rate", "o(1)", "o(n)", "o(n log n)", "o(n^2)"],
    operations: ["count basic operations", "drop constants", "drop lower order terms", "identify worst-case input"],
    timeComplexity: { best: "O(1)", avg: "O(1)", worst: "O(1)" },
    spaceComplexity: "O(1)",
    hasDeterministicEngine: false,
    lessonId: "explain-complexity",
    visualType: "conceptual",
    summary: "Mathematical classification of how an algorithm's execution time and memory consumption scale as the input size n approaches infinity.",
    whyItMatters: "Provides an objective, hardware-independent standard to evaluate and compare algorithmic efficiency.",
    misconceptions: {
      INCORRECT_COMPARISON: "Big-O characterizes asymptotic growth rate as n grows, not wall-clock execution time in milliseconds for small inputs.",
    },
  },
};

/* ──── Lookup Helpers ──── */
export function findTopicByQuery(query: string): DSATopicDefinition | null {
  const q = query.toLowerCase().trim();

  // 1. Exact alias match: longest match wins to prioritize specific topics (e.g. "binary search tree" over "binary search")
  // Prioritize concrete algorithmic topics over meta topics like "complexity"
  let bestNonMetaTopic: DSATopicDefinition | null = null;
  let maxNonMetaLen = 0;
  let bestMetaTopic: DSATopicDefinition | null = null;
  let maxMetaLen = 0;

  for (const topic of Object.values(DSA_TOPIC_REGISTRY)) {
    for (const alias of topic.aliases) {
      const a = alias.toLowerCase();
      const matches =
        a.length <= 4 ? new RegExp(`\\b${a}\\b`, "i").test(q) : q.includes(a);
      if (matches) {
        if (topic.category === "complexity") {
          if (a.length > maxMetaLen) {
            maxMetaLen = a.length;
            bestMetaTopic = topic;
          }
        } else {
          if (a.length > maxNonMetaLen) {
            maxNonMetaLen = a.length;
            bestNonMetaTopic = topic;
          }
        }
      }
    }
  }

  if (bestNonMetaTopic) {
    return bestNonMetaTopic;
  }
  if (bestMetaTopic) {
    return bestMetaTopic;
  }

  // 2. Keyword match
  let bestTopic: DSATopicDefinition | null = null;
  let maxScore = 0;
  for (const topic of Object.values(DSA_TOPIC_REGISTRY)) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (q.includes(kw.toLowerCase())) score += 2;
    }
    if (q.includes(topic.category.toLowerCase())) score += 1;
    if (score > maxScore) {
      maxScore = score;
      bestTopic = topic;
    }
  }

  return maxScore >= 2 ? bestTopic : null;
}

export function findTopicsByCategory(category: string): DSATopicDefinition[] {
  return Object.values(DSA_TOPIC_REGISTRY).filter((t) => t.category === category);
}

export function detectComparison(query: string): [DSATopicDefinition, DSATopicDefinition] | null {
  const q = query.toLowerCase().trim();
  const vsMatch =
    q.match(/(?:compare|difference\s+between)\s+(.+?)\s+(?:and|with|to|vs\.?)\s+(.+)/i) ||
    q.match(/(.+?)\s+(?:vs\.?|versus|compared?\s+to|or|difference\s+between)\s+(.+)/i);
  if (!vsMatch) return null;

  const topicA = findTopicByQuery(vsMatch[1]);
  const topicB = findTopicByQuery(vsMatch[2]);
  if (topicA && topicB && topicA.id !== topicB.id) {
    return [topicA, topicB];
  }
  return null;
}
