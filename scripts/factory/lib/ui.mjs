/**
 * lib/ui.mjs
 * Pretty console output for the intake engine
 */

export function printIntakeQuestions(script) {
  console.log("\n" + "─".repeat(60));
  console.log(`  📋 ${script.id} — ${script.description}`);
  console.log("─".repeat(60));
  
  for (let i = 0; i < script.questions.length; i++) {
    const q = script.questions[i];
    const req = q.required ? "🔴" : "⚪";
    console.log(`\n  ${req} ${q.label}`);
    if (q.options) {
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        const sel = j === 0 && q.required ? " ← default" : "";
        console.log(`     ${j + 1}. ${opt}${sel}`);
      }
    } else if (q.type === "text") {
      console.log(`     [text input]`);
    }
  }
  console.log("\n" + "─".repeat(60));
}

export function printContract(contract) {
  console.log("\n✅ Contract built:");
  console.log(JSON.stringify(contract, null, 2));
}

export function printExecutionResult(result) {
  if (!result) {
    console.log("\n✅ Execution complete.");
    return;
  }
  
  if (result.files) {
    console.log("\n📁 Files created/modified:");
    for (const f of result.files) {
      console.log(`   ${f.path} ${f.action || ""}`);
    }
  }
  
  if (result.commands) {
    console.log("\n⚙️  Commands to run:");
    for (const cmd of result.commands) {
      console.log(`   ${cmd}`);
    }
  }
  
  if (result.message) {
    console.log(`\n💬 ${result.message}`);
  }
  
  console.log("\n✅ Done.");
}

export function printAIGateway(payload) {
  console.log("\n🤖 AI GATEWAY — Escalation Required");
  console.log("─".repeat(60));
  
  if (payload.scriptId) {
    console.log(`\n  Script: ${payload.scriptId}`);
  }
  
  console.log(`\n  Question to ask AI:`);
  console.log(`  "${payload.questionToAsk}"`);
  
  console.log(`\n  Contract (minimal):`);
  console.log(JSON.stringify(payload.contract, null, 2));
  
  console.log(`\n  Deliverable expected:`);
  console.log(`  ${payload.deliverable}`);
  
  if (payload.autoCapture) {
    console.log(`\n  📝 AI should auto-write a script for next time`);
  }
  
  console.log("\n" + "─".repeat(60));
}

export function printScriptCard(script) {
  const qCount = script.questions.length;
  const triggers = script.trigger.slice(0, 3).join(", ");
  console.log(`  ${script.id.padEnd(20)} | ${triggers.padEnd(35)} | ${qCount} Q`);
}
