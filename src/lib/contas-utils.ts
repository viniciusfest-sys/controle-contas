// Funções utilitárias para gerenciamento de contas

import { Conta, ContaStatus, ResumoFinanceiro, DadosGrafico } from './types';
import { isToday, isPast, startOfDay, isSameMonth } from 'date-fns';

/**
 * Calcula o status automático de uma conta baseado na data de vencimento
 */
export function calcularStatus(conta: Conta): ContaStatus {
  if (conta.pago) return 'pago';
  
  const hoje = startOfDay(new Date());
  const vencimento = startOfDay(conta.dataVencimento);
  
  if (isToday(vencimento)) return 'vence-hoje';
  if (isPast(vencimento) && vencimento < hoje) return 'atrasado';
  return 'em-dia';
}

/**
 * Atualiza o status de todas as contas
 */
export function atualizarStatusContas(contas: Conta[]): Conta[] {
  return contas.map(conta => ({
    ...conta,
    status: calcularStatus(conta)
  }));
}

/**
 * Calcula o resumo financeiro do mês atual
 */
export function calcularResumoFinanceiro(contas: Conta[]): ResumoFinanceiro {
  const hoje = new Date();
  const contasMesAtual = contas.filter(conta => 
    isSameMonth(conta.dataVencimento, hoje)
  );

  const totalAPagar = contasMesAtual
    .filter(c => !c.pago)
    .reduce((sum, c) => sum + c.valor, 0);

  const totalPago = contasMesAtual
    .filter(c => c.pago)
    .reduce((sum, c) => sum + c.valor, 0);

  const totalVencido = contasMesAtual
    .filter(c => c.status === 'atrasado')
    .reduce((sum, c) => sum + c.valor, 0);

  const contasVencendoHoje = contasMesAtual
    .filter(c => c.status === 'vence-hoje').length;

  return {
    totalAPagar,
    totalPago,
    totalVencido,
    contasVencendoHoje
  };
}

/**
 * Formata valor em Real brasileiro
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

/**
 * Formata data no padrão brasileiro
 */
export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(data);
}

/**
 * Retorna a cor do status
 */
export function getCorStatus(status: ContaStatus): string {
  const cores = {
    'em-dia': 'text-green-600 bg-green-50 border-green-200',
    'vence-hoje': 'text-yellow-600 bg-yellow-50 border-yellow-200',
    'atrasado': 'text-red-600 bg-red-50 border-red-200',
    'pago': 'text-gray-600 bg-gray-50 border-gray-200'
  };
  return cores[status];
}

/**
 * Retorna o label do status
 */
export function getLabelStatus(status: ContaStatus): string {
  const labels = {
    'em-dia': 'Em dia',
    'vence-hoje': 'Vence hoje',
    'atrasado': 'Atrasado',
    'pago': 'Pago'
  };
  return labels[status];
}

/**
 * Agrupa contas por categoria para gráficos
 */
export function agruparPorCategoria(contas: Conta[]): DadosGrafico[] {
  const grupos = contas.reduce((acc, conta) => {
    const cat = conta.categoria;
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += conta.valor;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grupos).map(([categoria, valor]) => ({
    categoria: categoria.charAt(0).toUpperCase() + categoria.slice(1),
    valor
  }));
}

/**
 * Agrupa contas por status para gráficos
 */
export function agruparPorStatus(contas: Conta[]): DadosGrafico[] {
  const grupos = contas.reduce((acc, conta) => {
    const status = getLabelStatus(conta.status);
    if (!acc[status]) acc[status] = 0;
    acc[status] += conta.valor;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(grupos).map(([categoria, valor]) => ({
    categoria,
    valor
  }));
}

/**
 * Ordena contas por data de vencimento
 */
export function ordenarPorVencimento(contas: Conta[]): Conta[] {
  return [...contas].sort((a, b) => 
    a.dataVencimento.getTime() - b.dataVencimento.getTime()
  );
}

/**
 * Gera ID único para nova conta
 */
export function gerarId(): string {
  return `conta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
