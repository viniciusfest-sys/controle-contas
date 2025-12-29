import { Conta, ResumoFinanceiro } from './types';
import { isToday, isBefore, startOfDay } from 'date-fns';

export function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(data);
}

export function atualizarStatusContas(contas: Conta[]): Conta[] {
  const hoje = startOfDay(new Date());
  
  return contas.map(conta => {
    if (conta.pago) {
      return { ...conta, status: 'pago' };
    }
    
    const vencimento = startOfDay(conta.dataVencimento);
    
    if (isBefore(vencimento, hoje)) {
      return { ...conta, status: 'atrasado' };
    }
    
    if (isToday(vencimento)) {
      return { ...conta, status: 'vence-hoje' };
    }
    
    return { ...conta, status: 'em-dia' };
  });
}

export function calcularResumoFinanceiro(contas: Conta[]): ResumoFinanceiro {
  const contasPagas = contas.filter(c => c.pago);
  const contasPendentes = contas.filter(c => !c.pago && c.status === 'em-dia');
  const contasVencidas = contas.filter(c => c.status === 'atrasado');
  
  return {
    totalContas: contas.length,
    totalPago: contasPagas.reduce((sum, c) => sum + c.valor, 0),
    totalAPagar: contasPendentes.reduce((sum, c) => sum + c.valor, 0),
    totalVencido: contasVencidas.reduce((sum, c) => sum + c.valor, 0),
    contasPagas: contasPagas.length,
    contasPendentes: contasPendentes.length,
    contasVencidas: contasVencidas.length
  };
}
