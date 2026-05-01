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
      accounting_activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          store_id: string | null
          user_id: string
          user_name: string
          user_role: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          store_id?: string | null
          user_id: string
          user_name: string
          user_role: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          store_id?: string | null
          user_id?: string
          user_name?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_activity_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_transactions: {
        Row: {
          amount: number
          cancel_reason: string | null
          converted_to: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          payment_method: string | null
          source_bid: string
          source_date: string
          source_id: string
          source_label: string
          source_type: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          cancel_reason?: string | null
          converted_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          payment_method?: string | null
          source_bid: string
          source_date: string
          source_id: string
          source_label: string
          source_type: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          converted_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          source_bid?: string
          source_date?: string
          source_id?: string
          source_label?: string
          source_type?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable: {
        Row: {
          amount: number
          cashflow_category: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          paid_amount: number
          status: string
          store_id: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          amount: number
          cashflow_category?: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_amount?: number
          status?: string
          store_id: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cashflow_category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_amount?: number
          status?: string
          store_id?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          customer_name: string
          description: string | null
          due_date: string | null
          id: string
          received_amount: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          customer_name: string
          description?: string | null
          due_date?: string | null
          id?: string
          received_amount?: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          customer_name?: string
          description?: string | null
          due_date?: string | null
          id?: string
          received_amount?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          store_id: string | null
          user_id: string
          user_name: string
          user_role: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          store_id?: string | null
          user_id: string
          user_name: string
          user_role: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          store_id?: string | null
          user_id?: string
          user_name?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          bid: string | null
          category: string | null
          created_at: string
          created_by: string
          current_value: number
          depreciation_rate: number | null
          id: string
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          bid?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          current_value?: number
          depreciation_rate?: number | null
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          bid?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          current_value?: number
          depreciation_rate?: number | null
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          balance: number
          bank_name: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          notes: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          balance?: number
          bank_name: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          notes?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          balance?: number
          bank_name?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_products: {
        Row: {
          booking_id: string
          created_at: string
          dpp_amount: number
          id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
          tax_amount: number
          tax_enabled: boolean
          tax_mode: string
          tax_rate: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          dpp_amount?: number
          id?: string
          product_id: string
          product_name: string
          product_price: number
          quantity?: number
          subtotal: number
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: string
          tax_rate?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          dpp_amount?: number
          id?: string
          product_id?: string
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_products_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          admin_notes: string | null
          bid: string | null
          booking_date: string
          category_id: string | null
          category_name: string | null
          confirmation_token: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          duration: number
          end_time: string
          expired_at: string | null
          id: string
          payment_method: string
          payment_proof_url: string | null
          payment_step_started_at: string | null
          processed_at: string | null
          processed_by: string | null
          room_id: string | null
          room_name: string
          room_price: number
          start_time: string
          status: string
          store_id: string
          total_price: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          bid?: string | null
          booking_date: string
          category_id?: string | null
          category_name?: string | null
          confirmation_token?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          duration: number
          end_time: string
          expired_at?: string | null
          id?: string
          payment_method: string
          payment_proof_url?: string | null
          payment_step_started_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          room_id?: string | null
          room_name: string
          room_price: number
          start_time: string
          status?: string
          store_id: string
          total_price: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          bid?: string | null
          booking_date?: string
          category_id?: string | null
          category_name?: string | null
          confirmation_token?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          duration?: number
          end_time?: string
          expired_at?: string | null
          id?: string
          payment_method?: string
          payment_proof_url?: string | null
          payment_step_started_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          room_id?: string | null
          room_name?: string
          room_price?: number
          start_time?: string
          status?: string
          store_id?: string
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "room_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          bid: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          customer_name: string
          date: string
          discount_applies_to: string | null
          discount_type: string | null
          discount_value: number | null
          dpp_amount: number
          dual_payment: boolean | null
          duration: number
          end_time: string
          id: string
          note: string | null
          ota_booking_id: string | null
          ota_source: string | null
          payment_method: string | null
          payment_method_2: string | null
          payment_proof_url: string | null
          payment_proof_url_2: string | null
          payment_status: string
          phone: string
          price: number
          price_2: number | null
          reference_no: string
          reference_no_2: string | null
          room_id: string
          start_time: string
          status: string | null
          store_id: string | null
          tax_amount: number
          tax_enabled: boolean
          tax_mode: string
          tax_rate: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          bid?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          customer_name: string
          date: string
          discount_applies_to?: string | null
          discount_type?: string | null
          discount_value?: number | null
          dpp_amount?: number
          dual_payment?: boolean | null
          duration: number
          end_time: string
          id?: string
          note?: string | null
          ota_booking_id?: string | null
          ota_source?: string | null
          payment_method?: string | null
          payment_method_2?: string | null
          payment_proof_url?: string | null
          payment_proof_url_2?: string | null
          payment_status?: string
          phone: string
          price: number
          price_2?: number | null
          reference_no: string
          reference_no_2?: string | null
          room_id: string
          start_time: string
          status?: string | null
          store_id?: string | null
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: string
          tax_rate?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          bid?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string
          date?: string
          discount_applies_to?: string | null
          discount_type?: string | null
          discount_value?: number | null
          dpp_amount?: number
          dual_payment?: boolean | null
          duration?: number
          end_time?: string
          id?: string
          note?: string | null
          ota_booking_id?: string | null
          ota_source?: string | null
          payment_method?: string | null
          payment_method_2?: string | null
          payment_proof_url?: string | null
          payment_proof_url_2?: string | null
          payment_status?: string
          phone?: string
          price?: number
          price_2?: number | null
          reference_no?: string
          reference_no_2?: string | null
          room_id?: string
          start_time?: string
          status?: string | null
          store_id?: string | null
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: string
          tax_rate?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          classification: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          is_cash_account: boolean
          opening_balance: number
          opening_balance_date: string | null
          parent_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          classification: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          is_cash_account?: boolean
          opening_balance?: number
          opening_balance_date?: string | null
          parent_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          classification?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          is_cash_account?: boolean
          opening_balance?: number
          opening_balance_date?: string | null
          parent_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birth_date: string | null
          created_at: string
          created_by: string
          domicile: string | null
          email: string | null
          id: string
          identity_document_url: string | null
          identity_number: string | null
          identity_type: string | null
          name: string
          notes: string | null
          phone: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_by: string
          domicile?: string | null
          email?: string | null
          id?: string
          identity_document_url?: string | null
          identity_number?: string | null
          identity_type?: string | null
          name: string
          notes?: string | null
          phone: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_by?: string
          domicile?: string | null
          email?: string | null
          id?: string
          identity_document_url?: string | null
          identity_number?: string | null
          identity_type?: string | null
          name?: string
          notes?: string | null
          phone?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          hotel_name: string
          id: string
          room_count: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          hotel_name?: string
          id?: string
          room_count: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          hotel_name?: string
          id?: string
          room_count?: string
          whatsapp?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          bid: string | null
          category: string | null
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          payment_method: string | null
          payment_proof_url: string | null
          process_status: string
          receipt_url: string | null
          reference_no: string | null
          status: string
          store_id: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          amount: number
          bid?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          date: string
          description: string
          id?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          process_status?: string
          receipt_url?: string | null
          reference_no?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          amount?: number
          bid?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          process_status?: string
          receipt_url?: string | null
          reference_no?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      income_products: {
        Row: {
          created_at: string
          dpp_amount: number
          id: string
          income_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
          tax_amount: number
          tax_enabled: boolean
          tax_mode: string
          tax_rate: number
        }
        Insert: {
          created_at?: string
          dpp_amount?: number
          id?: string
          income_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity?: number
          subtotal: number
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: string
          tax_rate?: number
        }
        Update: {
          created_at?: string
          dpp_amount?: number
          id?: string
          income_id?: string
          product_id?: string
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "income_products_income_id_fkey"
            columns: ["income_id"]
            isOneToOne: false
            referencedRelation: "incomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number | null
          bid: string | null
          category: string | null
          created_at: string
          created_by: string
          customer_name: string | null
          date: string
          description: string | null
          dpp_amount: number
          id: string
          paid_amount: number | null
          payment_method: string | null
          payment_proof_url: string | null
          process_status: string
          reference_no: string | null
          status: string
          store_id: string | null
          tax_amount: number
          tax_enabled: boolean
          tax_mode: string
          tax_rate: number
          updated_at: string
          verification_status: string
        }
        Insert: {
          amount?: number | null
          bid?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          customer_name?: string | null
          date: string
          description?: string | null
          dpp_amount?: number
          id?: string
          paid_amount?: number | null
          payment_method?: string | null
          payment_proof_url?: string | null
          process_status?: string
          reference_no?: string | null
          status?: string
          store_id?: string | null
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: string
          tax_rate?: number
          updated_at?: string
          verification_status?: string
        }
        Update: {
          amount?: number | null
          bid?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string | null
          date?: string
          description?: string | null
          dpp_amount?: number
          id?: string
          paid_amount?: number | null
          payment_method?: string | null
          payment_proof_url?: string | null
          process_status?: string
          reference_no?: string | null
          status?: string
          store_id?: string | null
          tax_amount?: number
          tax_enabled?: boolean
          tax_mode?: string
          tax_rate?: number
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          investor_name: string
          source_account: string
          store_id: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          investor_name: string
          source_account: string
          store_id: string
          transfer_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          investor_name?: string
          source_account?: string
          store_id?: string
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_transfers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string
          description: string
          entry_date: string
          id: string
          reference_no: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          entry_date: string
          id?: string
          reference_no?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          entry_date?: string
          id?: string
          reference_no?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_settings: {
        Row: {
          benefits_items: Json | null
          benefits_tagline: string | null
          benefits_title: string | null
          btn_benefits: string | null
          btn_cta_primary: string | null
          btn_cta_secondary: string | null
          btn_hero_primary: string | null
          btn_hero_secondary: string | null
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          copyright_text: string | null
          created_at: string | null
          cta_description: string | null
          cta_title: string | null
          element_styles: Json | null
          features_description: string | null
          features_items: Json | null
          features_tagline: string | null
          features_title: string | null
          footer_contact_title: string | null
          footer_description: string | null
          footer_menu_title: string | null
          gallery_description: string | null
          gallery_items: Json | null
          gallery_tagline: string | null
          gallery_title: string | null
          hero_description: string | null
          hero_image_url: string | null
          hero_tagline: string | null
          hero_title: string | null
          id: string
          navbar_brand: string | null
          navbar_btn_login: string | null
          navbar_menu_benefits: string | null
          navbar_menu_contact: string | null
          navbar_menu_features: string | null
          navbar_menu_gallery: string | null
          navbar_menu_pricing: string | null
          partner_logos: Json | null
          partners_tagline: string | null
          partners_title: string | null
          pricing_description: string | null
          pricing_items: Json | null
          pricing_tagline: string | null
          pricing_title: string | null
          stats_properties: string | null
          stats_properties_label: string | null
          stats_support: string | null
          stats_uptime: string | null
          updated_at: string | null
        }
        Insert: {
          benefits_items?: Json | null
          benefits_tagline?: string | null
          benefits_title?: string | null
          btn_benefits?: string | null
          btn_cta_primary?: string | null
          btn_cta_secondary?: string | null
          btn_hero_primary?: string | null
          btn_hero_secondary?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          copyright_text?: string | null
          created_at?: string | null
          cta_description?: string | null
          cta_title?: string | null
          element_styles?: Json | null
          features_description?: string | null
          features_items?: Json | null
          features_tagline?: string | null
          features_title?: string | null
          footer_contact_title?: string | null
          footer_description?: string | null
          footer_menu_title?: string | null
          gallery_description?: string | null
          gallery_items?: Json | null
          gallery_tagline?: string | null
          gallery_title?: string | null
          hero_description?: string | null
          hero_image_url?: string | null
          hero_tagline?: string | null
          hero_title?: string | null
          id?: string
          navbar_brand?: string | null
          navbar_btn_login?: string | null
          navbar_menu_benefits?: string | null
          navbar_menu_contact?: string | null
          navbar_menu_features?: string | null
          navbar_menu_gallery?: string | null
          navbar_menu_pricing?: string | null
          partner_logos?: Json | null
          partners_tagline?: string | null
          partners_title?: string | null
          pricing_description?: string | null
          pricing_items?: Json | null
          pricing_tagline?: string | null
          pricing_title?: string | null
          stats_properties?: string | null
          stats_properties_label?: string | null
          stats_support?: string | null
          stats_uptime?: string | null
          updated_at?: string | null
        }
        Update: {
          benefits_items?: Json | null
          benefits_tagline?: string | null
          benefits_title?: string | null
          btn_benefits?: string | null
          btn_cta_primary?: string | null
          btn_cta_secondary?: string | null
          btn_hero_primary?: string | null
          btn_hero_secondary?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          copyright_text?: string | null
          created_at?: string | null
          cta_description?: string | null
          cta_title?: string | null
          element_styles?: Json | null
          features_description?: string | null
          features_items?: Json | null
          features_tagline?: string | null
          features_title?: string | null
          footer_contact_title?: string | null
          footer_description?: string | null
          footer_menu_title?: string | null
          gallery_description?: string | null
          gallery_items?: Json | null
          gallery_tagline?: string | null
          gallery_title?: string | null
          hero_description?: string | null
          hero_image_url?: string | null
          hero_tagline?: string | null
          hero_title?: string | null
          id?: string
          navbar_brand?: string | null
          navbar_btn_login?: string | null
          navbar_menu_benefits?: string | null
          navbar_menu_contact?: string | null
          navbar_menu_features?: string | null
          navbar_menu_gallery?: string | null
          navbar_menu_pricing?: string | null
          partner_logos?: Json | null
          partners_tagline?: string | null
          partners_title?: string | null
          pricing_description?: string | null
          pricing_items?: Json | null
          pricing_tagline?: string | null
          pricing_title?: string | null
          stats_properties?: string | null
          stats_properties_label?: string | null
          stats_support?: string | null
          stats_uptime?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      login_settings: {
        Row: {
          background_color: string | null
          company_name: string
          created_at: string
          id: string
          logo_url: string | null
          primary_color: string | null
          store_id: string | null
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          company_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          store_id?: string | null
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          company_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          store_id?: string | null
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_booking_cancelled: boolean
          email_new_booking: boolean
          email_payment_received: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_booking_cancelled?: boolean
          email_new_booking?: boolean
          email_payment_received?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_booking_cancelled?: boolean
          email_new_booking?: boolean
          email_payment_received?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ota_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ota_sources_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      print_settings: {
        Row: {
          business_address: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          footer_text: string | null
          id: string
          logo_url: string | null
          manager_name: string | null
          paper_size: string | null
          print_format: string
          show_logo: boolean | null
          show_manager_signature: boolean | null
          show_qr_code: boolean | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          business_address?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          manager_name?: string | null
          paper_size?: string | null
          print_format?: string
          show_logo?: boolean | null
          show_manager_signature?: boolean | null
          show_qr_code?: boolean | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          business_address?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          manager_name?: string | null
          paper_size?: string | null
          print_format?: string
          show_logo?: boolean | null
          show_manager_signature?: boolean | null
          show_qr_code?: boolean | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_brands: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_collections: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_materials: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          created_at: string
          id: string
          label: string | null
          min_quantity: number
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          min_quantity?: number
          price?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          min_quantity?: number
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_recipes: {
        Row: {
          created_at: string
          id: string
          ingredient_product_id: string
          product_id: string
          qty: number
          unit_factor: number
          unit_from: string | null
          unit_to: string | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_product_id: string
          product_id: string
          qty?: number
          unit_factor?: number
          unit_from?: string | null
          unit_to?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_product_id?: string
          product_id?: string
          qty?: number
          unit_factor?: number
          unit_from?: string | null
          unit_to?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_ingredient_product_id_fkey"
            columns: ["ingredient_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_unit_conversions: {
        Row: {
          created_at: string
          factor: number
          from_unit: string
          id: string
          is_active: boolean
          price_per_from: number
          product_id: string
          to_unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          factor?: number
          from_unit: string
          id?: string
          is_active?: boolean
          price_per_from?: number
          product_id: string
          to_unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          factor?: number
          from_unit?: string
          id?: string
          is_active?: boolean
          price_per_from?: number
          product_id?: string
          to_unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_unit_conversions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          created_at: string
          id: string
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          price: number
          product_id: string
          purchase_price: number
          sku: string | null
          stock: number
          updated_at: string
          variant_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          price?: number
          product_id: string
          purchase_price?: number
          sku?: string | null
          stock?: number
          updated_at?: string
          variant_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          price?: number
          product_id?: string
          purchase_price?: number
          sku?: string | null
          stock?: number
          updated_at?: string
          variant_name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          brand_id: string | null
          category_id: string | null
          collection_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          images: Json
          is_active: boolean
          material_id: string | null
          min_stock: number
          name: string
          price: number
          purchase_price: number
          show_on_website: boolean
          sku: string | null
          stock_qty: number
          store_id: string | null
          tax_enabled: boolean
          tax_mode: string
          track_inventory: boolean
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          collection_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          images?: Json
          is_active?: boolean
          material_id?: string | null
          min_stock?: number
          name: string
          price: number
          purchase_price?: number
          show_on_website?: boolean
          sku?: string | null
          stock_qty?: number
          store_id?: string | null
          tax_enabled?: boolean
          tax_mode?: string
          track_inventory?: boolean
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          collection_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          images?: Json
          is_active?: boolean
          material_id?: string | null
          min_stock?: number
          name?: string
          price?: number
          purchase_price?: number
          show_on_website?: boolean
          sku?: string | null
          stock_qty?: number
          store_id?: string | null
          tax_enabled?: boolean
          tax_mode?: string
          track_inventory?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "product_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "product_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_name: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_name: string
          purchase_id: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          purchase_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          bid: string | null
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string | null
          payment_method: string | null
          payment_proof_url: string | null
          process_status: string
          receipt_status: string
          status: string
          store_id: string
          supplier_name: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          amount?: number
          bid?: string | null
          created_at?: string
          created_by: string
          date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          process_status?: string
          receipt_status?: string
          status?: string
          store_id: string
          supplier_name?: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          amount?: number
          bid?: string | null
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          process_status?: string
          receipt_status?: string
          status?: string
          store_id?: string
          supplier_name?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      room_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          store_id: string
          tax_enabled: boolean
          tax_mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          tax_enabled?: boolean
          tax_mode?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          tax_enabled?: boolean
          tax_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      room_daily_status: {
        Row: {
          date: string
          id: string
          room_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          date: string
          id?: string
          room_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          date?: string
          id?: string
          room_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_daily_status_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_deposits: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string
          deposit_type: string
          id: string
          identity_owner_name: string | null
          identity_type: string | null
          notes: string | null
          photo_url: string | null
          print_count: number
          returned_at: string | null
          returned_by: string | null
          room_id: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by: string
          deposit_type: string
          id?: string
          identity_owner_name?: string | null
          identity_type?: string | null
          notes?: string | null
          photo_url?: string | null
          print_count?: number
          returned_at?: string | null
          returned_by?: string | null
          room_id: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string
          deposit_type?: string
          id?: string
          identity_owner_name?: string | null
          identity_type?: string | null
          notes?: string | null
          photo_url?: string | null
          print_count?: number
          returned_at?: string | null
          returned_by?: string | null
          room_id?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_deposits_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_deposits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      room_variants: {
        Row: {
          booking_duration_type: string | null
          booking_duration_value: number | null
          created_at: string
          description: string | null
          duration: number
          id: string
          is_active: boolean
          price: number
          room_id: string
          store_id: string | null
          updated_at: string
          variant_name: string
          visibility_type: string | null
          visible_days: number[] | null
        }
        Insert: {
          booking_duration_type?: string | null
          booking_duration_value?: number | null
          created_at?: string
          description?: string | null
          duration: number
          id?: string
          is_active?: boolean
          price: number
          room_id: string
          store_id?: string | null
          updated_at?: string
          variant_name: string
          visibility_type?: string | null
          visible_days?: number[] | null
        }
        Update: {
          booking_duration_type?: string | null
          booking_duration_value?: number | null
          created_at?: string
          description?: string | null
          duration?: number
          id?: string
          is_active?: boolean
          price?: number
          room_id?: string
          store_id?: string | null
          updated_at?: string
          variant_name?: string
          visibility_type?: string | null
          visible_days?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "room_variants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          category: string | null
          category_id: string | null
          created_at: string
          id: string
          name: string
          status: string
          store_id: string | null
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          store_id?: string | null
        }
        Update: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "room_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      status_colors: {
        Row: {
          color: string
          created_at: string
          id: string
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          status: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_colors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_in: {
        Row: {
          bid: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          status: string
          store_id: string
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          bid?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          date?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          store_id: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          bid?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          store_id?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_in_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          stock_in_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity?: number
          stock_in_id: string
          subtotal?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          stock_in_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_in_items_stock_in_id_fkey"
            columns: ["stock_in_id"]
            isOneToOne: false
            referencedRelation: "stock_in"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname: {
        Row: {
          bid: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          status: string
          store_id: string
          total_difference: number
          total_value_difference: number
          updated_at: string
        }
        Insert: {
          bid?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          date?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          store_id: string
          total_difference?: number
          total_value_difference?: number
          updated_at?: string
        }
        Update: {
          bid?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          store_id?: string
          total_difference?: number
          total_value_difference?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_items: {
        Row: {
          actual_stock: number
          created_at: string
          difference: number
          id: string
          product_id: string
          product_name: string
          stock_opname_id: string
          system_stock: number
          unit_price: number
          value_difference: number
        }
        Insert: {
          actual_stock?: number
          created_at?: string
          difference?: number
          id?: string
          product_id: string
          product_name: string
          stock_opname_id: string
          system_stock?: number
          unit_price?: number
          value_difference?: number
        }
        Update: {
          actual_stock?: number
          created_at?: string
          difference?: number
          id?: string
          product_id?: string
          product_name?: string
          stock_opname_id?: string
          system_stock?: number
          unit_price?: number
          value_difference?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_items_stock_opname_id_fkey"
            columns: ["stock_opname_id"]
            isOneToOne: false
            referencedRelation: "stock_opname"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_out: {
        Row: {
          bid: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          reason: string | null
          recipient: string | null
          status: string
          store_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          bid?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          date?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reason?: string | null
          recipient?: string | null
          status?: string
          store_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          bid?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reason?: string | null
          recipient?: string | null
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_out_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_out_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          stock_out_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity: number
          stock_out_id: string
          subtotal?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          stock_out_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_out_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_out_items_stock_out_id_fkey"
            columns: ["stock_out_id"]
            isOneToOne: false
            referencedRelation: "stock_out"
            referencedColumns: ["id"]
          },
        ]
      }
      store_features: {
        Row: {
          activation_description: string | null
          activation_price: string | null
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          activation_description?: string | null
          activation_price?: string | null
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          activation_description?: string | null
          activation_price?: string | null
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_features_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          calendar_type: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          location: string | null
          name: string
          room_limit: number
          slug: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          tax_enabled: boolean
          tax_modes_allowed: string[]
          tax_rate: number
          updated_at: string
        }
        Insert: {
          calendar_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          name: string
          room_limit?: number
          slug: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          tax_enabled?: boolean
          tax_modes_allowed?: string[]
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          calendar_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location?: string | null
          name?: string
          room_limit?: number
          slug?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          tax_enabled?: boolean
          tax_modes_allowed?: string[]
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          province: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          province?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          province?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_store_access: {
        Row: {
          created_at: string
          id: string
          role: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_store_access_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_temp_passwords: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_used: boolean
          temp_password: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_used?: boolean
          temp_password: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_used?: boolean
          temp_password?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_expire_booking_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      check_booking_rate_limit: {
        Args: {
          p_max_requests?: number
          p_phone: string
          p_time_window?: string
        }
        Returns: boolean
      }
      check_expired_stores: { Args: never; Returns: number }
      checkout_booking_by_request_id: {
        Args: { p_request_id: string; p_user_id: string }
        Returns: undefined
      }
      checkout_booking_from_request: {
        Args: { p_request: Record<string, unknown>; p_user_id: string }
        Returns: undefined
      }
      cleanup_expired_booking_requests: { Args: never; Returns: number }
      cleanup_storage_for_deleted_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_booking_from_request:
        | { Args: { p_request_id: string; p_user_id: string }; Returns: string }
        | {
            Args: { p_request_id: string; p_status?: string; p_user_id: string }
            Returns: string
          }
      generate_asset_bid: { Args: { p_store_id: string }; Returns: string }
      generate_booking_bid:
        | {
            Args: { booking_date: string; p_store_id: string }
            Returns: string
          }
        | {
            Args: { booking_date: string; is_ota?: boolean; p_store_id: string }
            Returns: string
          }
      generate_booking_request_bid: {
        Args: { p_store_id: string; request_date: string }
        Returns: string
      }
      generate_confirmation_token: { Args: never; Returns: string }
      generate_expense_bid: {
        Args: { expense_date: string; p_store_id: string }
        Returns: string
      }
      generate_income_bid: {
        Args: { income_date: string; p_store_id: string }
        Returns: string
      }
      generate_purchase_bid: {
        Args: { p_store_id: string; purchase_date: string }
        Returns: string
      }
      generate_stock_in_bid: {
        Args: { p_date: string; p_store_id: string }
        Returns: string
      }
      generate_stock_opname_bid: {
        Args: { p_date: string; p_store_id: string }
        Returns: string
      }
      generate_stock_out_bid: {
        Args: { p_date: string; p_store_id: string }
        Returns: string
      }
      get_notification_preferences: {
        Args: { _user_id: string }
        Returns: {
          email_booking_cancelled: boolean
          email_new_booking: boolean
          email_payment_received: boolean
        }[]
      }
      get_store_code: { Args: { store_id: string }; Returns: string }
      get_user_ids_with_any_store_access: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_name: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_store_access: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_store_admin: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      safe_promote_first_admin: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      start_payment_timer: {
        Args: { p_minutes?: number; p_request_id: string }
        Returns: string
      }
      update_booking_status_from_request: {
        Args: { p_new_status: string; p_request_id: string; p_user_id: string }
        Returns: undefined
      }
      user_has_store_admin_access: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "leader" | "owner" | "akuntan"
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
      app_role: ["admin", "user", "leader", "owner", "akuntan"],
    },
  },
} as const
