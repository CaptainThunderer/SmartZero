import type { Lesson, LessonStep } from "../types/dsa";

export function buildStackLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "create_stack", items: [] },
        { action: "show_message", text: "Stack: Initialized empty stack (LIFO: Last-In First-Out)." },
      ],
      codeLine: "init",
      explanation: "A stack is a container of elements that are inserted and removed according to the Last-In First-Out (LIFO) principle.",
    },
    {
      actions: [
        { action: "push_stack", value: 10 },
        { action: "show_message", text: "push(10): 10 placed onto the stack. TOP = 10." },
      ],
      codeLine: "push",
      explanation: "Push operation adds 10 to the top of the stack.",
    },
    {
      actions: [
        { action: "push_stack", value: 20 },
        { action: "show_message", text: "push(20): 20 placed above 10. TOP = 20." },
      ],
      codeLine: "push",
      explanation: "Push operation adds 20 to the top. 20 now covers 10.",
    },
    {
      actions: [
        { action: "push_stack", value: 30 },
        { action: "show_message", text: "push(30): 30 placed at the top. Stack items: [10, 20, 30]." },
      ],
      codeLine: "push",
      explanation: "Pushed 30. Top element is 30.",
    },
    // Decision Point:
    {
      actions: [],
      codeLine: "pop",
      pause: true,
      explanation: "Decision point: When calling pop() on a stack with [10, 20, 30], which item is removed?",
      question: {
        prompt: "The stack contains [10, 20, 30] (with 30 at the top). What does pop() return?",
        choices: [
          { id: "a", text: "30 (the top/most recently pushed element)" },
          { id: "b", text: "10 (the bottom element)" },
          { id: "c", text: "All elements simultaneously" },
        ],
        correctId: "a",
        hints: [
          "Stacks follow LIFO: Last-In, First-Out.",
          "Think of a stack of dinner plates: you remove the plate on top first.",
          "30 was the last item pushed onto the stack.",
        ],
        misconceptions: {
          b: {
            code: "STACK_LIFO_MISCONCEPTION",
            feedback: "10 was pushed first. Removing 10 first would be FIFO (Queue) behavior, not Stack (LIFO).",
          },
        },
      },
    },
    {
      actions: [
        { action: "pop_stack" },
        { action: "show_message", text: "pop(): Removed 30 from the top. New TOP is 20." },
      ],
      codeLine: "pop",
      explanation: "Element 30 popped from the top of the stack in O(1) time.",
    },
    {
      actions: [
        { action: "pop_stack" },
        { action: "show_message", text: "pop(): Removed 20. Remaining item: [10]." },
        { action: "show_complexity", time: "O(1)", space: "O(n)" },
      ],
      codeLine: "done",
      explanation: "Stack operations complete. Push, pop, and peek all operate in constant O(1) time.",
    },
  ];

  return {
    id: "stack-ops",
    title: "Stack Operations (LIFO)",
    dataStructure: "Stack",
    pattern: "Last-In First-Out Container",
    objective: "Understand stack push, pop, and peek operations and LIFO ordering",
    difficulty: "Easy",
    steps,
    code: {
      javascript: [
        "class Stack {",
        "  constructor() { this.items = []; }",
        "  push(element) { this.items.push(element); }",
        "  pop() { return this.items.pop(); }",
        "  peek() { return this.items[this.items.length - 1]; }",
        "}",
      ],
      cpp: [
        "stack<int> s;",
        "s.push(10);",
        "s.push(20);",
        "s.push(30);",
        "int topVal = s.top(); s.pop();",
      ],
    },
    lineMap: {
      javascript: { init: 2, push: 3, pop: 4, done: 5 },
      cpp: { init: 1, push: 2, pop: 5, done: 5 },
    },
  };
}

export function buildQueueLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "create_queue", items: [] },
        { action: "show_message", text: "Queue: Initialized empty queue (FIFO: First-In First-Out)." },
      ],
      codeLine: "init",
      explanation: "A queue is a linear container where elements are added at the rear and removed from the front.",
    },
    {
      actions: [
        { action: "enqueue", value: 15 },
        { action: "show_message", text: "enqueue(15): 15 enters at the rear." },
      ],
      codeLine: "enqueue",
      explanation: "Enqueue 15. 15 is both the front and rear element.",
    },
    {
      actions: [
        { action: "enqueue", value: 25 },
        { action: "show_message", text: "enqueue(25): 25 added at rear. FRONT = 15, REAR = 25." },
      ],
      codeLine: "enqueue",
      explanation: "Enqueue 25 behind 15.",
    },
    {
      actions: [
        { action: "enqueue", value: 35 },
        { action: "show_message", text: "enqueue(35): Queue is now [15, 25, 35]." },
      ],
      codeLine: "enqueue",
      explanation: "Enqueue 35. Queue has 3 items in arrival order.",
    },
    // Decision Point:
    {
      actions: [],
      codeLine: "dequeue",
      pause: true,
      explanation: "Decision point: When calling dequeue(), which element exits the queue first?",
      question: {
        prompt: "The queue contains [15, 25, 35]. What does dequeue() return?",
        choices: [
          { id: "a", text: "15 (the front/first element to arrive)" },
          { id: "b", text: "35 (the rear/last element to arrive)" },
          { id: "c", text: "25 (the middle element)" },
        ],
        correctId: "a",
        hints: [
          "Queues follow FIFO: First-In, First-Out.",
          "Think of a checkout line at a store: the first customer to arrive is served first.",
          "15 was enqueued before 25 and 35.",
        ],
        misconceptions: {
          b: {
            code: "QUEUE_FIFO_MISCONCEPTION",
            feedback: "35 was the most recent item enqueued (at the rear). Removing from rear is LIFO (Stack) behavior.",
          },
        },
      },
    },
    {
      actions: [
        { action: "dequeue" },
        { action: "show_message", text: "dequeue(): Removed 15 from the front. New FRONT = 25." },
      ],
      codeLine: "dequeue",
      explanation: "Element 15 dequeued from the front in O(1) time.",
    },
    {
      actions: [
        { action: "dequeue" },
        { action: "show_message", text: "dequeue(): Removed 25. Remaining queue: [35]." },
        { action: "show_complexity", time: "O(1)", space: "O(n)" },
      ],
      codeLine: "done",
      explanation: "Queue operations complete. Enqueue, dequeue, and peek all operate in constant O(1) time.",
    },
  ];

  return {
    id: "queue-ops",
    title: "Queue Operations (FIFO)",
    dataStructure: "Queue",
    pattern: "First-In First-Out Buffer",
    objective: "Understand queue enqueue and dequeue mechanics in FIFO order",
    difficulty: "Easy",
    steps,
    code: {
      javascript: [
        "class Queue {",
        "  constructor() { this.items = []; }",
        "  enqueue(element) { this.items.push(element); }",
        "  dequeue() { return this.items.shift(); }",
        "  front() { return this.items[0]; }",
        "}",
      ],
      cpp: [
        "queue<int> q;",
        "q.push(15);",
        "q.push(25);",
        "q.push(35);",
        "int frontVal = q.front(); q.pop();",
      ],
    },
    lineMap: {
      javascript: { init: 2, enqueue: 3, dequeue: 4, done: 5 },
      cpp: { init: 1, enqueue: 2, dequeue: 5, done: 5 },
    },
  };
}

export function buildHashTableLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "create_hash_table", size: 5 },
        { action: "show_message", text: "Hash Table: 5 buckets (0 to 4), hash function h(k) = k % 5." },
      ],
      codeLine: "init",
      explanation: "A Hash Table maps keys to bucket indices using a hash function. We use separate chaining for collisions.",
    },
    {
      actions: [
        { action: "hash_insert", bucket: 2, key: 12 },
        { action: "show_message", text: "Insert key 12: h(12) = 12 % 5 = 2. Inserted into bucket [2]." },
      ],
      codeLine: "hash",
      explanation: "12 % 5 = 2. No collision in bucket 2.",
    },
    {
      actions: [
        { action: "hash_insert", bucket: 0, key: 15 },
        { action: "show_message", text: "Insert key 15: h(15) = 15 % 5 = 0. Inserted into bucket [0]." },
      ],
      codeLine: "hash",
      explanation: "15 % 5 = 0. Inserted into bucket 0.",
    },
    // Decision Point: Collision!
    {
      actions: [],
      codeLine: "collision",
      pause: true,
      explanation: "Decision point: We want to insert key 22. h(22) = 22 % 5 = 2. But bucket [2] already has key 12! What happens?",
      question: {
        prompt: "Key 22 hashes to bucket 2 (22 % 5 = 2), which already contains 12. In separate chaining, how is this handled?",
        choices: [
          { id: "a", text: "Chain 22 into bucket 2's linked list alongside 12" },
          { id: "b", text: "Overwrite 12 and discard it" },
          { id: "c", text: "Crash the program" },
        ],
        correctId: "a",
        hints: [
          "Separate chaining stores all colliding keys in a linked list at that bucket index.",
          "No keys are overwritten or deleted when collisions occur in separate chaining.",
          "22 will attach after 12 in bucket 2.",
        ],
        misconceptions: {
          b: {
            code: "INCORRECT_COMPARISON",
            feedback: "Overwriting 12 would result in permanent data loss. Chaining preserves all distinct keys.",
          },
        },
      },
    },
    {
      actions: [
        { action: "hash_insert", bucket: 2, key: 22 },
        { action: "show_message", text: "Collision resolved! Bucket [2] now chains: 12 → 22." },
      ],
      codeLine: "chain",
      explanation: "Collision resolution: 22 chained after 12 in bucket 2.",
    },
    {
      actions: [
        { action: "hash_insert", bucket: 4, key: 9 },
        { action: "show_message", text: "Insert key 9: h(9) = 9 % 5 = 4. Inserted into bucket [4]." },
        { action: "show_complexity", time: "O(1)", space: "O(n)" },
      ],
      codeLine: "done",
      explanation: "Hash table complete: O(1) average lookup/insert time when load factor is controlled.",
    },
  ];

  return {
    id: "hash-table-ops",
    title: "Hash Table & Collision Chaining",
    dataStructure: "Hash Table",
    pattern: "Hash Indexing with Separate Chaining",
    objective: "Understand hash computation, bucket mapping, and collision resolution via chaining",
    difficulty: "Medium",
    steps,
    code: {
      javascript: [
        "class HashTable {",
        "  constructor(size = 5) {",
        "    this.buckets = Array.from({ length: size }, () => []);",
        "  }",
        "  hash(key) { return key % this.buckets.length; }",
        "  insert(key, value) {",
        "    const idx = this.hash(key);",
        "    this.buckets[idx].push({ key, value });",
        "  }",
        "}",
      ],
      cpp: [
        "int hashFunc(int key, int size) { return key % size; }",
        "vector<list<int>> table(5);",
        "table[hashFunc(12, 5)].push_back(12);",
        "table[hashFunc(22, 5)].push_back(22); // Collision chaining",
      ],
    },
    lineMap: {
      javascript: { init: 2, hash: 5, collision: 7, chain: 8, done: 9 },
      cpp: { init: 1, hash: 1, collision: 4, chain: 4, done: 4 },
    },
  };
}
