export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          admin_fee: number
          allocated_net_value: number
          allocation_id: string
          amount_to_pay: number
          created_at: string
          doctor_id: string
          expected_payment_date: string | null
          id: string
          invoice_id: string
          paid_at: string | null
          proportional_deductions: number
          proportional_iss: number
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          admin_fee: number
          allocated_net_value: number
          allocation_id: string
          amount_to_pay: number
          created_at?: string
          doctor_id: string
          expected_payment_date?: string | null
          id?: string
          invoice_id: string
          paid_at?: string | null
          proportional_deductions?: number
          proportional_iss?: number
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_fee?: number
          allocated_net_value?: number
          allocation_id?: string
          amount_to_pay?: number
          created_at?: string
          doctor_id?: string
          expected_payment_date?: string | null
          id?: string
          invoice_id?: string
          paid_at?: string | null
          proportional_deductions?: number
          proportional_iss?: number
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "invoice_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string
          record_label: string | null
          table_name: string
          tenant_id: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          record_label?: string | null
          table_name: string
          tenant_id?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          record_label?: string | null
          table_name?: string
          tenant_id?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_imports: {
        Row: {
          bank_id: string
          created_at: string | null
          file_hash: string
          file_name: string
          id: string
          imported_at: string | null
          imported_by: string | null
          status: string
          tenant_id: string | null
          transaction_count: number
        }
        Insert: {
          bank_id: string
          created_at?: string | null
          file_hash: string
          file_name: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          status?: string
          tenant_id?: string | null
          transaction_count?: number
        }
        Update: {
          bank_id?: string
          created_at?: string | null
          file_hash?: string
          file_name?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          status?: string
          tenant_id?: string | null
          transaction_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_imports_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          account_number: string | null
          agency: string | null
          created_at: string
          id: string
          initial_balance: number
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          created_at?: string
          id?: string
          initial_balance?: number
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          created_at?: string
          id?: string
          initial_balance?: number
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      column_preferences: {
        Row: {
          column_order: string[]
          created_at: string
          id: string
          module_name: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          visible_columns: string[]
        }
        Insert: {
          column_order?: string[]
          created_at?: string
          id?: string
          module_name: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_columns?: string[]
        }
        Update: {
          column_order?: string[]
          created_at?: string
          id?: string
          module_name?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_columns?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "column_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_sessions: {
        Row: {
          created_at: string
          doctor_id: string
          expires_at: string
          id: string
          session_token: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          expires_at: string
          id?: string
          session_token: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          expires_at?: string
          id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_sessions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          address: string | null
          aliquota: number
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          birth_date: string | null
          certificate_expires_at: string | null
          city: string | null
          cpf: string
          created_at: string
          crm: string
          id: string
          is_freelancer: boolean
          last_login_at: string | null
          linked_company: string | null
          linked_company_2: string | null
          must_change_password: boolean
          name: string
          neighborhood: string | null
          phone: string | null
          pix_key: string | null
          portal_password_hash: string | null
          state: string | null
          tenant_id: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          aliquota?: number
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          certificate_expires_at?: string | null
          city?: string | null
          cpf: string
          created_at?: string
          crm: string
          id?: string
          is_freelancer?: boolean
          last_login_at?: string | null
          linked_company?: string | null
          linked_company_2?: string | null
          must_change_password?: boolean
          name: string
          neighborhood?: string | null
          phone?: string | null
          pix_key?: string | null
          portal_password_hash?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          aliquota?: number
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          certificate_expires_at?: string | null
          city?: string | null
          cpf?: string
          created_at?: string
          crm?: string
          id?: string
          is_freelancer?: boolean
          last_login_at?: string | null
          linked_company?: string | null
          linked_company_2?: string | null
          must_change_password?: boolean
          name?: string
          neighborhood?: string | null
          phone?: string | null
          pix_key?: string | null
          portal_password_hash?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          group_id: string | null
          id: string
          name: string
          order_index: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          name: string
          order_index?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          name?: string
          order_index?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "expense_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_groups: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          order_index: number
          tenant_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          order_index?: number
          tenant_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          tenant_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          bank_id: string | null
          category_id: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          expense_date: string
          external_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          statement_import_id: string | null
          status: string
          supplier: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          category_id: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          expense_date?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          statement_import_id?: string | null
          status?: string
          supplier?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          expense_date?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          statement_import_id?: string | null
          status?: string
          supplier?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_statement_import_id_fkey"
            columns: ["statement_import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          created_at: string
          document: string | null
          id: string
          name: string
          payer_cnpj_1: string | null
          payer_cnpj_2: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          id?: string
          name: string
          payer_cnpj_1?: string | null
          payer_cnpj_2?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          payer_cnpj_1?: string | null
          payer_cnpj_2?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_transactions: {
        Row: {
          amount: number
          bank_id: string
          category_id: string | null
          created_at: string | null
          created_record_id: string | null
          created_record_type: string | null
          custom_description: string | null
          description: string
          external_id: string
          id: string
          import_id: string
          processed_at: string | null
          processed_by: string | null
          raw_type: string | null
          reconciled_with_id: string | null
          reconciled_with_type: string | null
          source: string | null
          status: string
          suggested_confidence: string | null
          suggested_match_id: string | null
          suggested_match_type: string | null
          tenant_id: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          bank_id: string
          category_id?: string | null
          created_at?: string | null
          created_record_id?: string | null
          created_record_type?: string | null
          custom_description?: string | null
          description: string
          external_id: string
          id?: string
          import_id: string
          processed_at?: string | null
          processed_by?: string | null
          raw_type?: string | null
          reconciled_with_id?: string | null
          reconciled_with_type?: string | null
          source?: string | null
          status?: string
          suggested_confidence?: string | null
          suggested_match_id?: string | null
          suggested_match_type?: string | null
          tenant_id?: string | null
          transaction_date: string
          transaction_type: string
        }
        Update: {
          amount?: number
          bank_id?: string
          category_id?: string | null
          created_at?: string | null
          created_record_id?: string | null
          created_record_type?: string | null
          custom_description?: string | null
          description?: string
          external_id?: string
          id?: string
          import_id?: string
          processed_at?: string | null
          processed_by?: string | null
          raw_type?: string | null
          reconciled_with_id?: string | null
          reconciled_with_type?: string | null
          source?: string | null
          status?: string
          suggested_confidence?: string | null
          suggested_match_id?: string | null
          suggested_match_type?: string | null
          tenant_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_transactions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_allocations: {
        Row: {
          admin_fee: number
          allocated_net_value: number
          amount_to_pay: number
          created_at: string
          doctor_id: string
          id: string
          invoice_id: string
          proportional_deductions: number
          proportional_iss: number
          tenant_id: string | null
        }
        Insert: {
          admin_fee: number
          allocated_net_value: number
          amount_to_pay: number
          created_at?: string
          doctor_id: string
          id?: string
          invoice_id: string
          proportional_deductions?: number
          proportional_iss?: number
          tenant_id?: string | null
        }
        Update: {
          admin_fee?: number
          allocated_net_value?: number
          amount_to_pay?: number
          created_at?: string
          doctor_id?: string
          id?: string
          invoice_id?: string
          proportional_deductions?: number
          proportional_iss?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_allocations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_receipts: {
        Row: {
          adjustment_amount: number | null
          adjustment_reason: string | null
          amount: number
          bank_id: string
          created_at: string | null
          created_by: string | null
          id: string
          imported_transaction_id: string | null
          invoice_id: string
          notes: string | null
          receipt_date: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          amount: number
          bank_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          imported_transaction_id?: string | null
          invoice_id: string
          notes?: string | null
          receipt_date: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          amount?: number
          bank_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          imported_transaction_id?: string | null
          invoice_id?: string
          notes?: string | null
          receipt_date?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_receipts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_receipts_imported_transaction_id_fkey"
            columns: ["imported_transaction_id"]
            isOneToOne: false
            referencedRelation: "imported_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bank_id: string | null
          cofins_value: number
          company_name: string
          created_at: string
          created_by: string | null
          csll_value: number
          expected_receipt_date: string
          gross_value: number
          hospital_id: string | null
          hospital_name: string
          id: string
          inss_value: number
          invoice_number: string
          invoice_type: string
          irrf_value: number
          is_iss_retained: boolean | null
          iss_percentage: number
          iss_value: number
          issue_date: string
          issuer_id: string | null
          net_value: number
          pdf_hash: string | null
          pdf_url: string | null
          pis_value: number
          receipt_date: string | null
          status: Database["public"]["Enums"]["receipt_status"]
          tenant_id: string | null
          total_deductions: number
          total_received: number | null
          updated_at: string
        }
        Insert: {
          bank_id?: string | null
          cofins_value?: number
          company_name: string
          created_at?: string
          created_by?: string | null
          csll_value?: number
          expected_receipt_date: string
          gross_value: number
          hospital_id?: string | null
          hospital_name: string
          id?: string
          inss_value?: number
          invoice_number: string
          invoice_type?: string
          irrf_value?: number
          is_iss_retained?: boolean | null
          iss_percentage?: number
          iss_value?: number
          issue_date: string
          issuer_id?: string | null
          net_value: number
          pdf_hash?: string | null
          pdf_url?: string | null
          pis_value?: number
          receipt_date?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          tenant_id?: string | null
          total_deductions?: number
          total_received?: number | null
          updated_at?: string
        }
        Update: {
          bank_id?: string | null
          cofins_value?: number
          company_name?: string
          created_at?: string
          created_by?: string | null
          csll_value?: number
          expected_receipt_date?: string
          gross_value?: number
          hospital_id?: string | null
          hospital_name?: string
          id?: string
          inss_value?: number
          invoice_number?: string
          invoice_type?: string
          irrf_value?: number
          is_iss_retained?: boolean | null
          iss_percentage?: number
          iss_value?: number
          issue_date?: string
          issuer_id?: string | null
          net_value?: number
          pdf_hash?: string | null
          pdf_url?: string | null
          pis_value?: number
          receipt_date?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          tenant_id?: string | null
          total_deductions?: number
          total_received?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "issuers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      issuers: {
        Row: {
          active: boolean
          city: string
          cnpj: string
          created_at: string
          id: string
          iss_rate: number
          name: string
          state: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city: string
          cnpj: string
          created_at?: string
          id?: string
          iss_rate?: number
          name: string
          state: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          cnpj?: string
          created_at?: string
          id?: string
          iss_rate?: number
          name?: string
          state?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issuers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          can_create: boolean
          can_customize: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string
          id: string
          module_name: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_customize?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          id?: string
          module_name: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_customize?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          id?: string
          module_name?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_payable_id: string
          amount: number
          bank_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          account_payable_id: string
          amount: number
          bank_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          account_payable_id?: string
          amount?: number
          bank_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_payable_id_fkey"
            columns: ["account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_tenant_id: string | null
          created_at: string
          full_name: string
          id: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_tenant_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_tenant_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_payment_adjustments: {
        Row: {
          account_payable_id: string | null
          adjustment_amount: number
          adjustment_date: string
          adjustment_type: string
          bank_id: string | null
          created_at: string | null
          created_by: string | null
          expected_amount: number
          id: string
          imported_transaction_id: string | null
          invoice_id: string | null
          notes: string | null
          reason: string | null
          received_amount: number
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_payable_id?: string | null
          adjustment_amount: number
          adjustment_date?: string
          adjustment_type: string
          bank_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_amount: number
          id?: string
          imported_transaction_id?: string | null
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          received_amount: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_payable_id?: string | null
          adjustment_amount?: number
          adjustment_date?: string
          adjustment_type?: string
          bank_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_amount?: number
          id?: string
          imported_transaction_id?: string | null
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          received_amount?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_payment_adjustments_account_payable_id_fkey"
            columns: ["account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_payment_adjustments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_payment_adjustments_imported_transaction_id_fkey"
            columns: ["imported_transaction_id"]
            isOneToOne: false
            referencedRelation: "imported_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_payment_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_payment_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_categories: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          group_id: string | null
          id: string
          name: string
          order_index: number
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          name: string
          order_index?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          name?: string
          order_index?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "revenue_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_groups: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          order_index: number
          tenant_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          order_index?: number
          tenant_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          tenant_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      revenues: {
        Row: {
          amount: number
          bank_id: string
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          external_id: string | null
          id: string
          notes: string | null
          revenue_date: string
          source: string | null
          statement_import_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_id: string
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          external_id?: string | null
          id?: string
          notes?: string | null
          revenue_date?: string
          source?: string | null
          statement_import_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_id?: string
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          revenue_date?: string
          source?: string | null
          statement_import_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenues_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "revenue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_statement_import_id_fkey"
            columns: ["statement_import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sieg_sync_logs: {
        Row: {
          created_at: string | null
          created_by: string | null
          error_details: Json | null
          error_message: string | null
          filter_cnpj_emit: string | null
          filter_date_end: string | null
          filter_date_start: string | null
          id: string
          status: string
          sync_completed_at: string | null
          sync_started_at: string
          tenant_id: string
          total_xmls_found: number | null
          xmls_failed: number | null
          xmls_imported: number | null
          xmls_skipped: number | null
          xmls_updated: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          error_details?: Json | null
          error_message?: string | null
          filter_cnpj_emit?: string | null
          filter_date_end?: string | null
          filter_date_start?: string | null
          id?: string
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
          tenant_id: string
          total_xmls_found?: number | null
          xmls_failed?: number | null
          xmls_imported?: number | null
          xmls_skipped?: number | null
          xmls_updated?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          error_details?: Json | null
          error_message?: string | null
          filter_cnpj_emit?: string | null
          filter_date_end?: string | null
          filter_date_start?: string | null
          id?: string
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
          tenant_id?: string
          total_xmls_found?: number | null
          xmls_failed?: number | null
          xmls_imported?: number | null
          xmls_skipped?: number | null
          xmls_updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sieg_sync_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          tenant_id: string | null
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          tenant_id?: string | null
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          tenant_id?: string | null
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_impersonation_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          super_admin_id: string
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          super_admin_id: string
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          super_admin_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_impersonation_logs_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "super_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_impersonation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          document: string | null
          email: string
          id: string
          max_users: number
          name: string
          phone: string | null
          plan: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email: string
          id?: string
          max_users?: number
          name: string
          phone?: string | null
          plan?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string
          id?: string
          max_users?: number
          name?: string
          phone?: string | null
          plan?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_accessible_tenants: {
        Args: { _user_id: string }
        Returns: {
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operador" | "financeiro"
      payment_status:
        | "aguardando_recebimento"
        | "pendente"
        | "pago"
        | "cancelado"
        | "parcialmente_pago"
      receipt_status: "pendente" | "recebido" | "parcialmente_recebido"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operador", "financeiro"],
      payment_status: [
        "aguardando_recebimento",
        "pendente",
        "pago",
        "cancelado",
        "parcialmente_pago",
      ],
      receipt_status: ["pendente", "recebido", "parcialmente_recebido"],
    },
  },
} as const
