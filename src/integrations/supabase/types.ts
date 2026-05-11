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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      cargos_hierarquia: {
        Row: {
          descricao: string | null
          id: number
          nivel_permissao: number
          nome_cargo: string
        }
        Insert: {
          descricao?: string | null
          id?: number
          nivel_permissao?: number
          nome_cargo: string
        }
        Update: {
          descricao?: string | null
          id?: number
          nivel_permissao?: number
          nome_cargo?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cnpj: string
          created_at: string
          endereco: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoque: {
        Row: {
          created_at: string
          data_entrada: string
          data_validade: string
          empresa_id: string
          id: string
          lote: string | null
          palete_id: string | null
          peso: number | null
          prateleira_id: string | null
          produto_id: string
          quantidade: number
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_entrada?: string
          data_validade: string
          empresa_id: string
          id?: string
          lote?: string | null
          palete_id?: string | null
          peso?: number | null
          prateleira_id?: string | null
          produto_id: string
          quantidade?: number
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_entrada?: string
          data_validade?: string
          empresa_id?: string
          id?: string
          lote?: string | null
          palete_id?: string | null
          peso?: number | null
          prateleira_id?: string | null
          produto_id?: string
          quantidade?: number
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_palete_id_fkey"
            columns: ["palete_id"]
            isOneToOne: false
            referencedRelation: "paletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_prateleira_id_fkey"
            columns: ["prateleira_id"]
            isOneToOne: false
            referencedRelation: "prateleiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_log: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          estoque_id: string | null
          funcionario_id: string | null
          id: string
          matricula: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          estoque_id?: string | null
          funcionario_id?: string | null
          id?: string
          matricula?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          estoque_id?: string | null
          funcionario_id?: string | null
          id?: string
          matricula?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_log_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          cargo: Database["public"]["Enums"]["app_role"]
          cbo: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deve_trocar_senha: boolean
          empresa_id: string
          id: string
          matricula: string
          nome: string
          setor: string | null
          sobrenome: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo?: Database["public"]["Enums"]["app_role"]
          cbo?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deve_trocar_senha?: boolean
          empresa_id: string
          id?: string
          matricula: string
          nome: string
          setor?: string | null
          sobrenome?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo?: Database["public"]["Enums"]["app_role"]
          cbo?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deve_trocar_senha?: boolean
          empresa_id?: string
          id?: string
          matricula?: string
          nome?: string
          setor?: string | null
          sobrenome?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_movimentacoes: {
        Row: {
          created_at: string
          destino_prateleira: string | null
          detalhes: Json | null
          empresa_id: string
          estoque_id: string | null
          funcionario_id: string | null
          id: string
          origem_prateleira: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          destino_prateleira?: string | null
          detalhes?: Json | null
          empresa_id: string
          estoque_id?: string | null
          funcionario_id?: string | null
          id?: string
          origem_prateleira?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          destino_prateleira?: string | null
          detalhes?: Json | null
          empresa_id?: string
          estoque_id?: string | null
          funcionario_id?: string | null
          id?: string
          origem_prateleira?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapa_movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_movimentacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas: {
        Row: {
          cor: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marcas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          empresa_id: string
          estoque_id: string | null
          id: string
          lida: boolean
          mensagem: string
          tipo: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          estoque_id?: string | null
          id?: string
          lida?: boolean
          mensagem: string
          tipo: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          estoque_id?: string | null
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      paletes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "paletes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      prateleiras: {
        Row: {
          altura: number
          capacidade: number
          cor: string | null
          created_at: string
          id: string
          largura: number
          marca_id: string | null
          nome: string
          observacoes: string | null
          palete_id: string
          pos_x: number
          pos_y: number
          setor_id: string | null
        }
        Insert: {
          altura?: number
          capacidade?: number
          cor?: string | null
          created_at?: string
          id?: string
          largura?: number
          marca_id?: string | null
          nome: string
          observacoes?: string | null
          palete_id: string
          pos_x?: number
          pos_y?: number
          setor_id?: string | null
        }
        Update: {
          altura?: number
          capacidade?: number
          cor?: string | null
          created_at?: string
          id?: string
          largura?: number
          marca_id?: string | null
          nome?: string
          observacoes?: string | null
          palete_id?: string
          pos_x?: number
          pos_y?: number
          setor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prateleiras_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prateleiras_palete_id_fkey"
            columns: ["palete_id"]
            isOneToOne: false
            referencedRelation: "paletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prateleiras_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: string | null
          codigo_barras: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          marca: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          marca?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          marca?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          altura: number
          cor: string
          created_at: string
          empresa_id: string
          id: string
          largura: number
          marca_id: string | null
          nome: string
          pos_x: number
          pos_y: number
          updated_at: string
        }
        Insert: {
          altura?: number
          cor?: string
          created_at?: string
          empresa_id: string
          id?: string
          largura?: number
          marca_id?: string | null
          nome: string
          pos_x?: number
          pos_y?: number
          updated_at?: string
        }
        Update: {
          altura?: number
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          largura?: number
          marca_id?: string | null
          nome?: string
          pos_x?: number
          pos_y?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setores_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_funcionario_rh: {
        Args: {
          p_cargo: Database["public"]["Enums"]["app_role"]
          p_cpf: string
          p_data_nascimento: string
          p_empresa_id: string
          p_nome: string
          p_nome_mercado: string
          p_sobrenome: string
        }
        Returns: {
          email_corporativo: string
          matricula: string
        }[]
      }
      gerar_matricula: { Args: never; Returns: string }
      get_user_empresa_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_rh: { Args: { _user_id: string }; Returns: boolean }
      verificar_reset_senha: {
        Args: { p_cpf: string; p_email: string; p_matricula: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "gerente" | "encarregado" | "repositor" | "rh"
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
      app_role: ["gerente", "encarregado", "repositor", "rh"],
    },
  },
} as const
