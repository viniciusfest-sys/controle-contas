export type ContaCategoria = 'fornecedores' | 'energia' | 'aluguel' | 'impostos' | 'insumos' | 'outros';

export type ContaStatus = 'em-dia' | 'vence-hoje' | 'atrasado' | 'pago';

export interface Conta {
  id: string;
  descricao: string;
  valor: number;
  categoria: ContaCategoria;
  dataVencimento: Date;
  dataPagamento?: Date;
  observacoes?: string;
  pago: boolean;
  status: ContaStatus;
}

export interface ResumoFinanceiro {
  totalContas: number;
  totalPago: number;
  totalAPagar: number;
  totalVencido: number;
  contasPagas: number;
  contasPendentes: number;
  contasVencidas: number;
}
