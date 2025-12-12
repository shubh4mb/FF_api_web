// utils/calculateFinalBilling.js
export function calculateFinalBilling({ 
  orderItems, 
  returnCharge = 0, 
  trialPhaseStart, 
  trialPhaseEnd 
}) {

  // === STEP 1: Accepted (kept or non-triable) items ===
  const acceptedItems = orderItems.filter(
    item => item.tryStatus === "accepted" || item.tryStatus === "not-triable"
  );

  // Base amount calculation
  let baseAmount = 0;
  for (const item of acceptedItems) {
    baseAmount += item.price * item.quantity;
  }

  // === STEP 2: Overtime Penalty ===
  let overtimePenalty = 0;
  if (trialPhaseStart && trialPhaseEnd) {
    const start = new Date(trialPhaseStart);
    const end = new Date(trialPhaseEnd);
    const minutes = Math.floor((end - start) / (1000 * 60));
    if (minutes > 10) overtimePenalty = minutes - 10; // ₹1/min over 10 mins
  }

  // === STEP 3: Return logic ===
  const returnedItemsCount = orderItems.filter(i => i.tryStatus === "returned").length;
  const allItemsKept = returnedItemsCount === 0;

  // Deduction only if all items are kept
  const returnChargeDeduction = allItemsKept ? returnCharge : 0;

  // === STEP 4: GST (set to 0 for now) ===
  const gst = 0;

  // === STEP 5: Final total ===
  const totalBeforeDeduction = baseAmount + gst + overtimePenalty;
  const totalPayable = totalBeforeDeduction - returnChargeDeduction;

  return {
    baseAmount,
    gst,
    overtimePenalty,
    returnCharge,
    returnChargeDeduction,
    totalPayable,
    itemsAccepted: acceptedItems.length,
    itemsReturned: returnedItemsCount,
    allItemsKept,
  };
}
