import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export type BusinessRules = {
  id: string;
  companyProfitPercentage: number;
  defaultSplitMode: "equal" | "contribution";
  defaultDeliveryFee: number;
  subscriptionType: "none" | "fixed" | "percentage";
  subscriptionValue: number;
  defaultLeadTimeWeeks: number;
  defaultCoverageWeeks: number;
  defaultSafetyStock: number;
  lowStockAlertEnabled: boolean;
  expiryAlertDays: number;
  auditReminderEnabled: boolean;
  auditReminderDays: number;
};

export const DEFAULT_RULES: BusinessRules = {
  id: "default",
  companyProfitPercentage: 15,
  defaultSplitMode: "equal",
  defaultDeliveryFee: 50,
  subscriptionType: "none",
  subscriptionValue: 0,
  defaultLeadTimeWeeks: 2,
  defaultCoverageWeeks: 4,
  defaultSafetyStock: 5,
  lowStockAlertEnabled: true,
  expiryAlertDays: 14,
  auditReminderEnabled: true,
  auditReminderDays: 7,
};

let cachedRules: BusinessRules | null = null;
const listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export async function loadBusinessRules(): Promise<BusinessRules> {
  try {
    const data = await api.get<BusinessRules>("/business-rules");
    cachedRules = { ...DEFAULT_RULES, ...data };
    notifyListeners();
    return cachedRules;
  } catch {
    return DEFAULT_RULES;
  }
}

export async function saveBusinessRules(rules: Partial<BusinessRules>): Promise<BusinessRules> {
  const updated = await api.put<BusinessRules>("/business-rules", rules);
  cachedRules = { ...DEFAULT_RULES, ...updated };
  notifyListeners();
  return cachedRules;
}

export function useBusinessRules() {
  const [rules, setRules] = useState<BusinessRules>(cachedRules ?? DEFAULT_RULES);
  const [loading, setLoading] = useState(!cachedRules);

  const refresh = useCallback(() => {
    if (cachedRules) setRules(cachedRules);
  }, []);

  useEffect(() => {
    listeners.push(refresh);
    if (!cachedRules) {
      loadBusinessRules().then((r) => {
        setRules(r);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => {
      const idx = listeners.indexOf(refresh);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, [refresh]);

  return { rules, loading };
}

export function getCompanyShareRatio(rules: BusinessRules): number {
  return (rules.companyProfitPercentage ?? 15) / 100;
}

export function getFounderShareRatio(rules: BusinessRules): number {
  return 1 - getCompanyShareRatio(rules);
}

export function calcOrderTotal(sellingTotal: number, rules: BusinessRules): { net: number; subscription: number } {
  if (rules.subscriptionType === "none" || !rules.subscriptionValue) {
    return { net: sellingTotal, subscription: 0 };
  }
  const sub = rules.subscriptionType === "fixed"
    ? rules.subscriptionValue
    : Math.round(sellingTotal * rules.subscriptionValue / 100);
  return { net: sellingTotal - sub, subscription: sub };
}
