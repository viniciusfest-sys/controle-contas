// Tipos para o aplicativo Controle Fácil

export type ContaStatus = 'em-dia' | 'vence-hoje' | 'atrasado' | 'pago';

export type ContaCategoria = 
  | 'fornecedores' 
  | 'energia' 
  | 'aluguel' 
  | 'impostos' 
  | 'insumos'
  | 'outros';

export interface Conta {
  id: string;
  descricao: string;
  valor: number;
  categoria: ContaCategoria;
  dataVencimento: Date;
  observacoes?: string;
  pago: boolean;
  dataPagamento?: Date;
  status: ContaStatus;
}

export interface ResumoFinanceiro {
  totalAPagar: number;
  totalPago: number;
  totalVencido: number;
  contasVencendoHoje: number;
}

export interface DadosGrafico {
  categoria: string;
  valor: number;
}
