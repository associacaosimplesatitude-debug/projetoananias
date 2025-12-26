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
      bling_config: {
        Row: {
          access_token: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string
          id: string
          loja_id: number | null
          redirect_uri: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          id?: string
          loja_id?: number | null
          redirect_uri?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          id?: string
          loja_id?: number | null
          redirect_uri?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bling_marketplace_pedidos: {
        Row: {
          bling_order_id: number
          codigo_rastreio: string | null
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          id: string
          marketplace: string
          order_date: string | null
          order_number: string
          status_logistico: string | null
          status_pagamento: string
          updated_at: string
          url_rastreio: string | null
          valor_frete: number
          valor_total: number
        }
        Insert: {
          bling_order_id: number
          codigo_rastreio?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          marketplace: string
          order_date?: string | null
          order_number: string
          status_logistico?: string | null
          status_pagamento?: string
          updated_at?: string
          url_rastreio?: string | null
          valor_frete?: number
          valor_total?: number
        }
        Update: {
          bling_order_id?: number
          codigo_rastreio?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          marketplace?: string
          order_date?: string | null
          order_number?: string
          status_logistico?: string | null
          status_pagamento?: string
          updated_at?: string
          url_rastreio?: string | null
          valor_frete?: number
          valor_total?: number
        }
        Relationships: []
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
          vendedor_id: string | null
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
          vendedor_id?: string | null
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
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "churches_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      desafio_biblico: {
        Row: {
          church_id: string
          created_at: string
          finalizado_em: string | null
          id: string
          iniciado_em: string | null
          nome: string
          num_blocos_charada: number
          num_perguntas_desbloqueio: number
          status: Database["public"]["Enums"]["desafio_status"]
          tempo_limite_minutos: number
          tipo_publico: Database["public"]["Enums"]["desafio_tipo_publico"]
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          nome: string
          num_blocos_charada?: number
          num_perguntas_desbloqueio?: number
          status?: Database["public"]["Enums"]["desafio_status"]
          tempo_limite_minutos?: number
          tipo_publico?: Database["public"]["Enums"]["desafio_tipo_publico"]
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          nome?: string
          num_blocos_charada?: number
          num_perguntas_desbloqueio?: number
          status?: Database["public"]["Enums"]["desafio_status"]
          tempo_limite_minutos?: number
          tipo_publico?: Database["public"]["Enums"]["desafio_tipo_publico"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_biblico_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      desafio_equipe: {
        Row: {
          created_at: string
          desafio_id: string
          id: string
          lider_id: string | null
          nome: Database["public"]["Enums"]["desafio_equipe_nome"]
          pontuacao: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          desafio_id: string
          id?: string
          lider_id?: string | null
          nome: Database["public"]["Enums"]["desafio_equipe_nome"]
          pontuacao?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          desafio_id?: string
          id?: string
          lider_id?: string | null
          nome?: Database["public"]["Enums"]["desafio_equipe_nome"]
          pontuacao?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_equipe_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafio_biblico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desafio_equipe_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "ebd_professores"
            referencedColumns: ["id"]
          },
        ]
      }
      desafio_membro_equipe: {
        Row: {
          created_at: string
          equipe_id: string
          id: string
          professor_id: string
        }
        Insert: {
          created_at?: string
          equipe_id: string
          id?: string
          professor_id: string
        }
        Update: {
          created_at?: string
          equipe_id?: string
          id?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_membro_equipe_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "desafio_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desafio_membro_equipe_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "ebd_professores"
            referencedColumns: ["id"]
          },
        ]
      }
      desafio_pergunta: {
        Row: {
          created_at: string
          desafio_id: string
          equipe_alvo: Database["public"]["Enums"]["desafio_equipe_nome"]
          id: string
          ordem: number
          resposta_correta: string
          texto_pergunta: string
          tipo: Database["public"]["Enums"]["desafio_pergunta_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          desafio_id: string
          equipe_alvo: Database["public"]["Enums"]["desafio_equipe_nome"]
          id?: string
          ordem: number
          resposta_correta: string
          texto_pergunta: string
          tipo: Database["public"]["Enums"]["desafio_pergunta_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          desafio_id?: string
          equipe_alvo?: Database["public"]["Enums"]["desafio_equipe_nome"]
          id?: string
          ordem?: number
          resposta_correta?: string
          texto_pergunta?: string
          tipo?: Database["public"]["Enums"]["desafio_pergunta_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_pergunta_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafio_biblico"
            referencedColumns: ["id"]
          },
        ]
      }
      desafio_tentativa_resposta: {
        Row: {
          acertou: boolean
          created_at: string
          desafio_id: string
          equipe_id: string
          id: string
          pergunta_id: string
          respondido_por: string | null
          resposta_enviada: string
        }
        Insert: {
          acertou?: boolean
          created_at?: string
          desafio_id: string
          equipe_id: string
          id?: string
          pergunta_id: string
          respondido_por?: string | null
          resposta_enviada: string
        }
        Update: {
          acertou?: boolean
          created_at?: string
          desafio_id?: string
          equipe_id?: string
          id?: string
          pergunta_id?: string
          respondido_por?: string | null
          resposta_enviada?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_tentativa_resposta_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafio_biblico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desafio_tentativa_resposta_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "desafio_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desafio_tentativa_resposta_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "desafio_pergunta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desafio_tentativa_resposta_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "ebd_professores"
            referencedColumns: ["id"]
          },
        ]
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
          aulas_seguidas: number
          avatar_url: string | null
          church_id: string
          conquistas: Json | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          id: string
          is_active: boolean
          member_id: string | null
          nivel: string
          nome_completo: string
          pontos_totais: number
          responsavel: string | null
          telefone: string | null
          turma_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aulas_seguidas?: number
          avatar_url?: string | null
          church_id: string
          conquistas?: Json | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          nivel?: string
          nome_completo: string
          pontos_totais?: number
          responsavel?: string | null
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aulas_seguidas?: number
          avatar_url?: string | null
          church_id?: string
          conquistas?: Json | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          nivel?: string
          nome_completo?: string
          pontos_totais?: number
          responsavel?: string | null
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "ebd_alunos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
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
      ebd_anotacoes: {
        Row: {
          aluno_id: string
          church_id: string
          conteudo: string | null
          created_at: string
          id: string
          licao_id: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          church_id: string
          conteudo?: string | null
          created_at?: string
          id?: string
          licao_id?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          church_id?: string
          conteudo?: string | null
          created_at?: string
          id?: string
          licao_id?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_anotacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "ebd_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_anotacoes_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "ebd_licoes"
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
      ebd_banner_dismissals: {
        Row: {
          church_id: string
          created_at: string
          dismissed_at: string
          id: string
          trimester_start: string
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          dismissed_at?: string
          id?: string
          trimester_start: string
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          dismissed_at?: string
          id?: string
          trimester_start?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_banner_dismissals_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_clientes: {
        Row: {
          bling_cliente_id: number | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          data_aniversario_pastor: string | null
          data_aniversario_superintendente: string | null
          data_inicio_ebd: string | null
          data_proxima_compra: string | null
          desconto_faturamento: number | null
          dia_aula: string | null
          email_superintendente: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          id: string
          nome_igreja: string
          nome_responsavel: string | null
          nome_superintendente: string | null
          pode_faturar: boolean
          possui_cnpj: boolean | null
          rg: string | null
          senha_temporaria: string | null
          status_ativacao_ebd: boolean
          superintendente_user_id: string | null
          telefone: string | null
          tipo_cliente: string | null
          ultimo_login: string | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          bling_cliente_id?: number | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          data_aniversario_pastor?: string | null
          data_aniversario_superintendente?: string | null
          data_inicio_ebd?: string | null
          data_proxima_compra?: string | null
          desconto_faturamento?: number | null
          dia_aula?: string | null
          email_superintendente?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          nome_igreja: string
          nome_responsavel?: string | null
          nome_superintendente?: string | null
          pode_faturar?: boolean
          possui_cnpj?: boolean | null
          rg?: string | null
          senha_temporaria?: string | null
          status_ativacao_ebd?: boolean
          superintendente_user_id?: string | null
          telefone?: string | null
          tipo_cliente?: string | null
          ultimo_login?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          bling_cliente_id?: number | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          data_aniversario_pastor?: string | null
          data_aniversario_superintendente?: string | null
          data_inicio_ebd?: string | null
          data_proxima_compra?: string | null
          desconto_faturamento?: number | null
          dia_aula?: string | null
          email_superintendente?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          nome_igreja?: string
          nome_responsavel?: string | null
          nome_superintendente?: string | null
          pode_faturar?: boolean
          possui_cnpj?: boolean | null
          rg?: string | null
          senha_temporaria?: string | null
          status_ativacao_ebd?: boolean
          superintendente_user_id?: string | null
          telefone?: string | null
          tipo_cliente?: string | null
          ultimo_login?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ebd_clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_dados_aula: {
        Row: {
          church_id: string
          created_at: string
          data: string
          id: string
          num_biblias: number | null
          num_revistas: number | null
          num_visitantes: number | null
          observacao: string | null
          registrado_por: string | null
          turma_id: string
          updated_at: string
          valor_ofertas: number | null
        }
        Insert: {
          church_id: string
          created_at?: string
          data: string
          id?: string
          num_biblias?: number | null
          num_revistas?: number | null
          num_visitantes?: number | null
          observacao?: string | null
          registrado_por?: string | null
          turma_id: string
          updated_at?: string
          valor_ofertas?: number | null
        }
        Update: {
          church_id?: string
          created_at?: string
          data?: string
          id?: string
          num_biblias?: number | null
          num_revistas?: number | null
          num_visitantes?: number | null
          observacao?: string | null
          registrado_por?: string | null
          turma_id?: string
          updated_at?: string
          valor_ofertas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ebd_dados_aula_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_dados_aula_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
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
      ebd_endereco_entrega: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          complemento: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          estado: string
          id: string
          nome: string
          numero: string
          rua: string
          sobrenome: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bairro: string
          cep: string
          cidade: string
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          estado: string
          id?: string
          nome: string
          numero: string
          rua: string
          sobrenome?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          estado?: string
          id?: string
          nome?: string
          numero?: string
          rua?: string
          sobrenome?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          sem_aula: boolean
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
          sem_aula?: boolean
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
          sem_aula?: boolean
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
      ebd_faixas_etarias: {
        Row: {
          church_id: string
          created_at: string
          id: string
          idade_max: number
          idade_min: number
          nome_faixa: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          idade_max: number
          idade_min: number
          nome_faixa: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          idade_max?: number
          idade_min?: number
          nome_faixa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_faixas_etarias_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
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
      ebd_leads_reativacao: {
        Row: {
          cnpj: string | null
          conta_criada: boolean | null
          created_at: string
          data_followup: string | null
          email: string | null
          email_aberto: boolean
          email_nota: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          id: string
          lead_score: string
          motivo_perda: string | null
          nome_igreja: string
          nome_responsavel: string | null
          observacoes: string | null
          status_lead: string
          telefone: string | null
          total_compras_historico: number | null
          ultima_compra: string | null
          ultimo_login_ebd: string | null
          updated_at: string
          valor_ultima_compra: number | null
          vendedor_id: string | null
        }
        Insert: {
          cnpj?: string | null
          conta_criada?: boolean | null
          created_at?: string
          data_followup?: string | null
          email?: string | null
          email_aberto?: boolean
          email_nota?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          lead_score?: string
          motivo_perda?: string | null
          nome_igreja: string
          nome_responsavel?: string | null
          observacoes?: string | null
          status_lead?: string
          telefone?: string | null
          total_compras_historico?: number | null
          ultima_compra?: string | null
          ultimo_login_ebd?: string | null
          updated_at?: string
          valor_ultima_compra?: number | null
          vendedor_id?: string | null
        }
        Update: {
          cnpj?: string | null
          conta_criada?: boolean | null
          created_at?: string
          data_followup?: string | null
          email?: string | null
          email_aberto?: boolean
          email_nota?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          lead_score?: string
          motivo_perda?: string | null
          nome_igreja?: string
          nome_responsavel?: string | null
          observacoes?: string | null
          status_lead?: string
          telefone?: string | null
          total_compras_historico?: number | null
          ultima_compra?: string | null
          ultimo_login_ebd?: string | null
          updated_at?: string
          valor_ultima_compra?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ebd_leads_reativacao_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_leituras: {
        Row: {
          aluno_id: string
          church_id: string
          created_at: string
          data_leitura: string
          id: string
          licao_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          church_id: string
          created_at?: string
          data_leitura?: string
          id?: string
          licao_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          church_id?: string
          created_at?: string
          data_leitura?: string
          id?: string
          licao_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_leituras_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "ebd_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_leituras_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "ebd_licoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_licoes: {
        Row: {
          arquivo_url: string | null
          church_id: string | null
          conteudo: string | null
          created_at: string
          data_aula: string
          id: string
          numero_licao: number | null
          plano_leitura_semanal: Json | null
          publicada: boolean
          revista_id: string | null
          titulo: string
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          arquivo_url?: string | null
          church_id?: string | null
          conteudo?: string | null
          created_at?: string
          data_aula: string
          id?: string
          numero_licao?: number | null
          plano_leitura_semanal?: Json | null
          publicada?: boolean
          revista_id?: string | null
          titulo: string
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_url?: string | null
          church_id?: string | null
          conteudo?: string | null
          created_at?: string
          data_aula?: string
          id?: string
          numero_licao?: number | null
          plano_leitura_semanal?: Json | null
          publicada?: boolean
          revista_id?: string | null
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
            foreignKeyName: "ebd_licoes_revista_id_fkey"
            columns: ["revista_id"]
            isOneToOne: false
            referencedRelation: "ebd_revistas"
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
      ebd_materiais: {
        Row: {
          arquivo_url: string | null
          church_id: string
          created_at: string
          descricao: string | null
          id: string
          licao_id: string | null
          tipo: string
          titulo: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          arquivo_url?: string | null
          church_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          licao_id?: string | null
          tipo?: string
          titulo: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          arquivo_url?: string | null
          church_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          licao_id?: string | null
          tipo?: string
          titulo?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_materiais_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "ebd_licoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_materiais_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_pedidos: {
        Row: {
          approved_at: string | null
          bling_order_id: number | null
          church_id: string
          codigo_rastreio: string | null
          cpf_cnpj_cliente: string | null
          created_at: string | null
          email_cliente: string | null
          endereco_bairro: string
          endereco_cep: string
          endereco_cidade: string
          endereco_complemento: string | null
          endereco_estado: string
          endereco_numero: string
          endereco_rua: string
          id: string
          mercadopago_payment_id: string | null
          mercadopago_preference_id: string | null
          metodo_frete: string | null
          nome_cliente: string | null
          payment_status: string | null
          sobrenome_cliente: string | null
          status: string
          status_logistico: string | null
          telefone_cliente: string | null
          updated_at: string | null
          valor_frete: number
          valor_produtos: number
          valor_total: number
        }
        Insert: {
          approved_at?: string | null
          bling_order_id?: number | null
          church_id: string
          codigo_rastreio?: string | null
          cpf_cnpj_cliente?: string | null
          created_at?: string | null
          email_cliente?: string | null
          endereco_bairro: string
          endereco_cep: string
          endereco_cidade: string
          endereco_complemento?: string | null
          endereco_estado: string
          endereco_numero: string
          endereco_rua: string
          id?: string
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          metodo_frete?: string | null
          nome_cliente?: string | null
          payment_status?: string | null
          sobrenome_cliente?: string | null
          status?: string
          status_logistico?: string | null
          telefone_cliente?: string | null
          updated_at?: string | null
          valor_frete?: number
          valor_produtos?: number
          valor_total?: number
        }
        Update: {
          approved_at?: string | null
          bling_order_id?: number | null
          church_id?: string
          codigo_rastreio?: string | null
          cpf_cnpj_cliente?: string | null
          created_at?: string | null
          email_cliente?: string | null
          endereco_bairro?: string
          endereco_cep?: string
          endereco_cidade?: string
          endereco_complemento?: string | null
          endereco_estado?: string
          endereco_numero?: string
          endereco_rua?: string
          id?: string
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          metodo_frete?: string | null
          nome_cliente?: string | null
          payment_status?: string | null
          sobrenome_cliente?: string | null
          status?: string
          status_logistico?: string | null
          telefone_cliente?: string | null
          updated_at?: string | null
          valor_frete?: number
          valor_produtos?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ebd_pedidos_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_pedidos_itens: {
        Row: {
          created_at: string | null
          id: string
          pedido_id: string
          preco_total: number
          preco_unitario: number
          quantidade: number
          revista_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pedido_id: string
          preco_total: number
          preco_unitario: number
          quantidade: number
          revista_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pedido_id?: string
          preco_total?: number
          preco_unitario?: number
          quantidade?: number
          revista_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_pedidos_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "ebd_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_pedidos_itens_revista_id_fkey"
            columns: ["revista_id"]
            isOneToOne: false
            referencedRelation: "ebd_revistas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_planejamento: {
        Row: {
          church_id: string
          created_at: string
          data_inicio: string
          data_termino: string
          dia_semana: string
          id: string
          revista_id: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          data_inicio: string
          data_termino: string
          dia_semana: string
          id?: string
          revista_id: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          data_inicio?: string
          data_termino?: string
          dia_semana?: string
          id?: string
          revista_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_planejamento_revista_id_fkey"
            columns: ["revista_id"]
            isOneToOne: false
            referencedRelation: "ebd_revistas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_pontuacao_manual: {
        Row: {
          aluno_id: string
          church_id: string
          created_at: string
          data: string
          id: string
          motivo: string
          pontos: number
          registrado_por: string | null
          turma_id: string
        }
        Insert: {
          aluno_id: string
          church_id: string
          created_at?: string
          data?: string
          id?: string
          motivo?: string
          pontos?: number
          registrado_por?: string | null
          turma_id: string
        }
        Update: {
          aluno_id?: string
          church_id?: string
          created_at?: string
          data?: string
          id?: string
          motivo?: string
          pontos?: number
          registrado_por?: string | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_pontuacao_manual_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "ebd_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_pontuacao_manual_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_professores: {
        Row: {
          avatar_url: string | null
          church_id: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          member_id: string | null
          nome_completo: string
          telefone: string | null
          turma_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          church_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          nome_completo: string
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          church_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          nome_completo?: string
          telefone?: string | null
          turma_id?: string | null
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "ebd_professores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "church_members"
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
      ebd_professores_turmas: {
        Row: {
          created_at: string
          id: string
          professor_id: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          professor_id: string
          turma_id: string
        }
        Update: {
          created_at?: string
          id?: string
          professor_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_professores_turmas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "ebd_professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_professores_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_quiz_mestre_questoes: {
        Row: {
          created_at: string
          id: string
          licao_id: string
          opcao_a: string
          opcao_b: string
          opcao_c: string
          ordem: number
          pergunta: string
          resposta_correta: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          licao_id: string
          opcao_a: string
          opcao_b: string
          opcao_c: string
          ordem: number
          pergunta: string
          resposta_correta: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          licao_id?: string
          opcao_a?: string
          opcao_b?: string
          opcao_c?: string
          ordem?: number
          pergunta?: string
          resposta_correta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_quiz_mestre_questoes_licao_id_fkey"
            columns: ["licao_id"]
            isOneToOne: false
            referencedRelation: "ebd_licoes"
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
      ebd_revistas: {
        Row: {
          autor: string | null
          bling_produto_id: number | null
          categoria: string | null
          created_at: string
          estoque: number | null
          faixa_etaria_alvo: string
          id: string
          imagem_url: string | null
          last_sync_at: string | null
          num_licoes: number
          possui_plano_leitura: boolean
          possui_quiz_mestre: boolean
          preco_cheio: number | null
          sinopse: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          autor?: string | null
          bling_produto_id?: number | null
          categoria?: string | null
          created_at?: string
          estoque?: number | null
          faixa_etaria_alvo: string
          id?: string
          imagem_url?: string | null
          last_sync_at?: string | null
          num_licoes?: number
          possui_plano_leitura?: boolean
          possui_quiz_mestre?: boolean
          preco_cheio?: number | null
          sinopse?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          autor?: string | null
          bling_produto_id?: number | null
          categoria?: string | null
          created_at?: string
          estoque?: number | null
          faixa_etaria_alvo?: string
          id?: string
          imagem_url?: string | null
          last_sync_at?: string | null
          num_licoes?: number
          possui_plano_leitura?: boolean
          possui_quiz_mestre?: boolean
          preco_cheio?: number | null
          sinopse?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ebd_revistas_compradas: {
        Row: {
          church_id: string
          created_at: string | null
          data_compra: string | null
          id: string
          preco_pago: number
          revista_id: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          data_compra?: string | null
          id?: string
          preco_pago: number
          revista_id: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          data_compra?: string | null
          id?: string
          preco_pago?: number
          revista_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_revistas_compradas_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_revistas_compradas_revista_id_fkey"
            columns: ["revista_id"]
            isOneToOne: false
            referencedRelation: "ebd_revistas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_shopify_pedidos: {
        Row: {
          cliente_id: string | null
          codigo_rastreio: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          order_date: string | null
          order_number: string
          shopify_order_id: number
          status_pagamento: string
          updated_at: string
          url_rastreio: string | null
          valor_frete: number
          valor_para_meta: number
          valor_total: number
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          codigo_rastreio?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          order_date?: string | null
          order_number: string
          shopify_order_id: number
          status_pagamento?: string
          updated_at?: string
          url_rastreio?: string | null
          valor_frete?: number
          valor_para_meta?: number
          valor_total?: number
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          codigo_rastreio?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          order_date?: string | null
          order_number?: string
          shopify_order_id?: number
          status_pagamento?: string
          updated_at?: string
          url_rastreio?: string | null
          valor_frete?: number
          valor_para_meta?: number
          valor_total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ebd_shopify_pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "ebd_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_shopify_pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_shopify_pedidos_cg: {
        Row: {
          codigo_rastreio: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          order_date: string | null
          order_number: string
          shopify_order_id: number
          status_pagamento: string
          updated_at: string
          url_rastreio: string | null
          valor_frete: number
          valor_total: number
        }
        Insert: {
          codigo_rastreio?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          order_date?: string | null
          order_number: string
          shopify_order_id: number
          status_pagamento?: string
          updated_at?: string
          url_rastreio?: string | null
          valor_frete?: number
          valor_total?: number
        }
        Update: {
          codigo_rastreio?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          order_date?: string | null
          order_number?: string
          shopify_order_id?: number
          status_pagamento?: string
          updated_at?: string
          url_rastreio?: string | null
          valor_frete?: number
          valor_total?: number
        }
        Relationships: []
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
          permite_lancamento_biblias: boolean
          permite_lancamento_ofertas: boolean
          permite_lancamento_revistas: boolean
          responsavel_chamada: string
          responsavel_dados_aula: string
          responsavel_pontuacao: string
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
          permite_lancamento_biblias?: boolean
          permite_lancamento_ofertas?: boolean
          permite_lancamento_revistas?: boolean
          responsavel_chamada?: string
          responsavel_dados_aula?: string
          responsavel_pontuacao?: string
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
          permite_lancamento_biblias?: boolean
          permite_lancamento_ofertas?: boolean
          permite_lancamento_revistas?: boolean
          responsavel_chamada?: string
          responsavel_dados_aula?: string
          responsavel_pontuacao?: string
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
          senha_padrao_usada: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          senha_padrao_usada?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          senha_padrao_usada?: boolean | null
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
      vendedor_propostas: {
        Row: {
          cliente_cnpj: string | null
          cliente_endereco: Json | null
          cliente_id: string | null
          cliente_nome: string
          confirmado_em: string | null
          created_at: string
          desconto_percentual: number | null
          id: string
          itens: Json
          metodo_frete: string | null
          pode_faturar: boolean | null
          prazo_faturamento_selecionado: string | null
          prazos_disponiveis: string[] | null
          status: string
          token: string
          updated_at: string
          valor_frete: number | null
          valor_produtos: number
          valor_total: number
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          cliente_cnpj?: string | null
          cliente_endereco?: Json | null
          cliente_id?: string | null
          cliente_nome: string
          confirmado_em?: string | null
          created_at?: string
          desconto_percentual?: number | null
          id?: string
          itens?: Json
          metodo_frete?: string | null
          pode_faturar?: boolean | null
          prazo_faturamento_selecionado?: string | null
          prazos_disponiveis?: string[] | null
          status?: string
          token: string
          updated_at?: string
          valor_frete?: number | null
          valor_produtos?: number
          valor_total?: number
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          cliente_cnpj?: string | null
          cliente_endereco?: Json | null
          cliente_id?: string | null
          cliente_nome?: string
          confirmado_em?: string | null
          created_at?: string
          desconto_percentual?: number | null
          id?: string
          itens?: Json
          metodo_frete?: string | null
          pode_faturar?: boolean | null
          prazo_faturamento_selecionado?: string | null
          prazos_disponiveis?: string[] | null
          status?: string
          token?: string
          updated_at?: string
          valor_frete?: number | null
          valor_produtos?: number
          valor_total?: number
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "ebd_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_propostas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          comissao_percentual: number
          created_at: string
          email: string
          email_bling: string | null
          foto_url: string | null
          id: string
          meta_mensal_valor: number
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          comissao_percentual?: number
          created_at?: string
          email: string
          email_bling?: string | null
          foto_url?: string | null
          id?: string
          meta_mensal_valor?: number
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          comissao_percentual?: number
          created_at?: string
          email?: string
          email_bling?: string | null
          foto_url?: string | null
          id?: string
          meta_mensal_valor?: number
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adicionar_pontos_aluno: {
        Args: { p_aluno_id: string; p_motivo?: string; p_pontos: number }
        Returns: number
      }
      calculate_next_purchase_date: {
        Args: { start_date: string }
        Returns: string
      }
      get_auth_email: { Args: never; Returns: string }
      get_student_turma_id: { Args: { _user_id: string }; Returns: string }
      get_vendedor_id_by_email: { Args: { _email: string }; Returns: string }
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
      is_vendedor: { Args: { _user_email: string }; Returns: boolean }
      transfer_cliente_vendedor: {
        Args: { _cliente_id: string; _source: string; _vendedor_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "client"
        | "tesoureiro"
        | "secretario"
        | "gerente_ebd"
        | "financeiro"
      church_permission:
        | "view_financial"
        | "edit_financial"
        | "approve_expenses"
        | "manage_members"
        | "view_reports"
        | "edit_church_info"
      desafio_equipe_nome: "EQUIPE_A" | "EQUIPE_B"
      desafio_pergunta_tipo: "DESBLOQUEIO" | "CHARADA"
      desafio_status: "CONFIGURANDO" | "PRONTO" | "EM_ANDAMENTO" | "FINALIZADO"
      desafio_tipo_publico: "PROFESSORES" | "ALUNOS"
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
      app_role: [
        "admin",
        "client",
        "tesoureiro",
        "secretario",
        "gerente_ebd",
        "financeiro",
      ],
      church_permission: [
        "view_financial",
        "edit_financial",
        "approve_expenses",
        "manage_members",
        "view_reports",
        "edit_church_info",
      ],
      desafio_equipe_nome: ["EQUIPE_A", "EQUIPE_B"],
      desafio_pergunta_tipo: ["DESBLOQUEIO", "CHARADA"],
      desafio_status: ["CONFIGURANDO", "PRONTO", "EM_ANDAMENTO", "FINALIZADO"],
      desafio_tipo_publico: ["PROFESSORES", "ALUNOS"],
    },
  },
} as const
