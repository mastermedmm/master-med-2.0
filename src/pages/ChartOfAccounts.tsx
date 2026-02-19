import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderTree, Tags, TrendingDown, TrendingUp } from "lucide-react";
import { GroupsTab, type ExpenseGroup } from "@/components/chart-of-accounts/GroupsTab";
import { AccountsTab } from "@/components/chart-of-accounts/AccountsTab";
import { RevenueGroupsTab, type RevenueGroup } from "@/components/chart-of-accounts/RevenueGroupsTab";
import { RevenueCategoriesTab, type RevenueCategory } from "@/components/chart-of-accounts/RevenueCategoriesTab";
import { ImportExportButtons } from "@/components/chart-of-accounts/ImportExportButtons";

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  group_id: string | null;
  order_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ChartOfAccounts() {
  const { tenantId } = useTenant();
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [revenueGroups, setRevenueGroups] = useState<RevenueGroup[]>([]);
  const [revenueCategories, setRevenueCategories] = useState<RevenueCategory[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingRevenueGroups, setLoadingRevenueGroups] = useState(true);
  const [loadingRevenueCategories, setLoadingRevenueCategories] = useState(true);
  const [activeSection, setActiveSection] = useState<"expenses" | "revenues">("expenses");
  const { toast } = useToast();

  useEffect(() => {
    if (tenantId) {
      loadGroups();
      loadCategories();
      loadRevenueGroups();
      loadRevenueCategories();
    }
  }, [tenantId]);

  async function loadGroups() {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from("expense_groups")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("order_index");

      if (error) throw error;
      setGroups(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar grupos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingGroups(false);
    }
  }

  async function loadCategories() {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("order_index");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar contas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingCategories(false);
    }
  }

  async function loadRevenueGroups() {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from("revenue_groups")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("order_index");

      if (error) throw error;
      setRevenueGroups(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar grupos de receitas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingRevenueGroups(false);
    }
  }

  async function loadRevenueCategories() {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from("revenue_categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("order_index");

      if (error) throw error;
      setRevenueCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar categorias de receitas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingRevenueCategories(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FolderTree className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Plano de Contas</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie grupos e contas para classificar despesas e receitas
              </p>
            </div>
          </div>
          {activeSection === "expenses" && (
            <ImportExportButtons
              groups={groups}
              categories={categories}
              onRefresh={() => {
                loadGroups();
                loadCategories();
              }}
            />
          )}
        </div>

        {/* Main Section Tabs */}
        <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as "expenses" | "revenues")} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="expenses" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              Despesas
            </TabsTrigger>
            <TabsTrigger value="revenues" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Receitas
            </TabsTrigger>
          </TabsList>

          {/* Expenses Section */}
          <TabsContent value="expenses" className="mt-6">
            <Tabs defaultValue="groups" className="w-full">
              <TabsList>
                <TabsTrigger value="groups" className="gap-2">
                  <FolderTree className="h-4 w-4" />
                  Grupos
                </TabsTrigger>
                <TabsTrigger value="accounts" className="gap-2">
                  <Tags className="h-4 w-4" />
                  Contas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="groups" className="mt-6">
                <GroupsTab 
                  groups={groups} 
                  loading={loadingGroups} 
                  onRefresh={loadGroups} 
                />
              </TabsContent>

              <TabsContent value="accounts" className="mt-6">
                <AccountsTab 
                  categories={categories} 
                  groups={groups}
                  loading={loadingCategories} 
                  onRefresh={loadCategories} 
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Revenues Section */}
          <TabsContent value="revenues" className="mt-6">
            <Tabs defaultValue="groups" className="w-full">
              <TabsList>
                <TabsTrigger value="groups" className="gap-2">
                  <FolderTree className="h-4 w-4" />
                  Grupos
                </TabsTrigger>
                <TabsTrigger value="categories" className="gap-2">
                  <Tags className="h-4 w-4" />
                  Categorias
                </TabsTrigger>
              </TabsList>

              <TabsContent value="groups" className="mt-6">
                <RevenueGroupsTab 
                  groups={revenueGroups} 
                  loading={loadingRevenueGroups} 
                  onRefresh={loadRevenueGroups} 
                />
              </TabsContent>

              <TabsContent value="categories" className="mt-6">
                <RevenueCategoriesTab 
                  categories={revenueCategories} 
                  groups={revenueGroups}
                  loading={loadingRevenueCategories} 
                  onRefresh={loadRevenueCategories} 
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
