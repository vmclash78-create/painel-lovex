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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      client_purchases: {
        Row: {
          action: string
          amount: number
          created_at: string
          customer_phone: string | null
          expires_at: string | null
          id: string
          license_db: string | null
          license_id: string | null
          license_key: string | null
          mercadopago_payment_id: string | null
          new_license_key: string | null
          paid_at: string | null
          pix_copy_paste: string | null
          plan_id: string
          qr_code: string | null
          qr_code_base64: string | null
          status: string
          target_db: string
          updated_at: string
        }
        Insert: {
          action: string
          amount: number
          created_at?: string
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          license_db?: string | null
          license_id?: string | null
          license_key?: string | null
          mercadopago_payment_id?: string | null
          new_license_key?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          plan_id: string
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          target_db: string
          updated_at?: string
        }
        Update: {
          action?: string
          amount?: number
          created_at?: string
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          license_db?: string | null
          license_id?: string | null
          license_key?: string | null
          mercadopago_payment_id?: string | null
          new_license_key?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          plan_id?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          target_db?: string
          updated_at?: string
        }
        Relationships: []
      }
      extension_updates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_lovepro: boolean
          published_at: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_lovepro?: boolean
          published_at?: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_lovepro?: boolean
          published_at?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      licenses: {
        Row: {
          activated_at: string | null
          created_at: string
          device_id: string | null
          duration_minutes: number | null
          expires_at: string | null
          id: string
          license_key: string
          max_devices: number | null
          reseller_id: string | null
          session_id: string | null
          status: string | null
          updated_at: string
          user_name: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          device_id?: string | null
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          license_key: string
          max_devices?: number | null
          reseller_id?: string | null
          session_id?: string | null
          status?: string | null
          updated_at?: string
          user_name?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          device_id?: string | null
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          license_key?: string
          max_devices?: number | null
          reseller_id?: string | null
          session_id?: string | null
          status?: string | null
          updated_at?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_key_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          reseller_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          reseller_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          reseller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_key_balances_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: true
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_key_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          quantity: number
          reference_id: string | null
          reseller_id: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          quantity: number
          reference_id?: string | null
          reseller_id: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          quantity?: number
          reference_id?: string | null
          reseller_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_key_transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_purchases: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          mercadopago_payment_id: string | null
          package_name: string
          paid_at: string | null
          pix_copy_paste: string | null
          qr_code: string | null
          qr_code_base64: string | null
          quantity: number
          reseller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          mercadopago_payment_id?: string | null
          package_name: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          quantity: number
          reseller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          mercadopago_payment_id?: string | null
          package_name?: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          quantity?: number
          reseller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_purchases_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          max_keys: number
          max_keys_lp: number
          name: string
          password: string | null
          sells_lp: boolean
          sells_main: boolean
          token: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          max_keys?: number
          max_keys_lp?: number
          name: string
          password?: string | null
          sells_lp?: boolean
          sells_main?: boolean
          token: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          max_keys?: number
          max_keys_lp?: number
          name?: string
          password?: string | null
          sells_lp?: boolean
          sells_main?: boolean
          token?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_reseller_key: {
        Args: {
          _description?: string
          _reference_id?: string
          _reseller_id: string
        }
        Returns: boolean
      }
      credit_reseller_keys: {
        Args: {
          _description: string
          _quantity: number
          _reference_id: string
          _reseller_id: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
