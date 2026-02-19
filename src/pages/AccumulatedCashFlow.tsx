import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useAccumulatedCashFlow } from "@/hooks/useAccumulatedCashFlow";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(value: number): string {
  if (value === 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AccumulatedCashFlow() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const { loading, data, groupedExpenses, calculated, totals } = useAccumulatedCashFlow(year);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Fluxo Acumulado</h1>
              <p className="text-sm text-muted-foreground">
                Demonstrativo financeiro anual
              </p>
            </div>
          </div>

          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Demonstrativo {year}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 z-10 min-w-[200px] bg-muted/50 px-4 py-3 text-left font-semibold">
                      Descrição
                    </th>
                    {MONTHS.map((month) => (
                      <th key={month} className="min-w-[90px] px-2 py-3 text-right font-semibold">
                        {month}
                      </th>
                    ))}
                    <th className="min-w-[100px] px-4 py-3 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* NOTAS EMITIDAS */}
                  <tr className="border-b bg-success/10 font-semibold">
                    <td className="sticky left-0 z-10 bg-success/10 px-4 py-2">NOTAS EMITIDAS</td>
                    {data.revenues.map((val, idx) => (
                      <td key={idx} className="px-2 py-2 text-right text-success">
                        {formatCurrency(val)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-bold text-success">
                      {formatCurrency(totals.revenues)}
                    </td>
                  </tr>

                  {/* (-) Impostos retidos */}
                  <tr className="border-b">
                    <td className="sticky left-0 z-10 bg-background px-4 py-2 pl-8 text-muted-foreground">
                      (-) Impostos retidos
                    </td>
                    {data.taxes.map((val, idx) => (
                      <td key={idx} className="px-2 py-2 text-right text-destructive">
                        {val > 0 ? `-${formatCurrency(val).replace("R$", "R$ ")}` : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right text-destructive">
                      {totals.taxes > 0 ? `-${formatCurrency(totals.taxes).replace("R$", "R$ ")}` : "—"}
                    </td>
                  </tr>

                  {/* (-) Médicos */}
                  <tr className="border-b">
                    <td className="sticky left-0 z-10 bg-background px-4 py-2 pl-8 text-muted-foreground">
                      (-) Médicos
                    </td>
                    {data.medicalPayments.map((val, idx) => (
                      <td key={idx} className="px-2 py-2 text-right text-destructive">
                        {val > 0 ? `-${formatCurrency(val).replace("R$", "R$ ")}` : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right text-destructive">
                      {totals.medicalPayments > 0 ? `-${formatCurrency(totals.medicalPayments).replace("R$", "R$ ")}` : "—"}
                    </td>
                  </tr>

                  {/* Receita Líquida */}
                  <tr className="border-b bg-muted/30 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2">Receita Líquida</td>
                    {calculated.netRevenue.map((val, idx) => (
                      <td key={idx} className="px-2 py-2 text-right">
                        {formatCurrency(val)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-bold">
                      {formatCurrency(totals.netRevenue)}
                    </td>
                  </tr>

                  {/* Separator */}
                  <tr className="h-2 bg-muted/20" />

                  {/* EXPENSE GROUPS */}
                  {groupedExpenses.map((group) => (
                    <>
                      {/* Group Header */}
                      <tr 
                        key={group.groupId}
                        className="border-b bg-warning/10 cursor-pointer hover:bg-warning/20"
                        onClick={() => toggleGroup(group.groupId)}
                      >
                        <td className="sticky left-0 z-10 bg-warning/10 px-4 py-2 font-semibold">
                          <span className="flex items-center gap-2">
                            {expandedGroups[group.groupId] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {group.groupName.toUpperCase()}
                          </span>
                        </td>
                        {group.totals.map((val, idx) => (
                          <td key={idx} className="px-2 py-2 text-right font-medium text-destructive">
                            {val > 0 ? `-${formatCurrency(val).replace("R$", "R$ ")}` : "—"}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-bold text-destructive">
                          {group.totals.reduce((a, b) => a + b, 0) > 0 
                            ? `-${formatCurrency(group.totals.reduce((a, b) => a + b, 0)).replace("R$", "R$ ")}` 
                            : "—"}
                        </td>
                      </tr>

                      {/* Group Categories (expandable) */}
                      {expandedGroups[group.groupId] && group.categories.map((cat) => (
                        <tr key={cat.id} className="border-b bg-background/50">
                          <td className="sticky left-0 z-10 bg-background/50 px-4 py-1.5 pl-10 text-sm text-muted-foreground">
                            {cat.name}
                          </td>
                          {cat.amounts.map((val, idx) => (
                            <td key={idx} className="px-2 py-1.5 text-right text-sm text-muted-foreground">
                              {val > 0 ? `-${formatCurrency(val).replace("R$", "R$ ")}` : "—"}
                            </td>
                          ))}
                          <td className="px-4 py-1.5 text-right text-sm text-muted-foreground">
                            {cat.amounts.reduce((a, b) => a + b, 0) > 0 
                              ? `-${formatCurrency(cat.amounts.reduce((a, b) => a + b, 0)).replace("R$", "R$ ")}` 
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}

                  {/* Separator */}
                  <tr className="h-2 bg-muted/20" />

                  {/* LUCRO BRUTO */}
                  <tr className="border-b bg-primary/10 font-bold">
                    <td className="sticky left-0 z-10 bg-primary/10 px-4 py-2">LUCRO BRUTO</td>
                    {calculated.grossProfit.map((val, idx) => (
                      <td 
                        key={idx} 
                        className={cn(
                          "px-2 py-2 text-right",
                          val >= 0 ? "text-success" : "text-destructive"
                        )}
                      >
                        {formatCurrency(val)}
                      </td>
                    ))}
                    <td className={cn(
                      "px-4 py-2 text-right font-bold",
                      totals.grossProfit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(totals.grossProfit)}
                    </td>
                  </tr>

                  {/* LUCRO LÍQUIDO */}
                  <tr className="bg-primary/20 font-bold">
                    <td className="sticky left-0 z-10 bg-primary/20 px-4 py-3">LUCRO LÍQUIDO</td>
                    {calculated.netProfit.map((val, idx) => (
                      <td 
                        key={idx} 
                        className={cn(
                          "px-2 py-3 text-right text-base",
                          val >= 0 ? "text-success" : "text-destructive"
                        )}
                      >
                        {formatCurrency(val)}
                      </td>
                    ))}
                    <td className={cn(
                      "px-4 py-3 text-right text-base font-bold",
                      totals.netProfit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(totals.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
