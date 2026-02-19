import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";

interface MonthlyExpenseData {
  categoryId: string;
  categoryName: string;
  groupId: string | null;
  groupName: string;
  amounts: number[];
}

interface MonthlyData {
  revenues: number[];
  taxes: number[];
  medicalPayments: number[];
  expenses: MonthlyExpenseData[];
}

interface GroupedExpenses {
  groupId: string;
  groupName: string;
  type: string;
  orderIndex: number;
  categories: {
    id: string;
    name: string;
    amounts: number[];
  }[];
  totals: number[];
}

export function useAccumulatedCashFlow(year: number) {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthlyData>({
    revenues: Array(12).fill(0),
    taxes: Array(12).fill(0),
    medicalPayments: Array(12).fill(0),
    expenses: [],
  });
  const [groups, setGroups] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [year, tenantId]);

  async function loadData() {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Load all data in parallel
      const [
        accountsPayableResult,
        invoicesResult,
        expensesResult,
        groupsResult,
        categoriesResult,
      ] = await Promise.all([
        // Accounts payable (allocated amounts and doctor payables)
        supabase
          .from("accounts_payable")
          .select("allocated_net_value, amount_to_pay, created_at")
          .eq("tenant_id", tenantId)
          .gte("created_at", `${year}-01-01`)
          .lte("created_at", `${year}-12-31T23:59:59`),
        // All invoices for taxes (based on issue_date)
        supabase
          .from("invoices")
          .select("iss_value, irrf_value, inss_value, csll_value, pis_value, cofins_value, issue_date")
          .eq("tenant_id", tenantId)
          .gte("issue_date", startDate)
          .lte("issue_date", endDate),
        // Expenses
        supabase
          .from("expenses")
          .select("amount, expense_date, category_id")
          .eq("tenant_id", tenantId)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate),
        // Groups
        supabase
          .from("expense_groups")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("order_index"),
        // Categories
        supabase
          .from("expense_categories")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("order_index"),
      ]);

      if (accountsPayableResult.error) throw accountsPayableResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (groupsResult.error) throw groupsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setGroups(groupsResult.data || []);
      setCategories(categoriesResult.data || []);

      // Process issued notes (allocated_net_value) and medical payables (amount_to_pay)
      const revenues = Array(12).fill(0);
      const medicalPayments = Array(12).fill(0);

      (accountsPayableResult.data || []).forEach((ap) => {
        if (ap.created_at) {
          const month = new Date(ap.created_at).getMonth();
          revenues[month] += Number(ap.allocated_net_value) || 0;
          medicalPayments[month] += Number(ap.amount_to_pay) || 0;
        }
      });

      // Process taxes from all invoices (based on issue_date)
      const taxes = Array(12).fill(0);
      (invoicesResult.data || []).forEach((inv) => {
        if (inv.issue_date) {
          const month = new Date(inv.issue_date).getMonth();
          taxes[month] += (
            (Number(inv.iss_value) || 0) +
            (Number(inv.irrf_value) || 0) +
            (Number(inv.inss_value) || 0) +
            (Number(inv.csll_value) || 0) +
            (Number(inv.pis_value) || 0) +
            (Number(inv.cofins_value) || 0)
          );
        }
      });

      // Process expenses by category
      const expensesByCategory: Record<string, number[]> = {};
      (expensesResult.data || []).forEach((exp) => {
        if (exp.expense_date && exp.category_id) {
          const month = new Date(exp.expense_date).getMonth();
          if (!expensesByCategory[exp.category_id]) {
            expensesByCategory[exp.category_id] = Array(12).fill(0);
          }
          expensesByCategory[exp.category_id][month] += Number(exp.amount) || 0;
        }
      });

      // Build expenses data with group info
      const expenses: MonthlyExpenseData[] = Object.entries(expensesByCategory).map(([catId, amounts]) => {
        const category = categoriesResult.data?.find(c => c.id === catId);
        const group = category?.group_id 
          ? groupsResult.data?.find(g => g.id === category.group_id)
          : null;
        
        return {
          categoryId: catId,
          categoryName: category?.name || "Sem categoria",
          groupId: category?.group_id || null,
          groupName: group?.name || "Outras Despesas",
          amounts,
        };
      });

      setData({
        revenues,
        taxes,
        medicalPayments,
        expenses,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Group expenses by their groups
  const groupedExpenses = useMemo<GroupedExpenses[]>(() => {
    const grouped: Record<string, GroupedExpenses> = {};

    // Initialize groups
    groups.forEach(g => {
      grouped[g.id] = {
        groupId: g.id,
        groupName: g.name,
        type: g.type,
        orderIndex: g.order_index,
        categories: [],
        totals: Array(12).fill(0),
      };
    });

    // Add "other" group for ungrouped
    grouped["other"] = {
      groupId: "other",
      groupName: "Outras Despesas",
      type: "expense",
      orderIndex: 999,
      categories: [],
      totals: Array(12).fill(0),
    };

    // Add expenses to groups
    data.expenses.forEach(exp => {
      const groupKey = exp.groupId || "other";
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          groupId: groupKey,
          groupName: exp.groupName,
          type: "expense",
          orderIndex: 999,
          categories: [],
          totals: Array(12).fill(0),
        };
      }

      grouped[groupKey].categories.push({
        id: exp.categoryId,
        name: exp.categoryName,
        amounts: exp.amounts,
      });

      // Add to totals
      exp.amounts.forEach((amount, idx) => {
        grouped[groupKey].totals[idx] += amount;
      });
    });

    // Sort and filter empty groups
    return Object.values(grouped)
      .filter(g => g.categories.length > 0)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [data.expenses, groups]);

  // Calculate derived values
  const calculated = useMemo(() => {
    const netRevenue = data.revenues.map((rev, idx) => 
      rev - data.taxes[idx] - data.medicalPayments[idx]
    );

    const totalExpensesByMonth = Array(12).fill(0);
    groupedExpenses.forEach(g => {
      g.totals.forEach((total, idx) => {
        totalExpensesByMonth[idx] += total;
      });
    });

    const grossProfit = netRevenue.map((net, idx) => 
      net - totalExpensesByMonth[idx]
    );

    return {
      netRevenue,
      totalExpenses: totalExpensesByMonth,
      grossProfit,
      netProfit: grossProfit, // For now, same as gross profit
    };
  }, [data, groupedExpenses]);

  const totals = useMemo(() => ({
    revenues: data.revenues.reduce((a, b) => a + b, 0),
    taxes: data.taxes.reduce((a, b) => a + b, 0),
    medicalPayments: data.medicalPayments.reduce((a, b) => a + b, 0),
    netRevenue: calculated.netRevenue.reduce((a, b) => a + b, 0),
    totalExpenses: calculated.totalExpenses.reduce((a, b) => a + b, 0),
    grossProfit: calculated.grossProfit.reduce((a, b) => a + b, 0),
    netProfit: calculated.netProfit.reduce((a, b) => a + b, 0),
  }), [data, calculated]);

  return {
    loading,
    data,
    groupedExpenses,
    calculated,
    totals,
    refresh: loadData,
  };
}
