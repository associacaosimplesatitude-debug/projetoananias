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
      bills_to_pay: {
        Row: {
          amount: number
          category_main: string
          category_sub: string
          church_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          is_recurring: boolean
          paid_amount: number | null
          paid_date: string | null
          receipt_path: string | null
          recurring_expense_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_main: string
          category_sub: string
          church_id: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          is_recurring?: boolean
          paid_amount?: number | null
          paid_date?: string | null
          receipt_path?: string | null
          recurring_expense_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_main?: string
          category_sub?: string
          church_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          is_recurring?: boolean
          paid_amount?: number | null
          paid_date?: string | null
          receipt_path?: string | null
          recurring_expense_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_to_pay_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_to_pay_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      board_mandates: {
        Row: {
          church_id: string
          created_at: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_mandates_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      board_members: {
        Row: {
          cargo: string
          cep: string
          church_id: string
          cpf: string
          created_at: string
          endereco: string
          estado_civil: string
          id: string
          nome_completo: string
          orgao_emissor: string
          profissao: string
          rg: string
          updated_at: string
        }
        Insert: {
          cargo: string
          cep: string
          church_id: string
          cpf: string
          created_at?: string
          endereco: string
          estado_civil: string
          id?: string
          nome_completo: string
          orgao_emissor: string
          profissao: string
          rg: string
          updated_at?: string
        }
        Update: {
          cargo?: string
          cep?: string
          church_id?: string
          cpf?: string
          created_at?: string
          endereco?: string
          estado_civil?: string
          id?: string
          nome_completo?: string
          orgao_emissor?: string
          profissao?: string
          rg?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_documents: {
        Row: {
          church_id: string
          created_at: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          stage_id: number
          sub_task_id: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          stage_id: number
          sub_task_id: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          stage_id?: number
          sub_task_id?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_documents_church_id_fkey"
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
      church_members: {
        Row: {
          bairro: string
          cargo: string
          cep: string
          church_id: string
          cidade: string
          complemento: string | null
          created_at: string
          data_aniversario: string
          estado: string
          id: string
          nome_completo: string
          numero: string
          rua: string
          sexo: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          bairro?: string
          cargo: string
          cep?: string
          church_id: string
          cidade?: string
          complemento?: string | null
          created_at?: string
          data_aniversario: string
          estado?: string
          id?: string
          nome_completo: string
          numero?: string
          rua?: string
          sexo: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          bairro?: string
          cargo?: string
          cep?: string
          church_id?: string
          cidade?: string
          complemento?: string | null
          created_at?: string
          data_aniversario?: string
          estado?: string
          id?: string
          nome_completo?: string
          numero?: string
          rua?: string
          sexo?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_members_church_id_fkey"
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
          payment_link: string | null
          rejection_reason: string | null
          scheduled_datetime: string | null
          stage_id: number
          status: string
          sub_task_id: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          payment_link?: string | null
          rejection_reason?: string | null
          scheduled_datetime?: string | null
          stage_id: number
          status?: string
          sub_task_id: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          payment_link?: string | null
          rejection_reason?: string | null
          scheduled_datetime?: string | null
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
          process_status: string
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
          process_status?: string
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
          process_status?: string
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          church_id: string
          created_at: string
          data: string
          descricao: string
          hora: string | null
          id: string
          membro_id: string | null
          membro_nome: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          church_id: string
          created_at?: string
          data: string
          descricao: string
          hora?: string | null
          id?: string
          membro_id?: string | null
          membro_nome?: string | null
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          church_id?: string
          created_at?: string
          data?: string
          descricao?: string
          hora?: string | null
          id?: string
          membro_id?: string | null
          membro_nome?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_expenses: {
        Row: {
          categoria_main: string
          categoria_sub: string
          church_id: string
          created_at: string
          data: string
          descricao: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_main: string
          categoria_sub: string
          church_id: string
          created_at?: string
          data: string
          descricao: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria_main?: string
          categoria_sub?: string
          church_id?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_expenses_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
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
      recurring_expenses: {
        Row: {
          amount: number
          category_main: string
          category_sub: string
          church_id: string
          created_at: string
          description: string
          due_day: number
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          amount: number
          category_main: string
          category_sub: string
          church_id: string
          created_at?: string
          description: string
          due_day: number
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          category_main?: string
          category_sub?: string
          church_id?: string
          created_at?: string
          description?: string
          due_day?: number
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_church_id_fkey"
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
          video_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          info_text: string
          stage_id: number
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          info_text?: string
          stage_id?: number
          updated_at?: string
          video_url?: string | null
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
