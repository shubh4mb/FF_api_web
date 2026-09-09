// utils/calculateFinalBilling.js
export function calculateFinalBilling({ 
  orderItems, 
  deliveryCharge = 0,
  returnCharge = 0, 
  deliveryTip = 0,
  trialPhaseStart, 
  trialPhaseEnd,
  discountToApply = 0
}) {

  // === STEP 1: Accepted (kept or non-triable) items ===
  const acceptedItems = orderItems.filter(
    item => item.tryStatus === "accepted" || item.tryStatus === "not-triable"
  );

  // Base amount calculation
  let baseAmount = 0;
  for (const item of acceptedItems) {
    baseAmount += item.price * (item.quantity || 1);
  }

  // === STEP 2: Overtime Penalty ===
  let overtimePenalty = 0;
  if (trialPhaseStart && trialPhaseEnd) {
    const start = new Date(trialPhaseStart);
    const end = new Date(trialPhaseEnd);
    const minutes = Math.floor((end - start) / (1000 * 60));
    if (minutes > 10) overtimePenalty = (minutes - 10) * 2; // ₹2/min over 10 mins
  }

  // === STEP 3: Return logic ===
  const returnedItemsCount = orderItems.filter(i => i.tryStatus === "returned").length;
  const totalItemsCount = orderItems.length;
  const allItemsKept = returnedItemsCount === 0 && totalItemsCount > 0;

  // Deduction only if all items are kept
  const returnChargeDeduction = allItemsKept ? returnCharge : 0;
  const effectiveReturnCharge = allItemsKept ? 0 : returnCharge;

  // === STEP 4: Delivery charge and tip included if buying at least 1 ===
  const deliveryAndService = acceptedItems.length > 0
    ? (Number(deliveryCharge) || 0) + (Number(effectiveReturnCharge) || 0) + (Number(deliveryTip) || 0)
    : 0;

  // === STEP 5: Final total for FlashFits payment ===
  const totalBeforeDeduction = baseAmount + overtimePenalty + deliveryAndService;
  const totalPayable = Math.max(0, Math.round(totalBeforeDeduction - discountToApply));

  return {
    baseAmount,
    gst: 0,
    overtimePenalty,
    deliveryCharge,
    returnCharge,
    effectiveReturnCharge,
    deliveryTip,
    returnChargeDeduction,
    totalPayable,
    itemsAccepted: acceptedItems.length,
    itemsReturned: returnedItemsCount,
    allItemsKept,
  };
}
