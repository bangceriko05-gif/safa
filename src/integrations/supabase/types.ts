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
      booking_products: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          product_price: number
          quantity?: number
          subtotal: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
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
          dual_payment: boolean | null
          duration: number
          end_time: string
          id: string
          note: string | null
          payment_method: string | null
          payment_method_2: string | null
          payment_proof_url: string | null
          phone: string
          price: number
          price_2: number | null
          reference_no: string
          reference_no_2: string | null
          room_id: string
          start_time: string
          status: string | null
          store_id: string | null
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
          dual_payment?: boolean | null
          duration: number
          end_time: string
          id?: string
          note?: string | null
          payment_method?: string | null
          payment_method_2?: string | null
          payment_proof_url?: string | null
          phone: string
          price: number
          price_2?: number | null
          reference_no: string
          reference_no_2?: string | null
          room_id: string
          start_time: string
          status?: string | null
          store_id?: string | null
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
          dual_payment?: boolean | null
          duration?: number
          end_time?: string
          id?: string
          note?: string | null
          payment_method?: string | null
          payment_method_2?: string | null
          payment_proof_url?: string | null
          phone?: string
          price?: number
          price_2?: number | null
          reference_no?: string
          reference_no_2?: string | null
          room_id?: string
          start_time?: string
          status?: string | null
          store_id?: string | null
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
      customers: {
        Row: {
          created_at: string
          created_by: string
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
          created_at?: string
          created_by: string
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
          created_at?: string
          created_by?: string
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
          store_id: string | null
          updated_at: string
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
          store_id?: string | null
          updated_at?: string
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
          store_id?: string | null
          updated_at?: string
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
          id: string
          income_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          income_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity?: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          income_id?: string
          product_id?: string
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
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
          id: string
          payment_method: string | null
          reference_no: string | null
          store_id: string | null
          updated_at: string
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
          id?: string
          payment_method?: string | null
          reference_no?: string | null
          store_id?: string | null
          updated_at?: string
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
          id?: string
          payment_method?: string | null
          reference_no?: string | null
          store_id?: string | null
          updated_at?: string
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
      products: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          price: number
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          price: number
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          price?: number
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
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
          slug: string
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
          slug: string
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
          slug?: string
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
          p_time_window?: unknown
        }
        Returns: boolean
      }
      checkout_booking_by_request_id: {
        Args: { p_request_id: string; p_user_id: string }
        Returns: undefined
      }
      checkout_booking_from_request: {
        Args: { p_request: Record<string, unknown>; p_user_id: string }
        Returns: undefined
      }
      cleanup_expired_booking_requests: { Args: never; Returns: number }
      create_booking_from_request:
        | { Args: { p_request_id: string; p_user_id: string }; Returns: string }
        | {
            Args: { p_request_id: string; p_status?: string; p_user_id: string }
            Returns: string
          }
      generate_booking_bid: {
        Args: { booking_date: string; p_store_id: string }
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
      get_notification_preferences: {
        Args: { _user_id: string }
        Returns: {
          email_booking_cancelled: boolean
          email_new_booking: boolean
          email_payment_received: boolean
        }[]
      }
      get_store_code: { Args: { store_id: string }; Returns: string }
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
    }
    Enums: {
      app_role: "admin" | "user" | "leader"
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
      app_role: ["admin", "user", "leader"],
    },
  },
} as const
