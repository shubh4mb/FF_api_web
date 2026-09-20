// utils/calculateFinalBilling.js
export function calculateFinalBilling({ 
  orderItems, 
  deliveryCharge = 0,
  returnCharge = 0, 
  deliveryTip = 0,
  trialPhaseStart, 
  trialPhaseEnd,
  discountToApply = 0,
  freeWaiting = false,
  freeDelivery = false,
  freeReturn = false,
}) {

  // === STEP 1: Accepted (kept or non-triable) items ===
  const acceptedItems = orderItems.filter(
    item => item.tryStatus === "accepted" || item.tryStatus === "keep" || item.tryStatus === "not-triable"
  );

  // Base amount calculation
  let baseAmount = 0;
  for (const item of acceptedItems) {
    baseAmount += item.price * (item.quantity || 1);
  }

  // === STEP 2: Overtime Penalty ===
  let overtimePenalty = 0;
  if (!freeWaiting && trialPhaseStart && trialPhaseEnd) {
    const start = new Date(trialPhaseStart);
    const end = new Date(trialPhaseEnd);
    const minutes = Math.floor((end - start) / (1000 * 60));
    if (minutes > 10) overtimePenalty = (minutes - 10) * 2; // ₹2/min over 10 mins
  }

  // === STEP 3: Return logic ===
  const isReturnFree = Boolean(freeReturn || freeDelivery || Number(deliveryCharge) === 0 || Number(returnCharge) === 0);
  const actualReturnCharge = isReturnFree ? 0 : (Number(returnCharge) || 0);

  const returnedItemsCount = orderItems.filter(
    i => i.tryStatus === "returned" || i.tryStatus === "return"
  ).length;
  const totalItemsCount = orderItems.length;
  const allItemsKept = returnedItemsCount === 0 && totalItemsCount > 0;

  // Deduction only if all items are kept (or if return charge is free)
  const returnChargeDeduction = allItemsKept ? actualReturnCharge : 0;
  const effectiveReturnCharge = allItemsKept || isReturnFree ? 0 : actualReturnCharge;

  // === STEP 4: Delivery charge and tip included ===
  const actualDeliveryCharge = freeDelivery ? 0 : (Number(deliveryCharge) || 0);
  const deliveryAndService = actualDeliveryCharge + effectiveReturnCharge + (Number(deliveryTip) || 0);

  // === STEP 5: Final total for FlashFits payment ===
  const totalBeforeDeduction = baseAmount + overtimePenalty + deliveryAndService;
  const totalPayable = Math.max(0, Math.round(totalBeforeDeduction - discountToApply));

  return {
    baseAmount,
    gst: 0,
    overtimePenalty,
    deliveryCharge: actualDeliveryCharge,
    returnCharge: actualReturnCharge,
    effectiveReturnCharge,
    deliveryTip: Number(deliveryTip) || 0,
    returnChargeDeduction,
    totalPayable,
    itemsAccepted: acceptedItems.length,
    itemsReturned: returnedItemsCount,
    allItemsKept,
    isWaitingFree: Boolean(freeWaiting),
    isDeliveryFree: Boolean(freeDelivery),
    isReturnFree,
  };
}
