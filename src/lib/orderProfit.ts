export type Founder = {
  id: string;
  name: string;
  weight?: number;
};

export type FounderResult = {
  id: string;
  name: string;
  weight: number;
  profit: number;
  recoveredCapital: number;
};

export type OrderProfitInput = {
  orderTotal: number;
  expectedProfit: number;
  companyProfitPercentage: number;
  consumedValue: number;
  paidValue: number;
  founders: Founder[];
  founderDistributionMode: "equal" | "weighted";
};

export type OrderProfitResult = {
  capital: number;
  profitRatio: number;
  capitalRatio: number;

  consumedProfit: number;
  consumedCapital: number;

  realizedProfit: number;
  recoveredCapital: number;

  companyProfit: number;
  foundersProfitPool: number;

  founderResults: FounderResult[];
};

export function calculateOrderProfit(input: OrderProfitInput): OrderProfitResult {
  const {
    orderTotal,
    expectedProfit,
    companyProfitPercentage,
    consumedValue,
    paidValue,
    founders,
    founderDistributionMode,
  } = input;

  const capital = orderTotal - expectedProfit;
  const profitRatio = orderTotal > 0 ? expectedProfit / orderTotal : 0;
  const capitalRatio = orderTotal > 0 ? capital / orderTotal : 0;

  const consumedProfit = consumedValue * profitRatio;
  const consumedCapital = consumedValue * capitalRatio;

  const realizedProfit = paidValue * profitRatio;
  const recoveredCapital = paidValue * capitalRatio;

  const companyProfit = realizedProfit * companyProfitPercentage;
  const foundersProfitPool = realizedProfit - companyProfit;

  const n = founders.length || 1;

  let founderResults: FounderResult[];

  if (founderDistributionMode === "equal") {
    founderResults = founders.map((f) => ({
      id: f.id,
      name: f.name,
      weight: 1 / n,
      profit: foundersProfitPool / n,
      recoveredCapital: recoveredCapital / n,
    }));
  } else {
    const totalWeight = founders.reduce((s, f) => s + (f.weight ?? 0), 0) || 1;
    founderResults = founders.map((f) => {
      const w = (f.weight ?? 0) / totalWeight;
      return {
        id: f.id,
        name: f.name,
        weight: w,
        profit: foundersProfitPool * w,
        recoveredCapital: recoveredCapital * w,
      };
    });
  }

  return {
    capital,
    profitRatio,
    capitalRatio,
    consumedProfit,
    consumedCapital,
    realizedProfit,
    recoveredCapital,
    companyProfit,
    foundersProfitPool,
    founderResults,
  };
}

export type QuickProfitInput = {
  orderTotal: number;
  totalCost: number;
  paidValue: number;
  companyProfitPct: number;
};

export type QuickProfitResult = {
  capital: number;
  expectedProfit: number;
  profitRatio: number;
  capitalRatio: number;
  realizedProfit: number;
  recoveredCapital: number;
  companyProfit: number;
  foundersProfit: number;
};

export function quickProfit(input: QuickProfitInput): QuickProfitResult {
  const { orderTotal, totalCost, paidValue, companyProfitPct } = input;
  const expectedProfit = orderTotal - totalCost;
  const profitRatio = orderTotal > 0 ? expectedProfit / orderTotal : 0;
  const capitalRatio = orderTotal > 0 ? totalCost / orderTotal : 0;

  const realizedProfit = paidValue * profitRatio;
  const recoveredCapital = paidValue * capitalRatio;

  const pct = Math.min(Math.max(companyProfitPct >= 2 ? companyProfitPct / 100 : companyProfitPct, 0), 1);
  const companyProfit = realizedProfit * pct;
  const foundersProfit = realizedProfit - companyProfit;

  return {
    capital: totalCost,
    expectedProfit,
    profitRatio,
    capitalRatio,
    realizedProfit,
    recoveredCapital,
    companyProfit,
    foundersProfit,
  };
}

export function founderSplit(
  pool: number,
  recoveredCapital: number,
  contribs: Array<{ founderId?: string; founder?: string; percentage?: number }>,
  splitMode: "equal" | "weighted",
): Array<{ id: string; name: string; profit: number; capitalShare: number }> {
  const n = contribs.length || 1;
  if (splitMode === "equal") {
    return contribs.map((fc) => ({
      id: fc.founderId || fc.founder || "",
      name: fc.founder || fc.founderId || "",
      profit: pool / n,
      capitalShare: recoveredCapital / n,
    }));
  }
  const totalPct = contribs.reduce((s, fc) => s + (fc.percentage || 0), 0) || 100;
  return contribs.map((fc) => {
    const w = (fc.percentage || 0) / totalPct;
    return {
      id: fc.founderId || fc.founder || "",
      name: fc.founder || fc.founderId || "",
      profit: pool * w,
      capitalShare: recoveredCapital * w,
    };
  });
}
