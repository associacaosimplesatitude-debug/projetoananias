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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number
          created_at: string
          current_installment: number | null
          description: string
          due_date: string
          id: string
          installments: number | null
          payment_date: string | null
          payment_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          current_installment?: number | null
          description: string
          due_date: string
          id?: string
          installments?: number | null
          payment_date?: string | null
          payment_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          current_installment?: number | null
          description?: string
          due_date?: string
          id?: string
          installments?: number | null
          payment_date?: string | null
          payment_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      accounts_receivable: {
        Row: {
          amount: number
          church_id: string
          created_at: string
          current_installment: number | null
          description: string | null
          due_date: string
          id: string
          installments: number | null
          payment_date: string | null
          payment_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          church_id: string
          created_at?: string
          current_installment?: number | null
          description?: string | null
          due_date: string
          id?: string
          installments?: number | null
          payment_date?: string | null
          payment_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          church_id?: string
          created_at?: string
          current_installment?: number | null
          description?: string | null
          due_date?: string
          id?: string
          installments?: number | null
          payment_date?: string | null
          payment_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_member_permissions: {
        Row: {
          church_id: string
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["church_permission"]
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["church_permission"]
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["church_permission"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_member_permissions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_stage_progress: {
        Row: {
          church_id: string
          created_at: string
          id: string
          stage_id: number
          status: string
          sub_task_id: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          stage_id: number
          status?: string
          sub_task_id: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          stage_id?: number
          status?: string
          sub_task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_stage_progress_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          church_name: string
          city: string | null
          cnpj: string | null
          created_at: string
          current_stage: number | null
          id: string
          monthly_fee: number | null
          neighborhood: string | null
          pastor_cpf: string | null
          pastor_email: string
          pastor_name: string | null
          pastor_rg: string | null
          pastor_whatsapp: string | null
          payment_due_day: number | null
          postal_code: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          church_name: string
          city?: string | null
          cnpj?: string | null
          created_at?: string
          current_stage?: number | null
          id?: string
          monthly_fee?: number | null
          neighborhood?: string | null
          pastor_cpf?: string | null
          pastor_email: string
          pastor_name?: string | null
          pastor_rg?: string | null
          pastor_whatsapp?: string | null
          payment_due_day?: number | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          church_name?: string
          city?: string | null
          cnpj?: string | null
          created_at?: string
          current_stage?: number | null
          id?: string
          monthly_fee?: number | null
          neighborhood?: string | null
          pastor_cpf?: string | null
          pastor_email?: string
          pastor_name?: string | null
          pastor_rg?: string | null
          pastor_whatsapp?: string | null
          payment_due_day?: number | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          church_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          church_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_info_texts: {
        Row: {
          created_at: string
          id: string
          info_text: string
          stage_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          info_text: string
          stage_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          info_text?: string
          stage_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variable_payments: {
        Row: {
          amount: number | null
          church_id: string
          created_at: string
          id: string
          status: string
          sub_task_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          church_id: string
          created_at?: string
          id?: string
          status?: string
          sub_task_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          church_id?: string
          created_at?: string
          id?: string
          status?: string
          sub_task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variable_payments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_church_permission: {
        Args: {
          _church_id: string
          _permission: Database["public"]["Enums"]["church_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
      church_permission:
        | "view_financial"
        | "edit_financial"
        | "approve_expenses"
        | "manage_members"
        | "view_reports"
        | "edit_church_info"
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
      app_role: ["admin", "client"],
      church_permission: [
        "view_financial",
        "edit_financial",
        "approve_expenses",
        "manage_members",
        "view_reports",
        "edit_church_info",
      ],
    },
  },
} as const
