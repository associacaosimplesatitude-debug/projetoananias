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
      assinaturas: {
        Row: {
          cliente_id: string
          created_at: string
          data_ativacao: string
          id: string
          modulo_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_ativacao?: string
          id?: string
          modulo_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_ativacao?: string
          id?: string
          modulo_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string
          account_type: string
          agency: string
          bank_name: string
          church_id: string
          created_at: string
          id: string
          initial_balance: number
          initial_balance_date: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          account_number: string
          account_type: string
          agency: string
          bank_name: string
          church_id: string
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_date: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          account_number?: string
          account_type?: string
          agency?: string
          bank_name?: string
          church_id?: string
          created_at?: string
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_church_id_fkey"
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
          payment_account: string | null
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
          payment_account?: string | null
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
          payment_account?: string | null
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
      branding_settings: {
        Row: {
          accent_color: string | null
          created_at: string
          id: string
          login_logo_url: string | null
          nav_background_color: string | null
          nav_logo_url: string | null
          nav_text_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          id?: string
          login_logo_url?: string | null
          nav_background_color?: string | null
          nav_logo_url?: string | null
          nav_text_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          id?: string
          login_logo_url?: string | null
          nav_background_color?: string | null
          nav_logo_url?: string | null
          nav_text_color?: string | null
          updated_at?: string
        }
        Relationships: []
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
          avatar_url: string | null
          bairro: string
          cargo: string
          cep: string
          church_id: string
          cidade: string
          complemento: string | null
          created_at: string
          data_aniversario: string
          email: string | null
          estado: string
          estado_civil: string | null
          id: string
          nome_completo: string
          numero: string
          rua: string
          sexo: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          avatar_url?: string | null
          bairro?: string
          cargo: string
          cep?: string
          church_id: string
          cidade?: string
          complemento?: string | null
          created_at?: string
          data_aniversario: string
          email?: string | null
          estado?: string
          estado_civil?: string | null
          id?: string
          nome_completo: string
          numero?: string
          rua?: string
          sexo: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          avatar_url?: string | null
          bairro?: string
          cargo?: string
          cep?: string
          church_id?: string
          cidade?: string
          complemento?: string | null
          created_at?: string
          data_aniversario?: string
          email?: string | null
          estado?: string
          estado_civil?: string | null
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
          client_type: string
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
          client_type?: string
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
          client_type?: string
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
      ebd_aluno_badges: {
        Row: {
          aluno_id: string
          badge_id: string
          conquistado_em: string
          id: string
        }
        Insert: {
          aluno_id: string
          badge_id: string
          conquistado_em?: string
          id?: string
        }
        Update: {
          aluno_id?: string
          badge_id?: string
          conquistado_em?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_aluno_badges_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "ebd_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_aluno_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "ebd_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_alunos: {
        Row: {
          church_id: string
          created_at: string
          data_nascimento: string | null
          email: string | null
          id: string
          is_active: boolean
          nome_completo: string
          pontos_totais: number
          responsavel: string | null
          telefone: string | null
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          nome_completo: string
          pontos_totais?: number
          responsavel?: string | null
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          nome_completo?: string
          pontos_totais?: number
          responsavel?: string | null
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_alunos_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_badges: {
        Row: {
          church_id: string
          created_at: string
          criterio: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          pontos: number
        }
        Insert: {
          church_id: string
          created_at?: string
          criterio: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          pontos?: number
        }
        Update: {
          church_id?: string
          created_at?: string
          criterio?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          pontos?: number
        }
        Relationships: [
          {
            foreignKeyName: "ebd_badges_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_devocionais: {
        Row: {
          church_id: string
          conteudo: string
          created_at: string
          data: string
          id: string
          titulo: string
        }
        Insert: {
          church_id: string
          conteudo: string
          created_at?: string
          data: string
          id?: string
          titulo: string
        }
        Update: {
          church_id?: string
          conteudo?: string
          created_at?: string
          data?: string
          id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_devocionais_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_devocional_registro: {
        Row: {
          aluno_id: string
          devocional_id: string
          feito_em: string
          id: string
        }
        Insert: {
          aluno_id: string
          devocional_id: string
          feito_em?: string
          id?: string
        }
        Update: {
          aluno_id?: string
          devocional_id?: string
          feito_em?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_devocional_registro_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "ebd_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_devocional_registro_devocional_id_fkey"
            columns: ["devocional_id"]
            isOneToOne: false
            referencedRelation: "ebd_devocionais"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_escalas: {
        Row: {
          church_id: string
          confirmado: boolean
          created_at: string
          data: string
          id: string
          observacao: string | null
          professor_id: string
          tipo: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          church_id: string
          confirmado?: boolean
          created_at?: string
          data: string
          id?: string
          observacao?: string | null
          professor_id: string
          tipo: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          confirmado?: boolean
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          professor_id?: string
          tipo?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_escalas_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_escalas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "ebd_professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_escalas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_frequencia: {
        Row: {
          aluno_id: string
          church_id: string
          created_at: string
          data: string
          id: string
          observacao: string | null
          presente: boolean
          turma_id: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          church_id: string
          created_at?: string
          data: string
          id?: string
          observacao?: string | null
          presente?: boolean
          turma_id: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          church_id?: string
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          presente?: boolean
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_frequencia_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "ebd_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_frequencia_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_frequencia_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_licoes: {
        Row: {
          arquivo_url: string | null
          church_id: string
          conteudo: string | null
          created_at: string
          data_aula: string
          id: string
          publicada: boolean
          titulo: string
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          arquivo_url?: string | null
          church_id: string
          conteudo?: string | null
          created_at?: string
          data_aula: string
          id?: string
          publicada?: boolean
          titulo: string
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_url?: string | null
          church_id?: string
          conteudo?: string | null
          created_at?: string
          data_aula?: string
          id?: string
          publicada?: boolean
          titulo?: string
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_licoes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_licoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_licoes_acesso: {
        Row: {
          acessado_em: string
          aluno_id: string
          id: string
          licao_id: string
        }
        Insert: {
          acessado_em?: string
          aluno_id: string
          id?: string
          licao_id: string
        }
        Update: {
          acessado_em?: string
          aluno_id?: string
          id?: string
          licao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_licoes_acesso_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "ebd_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_licoes_acesso_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "ebd_licoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_professores: {
        Row: {
          church_id: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          nome_completo: string
          telefone: string | null
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          nome_completo: string
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          nome_completo?: string
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_professores_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_quiz_questoes: {
        Row: {
          created_at: string
          id: string
          opcao_a: string
          opcao_b: string
          opcao_c: string | null
          opcao_d: string | null
          ordem: number
          pergunta: string
          quiz_id: string
          resposta_correta: string
        }
        Insert: {
          created_at?: string
          id?: string
          opcao_a: string
          opcao_b: string
          opcao_c?: string | null
          opcao_d?: string | null
          ordem: number
          pergunta: string
          quiz_id: string
          resposta_correta: string
        }
        Update: {
          created_at?: string
          id?: string
          opcao_a?: string
          opcao_b?: string
          opcao_c?: string | null
          opcao_d?: string | null
          ordem?: number
          pergunta?: string
          quiz_id?: string
          resposta_correta?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_quiz_questoes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "ebd_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_quiz_respostas: {
        Row: {
          aluno_id: string
          completado: boolean
          completado_em: string | null
          created_at: string
          id: string
          pontos_obtidos: number
          quiz_id: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          completado?: boolean
          completado_em?: string | null
          created_at?: string
          id?: string
          pontos_obtidos?: number
          quiz_id: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          completado?: boolean
          completado_em?: string | null
          created_at?: string
          id?: string
          pontos_obtidos?: number
          quiz_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_quiz_respostas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "ebd_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_quiz_respostas_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "ebd_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_quizzes: {
        Row: {
          church_id: string
          created_at: string
          data_limite: string | null
          descricao: string | null
          id: string
          is_active: boolean
          licao_id: string | null
          pontos_max: number
          titulo: string
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          licao_id?: string | null
          pontos_max?: number
          titulo: string
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean
          licao_id?: string | null
          pontos_max?: number
          titulo?: string
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_quizzes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_quizzes_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "ebd_licoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_quizzes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_turmas: {
        Row: {
          church_id: string
          created_at: string
          descricao: string | null
          faixa_etaria: string
          id: string
          is_active: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          descricao?: string | null
          faixa_etaria: string
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          descricao?: string | null
          faixa_etaria?: string
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_turmas_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
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
          payment_account: string | null
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
          payment_account?: string | null
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
          payment_account?: string | null
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
      lancamentos_contabeis: {
        Row: {
          church_id: string
          conta_credito: string
          conta_debito: string
          created_at: string
          data: string
          documento: string | null
          entry_id: string | null
          expense_id: string | null
          historico: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          church_id: string
          conta_credito: string
          conta_debito: string
          created_at?: string
          data: string
          documento?: string | null
          entry_id?: string | null
          expense_id?: string | null
          historico: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          church_id?: string
          conta_credito?: string
          conta_debito?: string
          created_at?: string
          data?: string
          documento?: string | null
          entry_id?: string | null
          expense_id?: string | null
          historico?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_contabeis_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "bills_to_pay"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome_modulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome_modulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome_modulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      plano_de_contas: {
        Row: {
          codigo_conta: string
          created_at: string
          grupo: string
          id: string
          natureza: string
          nome_conta: string
          tipo_conta: string
          updated_at: string
        }
        Insert: {
          codigo_conta: string
          created_at?: string
          grupo: string
          id?: string
          natureza: string
          nome_conta: string
          tipo_conta: string
          updated_at?: string
        }
        Update: {
          codigo_conta?: string
          created_at?: string
          grupo?: string
          id?: string
          natureza?: string
          nome_conta?: string
          tipo_conta?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          church_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
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
      app_role: "admin" | "client" | "tesoureiro" | "secretario"
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
      app_role: ["admin", "client", "tesoureiro", "secretario"],
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
