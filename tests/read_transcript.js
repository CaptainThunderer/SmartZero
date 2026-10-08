const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/VICTUS/.gemini/antigravity/brain/8b2f4a5e-0e35-4fcd-8499-e699c6547221/.system_generated/logs/transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes("The production judge connectivity issue is FIXED") && line.includes("USER_INPUT")) {
      const parsed = JSON.parse(line);
      console.log(parsed.content);
    }
  }
}

processLineByLine();
