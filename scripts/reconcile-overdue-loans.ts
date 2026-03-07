import { LoanLifecycleService } from "@/src/server/services/loan-lifecycle.service";

const saccoId = process.argv[2];

const run = async () => {
  const result = saccoId
    ? await LoanLifecycleService.reconcileSacco(saccoId)
    : await LoanLifecycleService.reconcileAll();

  console.log(JSON.stringify(result, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
