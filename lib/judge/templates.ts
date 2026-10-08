import type { CodingLanguage } from "@/types/contest";

export const STARTER_TEMPLATES: Record<CodingLanguage, string> = {
  python: `import sys

def solve():
    input_data = sys.stdin.read().strip()
    if not input_data:
        return
    # Write solution below:
    
if __name__ == '__main__':
    solve()
`,
  javascript: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    // Write solution below:
    
}

solve();
`,
  typescript: `const fs = require('fs');

function solve(): void {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    // Write solution below:
    
}

solve();
`,
  cpp: `#include <iostream>
#include <string>
#include <vector>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    // Write solution below:
    
    return 0;
}
`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write solution below:
        
    }
}
`,
  sql: `-- Write your SQL solution below\n\n`,
};

/**
 * Resolves question-specific starter template for SQL challenges.
 * If the question defines a specific starter, use it.
 * Otherwise, generate a clean, question-specific comment header.
 */
export function getSqlStarterTemplate(question?: {
  title?: string;
  starter_code?: string;
  starter_query?: string;
}): string {
  const custom = question?.starter_code || question?.starter_query;
  if (custom && custom.trim()) {
    return custom.trim() + "\n";
  }
  const title = question?.title ? question.title.trim() : "";
  if (title) {
    return `-- Write your SQL solution for: ${title}\n-- Review the schema in the problem description\n\n`;
  }
  return `-- Write your SQL solution below\n\n`;
}
