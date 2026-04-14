/**
 * Ghost Runner — src/scripts/ghost-runner.ts
 * Standalone script invoked by GitHub Actions.
 * Usage: npx tsx src/scripts/ghost-runner.ts
 */
import { conductGlobalSweep } from '../lib/ghost';

async function main() {
  console.log('👻 Scout Ghost Runner starting...');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(
    `   Supabase: ${(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) ? '✅' : '❌ MISSING'}`
  );
  console.log(
    `   Gemini:   ${(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) ? '✅' : '❌ MISSING'}`
  );
  console.log(
    `   Resend:   ${process.env.RESEND_API_KEY ? '✅' : '⚠️  not set (email disabled)'}`
  );

  try {
    const result = await conductGlobalSweep();
    console.log('\n✅ Sweep complete:');
    console.log(`   Jobs found  : ${result.jobs_found}`);
    console.log(`   Jobs filtered: ${result.jobs_filtered}`);
    console.log(`   Jobs saved  : ${result.jobs_saved}`);
    console.log(`   Top matches : ${result.top_matches}`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Sweep failed:', err);
    process.exit(1);
  }
}

main();
