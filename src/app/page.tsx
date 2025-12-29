'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Home,
  Calendar as CalendarIcon,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  AlertCircle,
  MoreVertical,
  Download
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Conta, ContaCategoria } from '@/lib/types';
import {
  calcularResumoFinanceiro,
  formatarMoeda,
  formatarData,
  atualizarStatusContas,
  gerarId
} from '@/lib/contas-utils';

const CATEGORIAS: ContaCategoria[] = ['fornecedores', 'energia', 'aluguel', 'impostos', 'insumos', 'outros'];
const CORES_GRAFICO = ['#6200EE', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type TelaAtiva = 'home' | 'lista' | 'relatorios' | 'configuracoes';
type ModoVisualizacao = 'quantidade' | 'moeda';

export default function ControleFacil() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [telaAtiva, setTelaAtiva] = useState<TelaAtiva>('home');
  const [mesAtual, setMesAtual] = useState(new Date());
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('moeda');
  const [dialogAberto, setDialogAberto] = useState(false);

  // Form state
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<ContaCategoria>('fornecedores');
  const [dataVencimento, setDataVencimento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Carregar contas do localStorage
  useEffect(() => {
    const contasSalvas = localStorage.getItem('controle-facil-contas');
    if (contasSalvas) {
      const contasParsed = JSON.parse(contasSalvas).map((c: any) => ({
        ...c,
        dataVencimento: new Date(c.dataVencimento),
        dataPagamento: c.dataPagamento ? new Date(c.dataPagamento) : undefined
      }));
      setContas(atualizarStatusContas(contasParsed));
    }
  }, []);

  // Salvar contas no localStorage
  useEffect(() => {
    if (contas.length > 0) {
      localStorage.setItem('controle-facil-contas', JSON.stringify(contas));
    }
  }, [contas]);

  // Atualizar status das contas
  useEffect(() => {
    const interval = setInterval(() => {
      setContas(prev => atualizarStatusContas(prev));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const adicionarConta = () => {
    if (!descricao || !valor || !dataVencimento) return;

    const novaConta: Conta = {
      id: gerarId(),
      descricao,
      valor: parseFloat(valor),
      categoria,
      dataVencimento: new Date(dataVencimento),
      observacoes,
      pago: false,
      status: 'em-dia'
    };

    const contasAtualizadas = atualizarStatusContas([...contas, novaConta]);
    setContas(contasAtualizadas);

    setDescricao('');
    setValor('');
    setCategoria('fornecedores');
    setDataVencimento('');
    setObservacoes('');
    setDialogAberto(false);
  };

  const marcarComoPago = (id: string) => {
    setContas(prev => 
      atualizarStatusContas(
        prev.map(c => 
          c.id === id 
            ? { ...c, pago: true, dataPagamento: new Date(), status: 'pago' }
            : c
        )
      )
    );
  };

  const desmarcarPagamento = (id: string) => {
    setContas(prev => 
      atualizarStatusContas(
        prev.map(c => 
          c.id === id 
            ? { ...c, pago: false, dataPagamento: undefined }
            : c
        )
      )
    );
  };

  const excluirConta = (id: string) => {
    setContas(prev => prev.filter(c => c.id !== id));
  };

  // Filtrar contas do mês atual
  const contasMesAtual = contas.filter(c => isSameMonth(c.dataVencimento, mesAtual));
  const resumo = calcularResumoFinanceiro(contasMesAtual);

  // Dados para o gráfico
  const contasPagas = contasMesAtual.filter(c => c.pago);
  const contasPendentes = contasMesAtual.filter(c => !c.pago && c.status === 'em-dia');
  const contasVencidas = contasMesAtual.filter(c => c.status === 'atrasado');

  const dadosGrafico = [
    { name: 'Pagas', value: contasPagas.length, color: '#10b981' },
    { name: 'Pendentes', value: contasPendentes.length, color: '#3b82f6' },
    { name: 'Vencidas', value: contasVencidas.length, color: '#ef4444' }
  ].filter(item => item.value > 0);

  const totalContas = contasMesAtual.length;
  const totalValor = contasMesAtual.reduce((sum, c) => sum + c.valor, 0);

  // Calcular totais gerais
  const totalGeral = {
    pagas: {
      quantidade: contasPagas.length,
      valor: resumo.totalPago
    },
    pendentes: {
      quantidade: contasPendentes.length,
      valor: resumo.totalAPagar
    },
    vencidas: {
      quantidade: contasVencidas.length,
      valor: resumo.totalVencido
    },
    total: {
      quantidade: totalContas,
      valor: totalValor
    }
  };

  // Função para exportar PDF
  const exportarPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Título
    pdf.setFontSize(20);
    pdf.setTextColor(98, 0, 238);
    pdf.text('Relatório de Contas', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text(format(mesAtual, 'MMMM yyyy', { locale: ptBR }).toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 15;

    // Resumo Total
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Resumo Geral', 15, yPosition);
    yPosition += 8;

    // Card Total
    pdf.setFillColor(59, 130, 246);
    pdf.roundedRect(15, yPosition, pageWidth - 30, 15, 3, 3, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.text('TOTAL GERAL', 20, yPosition + 6);
    pdf.setFontSize(12);
    pdf.text(`${totalGeral.total.quantidade} contas`, 20, yPosition + 11);
    pdf.text(formatarMoeda(totalGeral.total.valor), pageWidth - 20, yPosition + 8.5, { align: 'right' });
    yPosition += 20;

    // Card Pagas
    pdf.setFillColor(16, 185, 129);
    pdf.roundedRect(15, yPosition, pageWidth - 30, 15, 3, 3, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.text('PAGAS', 20, yPosition + 6);
    pdf.setFontSize(12);
    pdf.text(`${totalGeral.pagas.quantidade} contas`, 20, yPosition + 11);
    pdf.text(formatarMoeda(totalGeral.pagas.valor), pageWidth - 20, yPosition + 8.5, { align: 'right' });
    yPosition += 20;

    // Card Pendentes
    pdf.setFillColor(59, 130, 246);
    pdf.roundedRect(15, yPosition, pageWidth - 30, 15, 3, 3, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.text('PENDENTES', 20, yPosition + 6);
    pdf.setFontSize(12);
    pdf.text(`${totalGeral.pendentes.quantidade} contas`, 20, yPosition + 11);
    pdf.text(formatarMoeda(totalGeral.pendentes.valor), pageWidth - 20, yPosition + 8.5, { align: 'right' });
    yPosition += 20;

    // Card Vencidas
    pdf.setFillColor(239, 68, 68);
    pdf.roundedRect(15, yPosition, pageWidth - 30, 15, 3, 3, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.text('VENCIDAS', 20, yPosition + 6);
    pdf.setFontSize(12);
    pdf.text(`${totalGeral.vencidas.quantidade} contas`, 20, yPosition + 11);
    pdf.text(formatarMoeda(totalGeral.vencidas.valor), pageWidth - 20, yPosition + 8.5, { align: 'right' });
    yPosition += 25;

    // Lista de Contas
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Detalhamento das Contas', 15, yPosition);
    yPosition += 10;

    const contasOrdenadas = [...contasMesAtual].sort((a, b) => 
      a.dataVencimento.getTime() - b.dataVencimento.getTime()
    );

    for (const conta of contasOrdenadas) {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      // Determinar cor da borda
      let borderColor: [number, number, number] = [59, 130, 246]; // azul padrão
      if (conta.status === 'atrasado') borderColor = [239, 68, 68]; // vermelho
      else if (conta.status === 'vence-hoje') borderColor = [245, 158, 11]; // amarelo
      else if (conta.pago) borderColor = [16, 185, 129]; // verde

      // Card da conta com borda colorida
      pdf.setDrawColor(...borderColor);
      pdf.setLineWidth(1);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(15, yPosition, pageWidth - 30, 18, 2, 2, 'FD');

      // Barra lateral colorida
      pdf.setFillColor(...borderColor);
      pdf.rect(15, yPosition, 3, 18, 'F');

      // Conteúdo
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.text(format(conta.dataVencimento, 'dd/MM/yyyy'), 22, yPosition + 6);
      
      pdf.setFontSize(11);
      pdf.text(conta.descricao, 22, yPosition + 11);
      
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(conta.categoria.toUpperCase(), 22, yPosition + 15);

      // Status badge
      pdf.setFontSize(8);
      if (conta.pago) {
        pdf.setFillColor(220, 252, 231);
        pdf.setTextColor(22, 163, 74);
        pdf.roundedRect(pageWidth - 70, yPosition + 3, 20, 5, 1, 1, 'F');
        pdf.text('PAGO', pageWidth - 60, yPosition + 6.5, { align: 'center' });
      } else if (conta.status === 'atrasado') {
        pdf.setFillColor(254, 226, 226);
        pdf.setTextColor(220, 38, 38);
        pdf.roundedRect(pageWidth - 70, yPosition + 3, 25, 5, 1, 1, 'F');
        pdf.text('VENCIDO', pageWidth - 57.5, yPosition + 6.5, { align: 'center' });
      } else if (conta.status === 'vence-hoje') {
        pdf.setFillColor(254, 243, 199);
        pdf.setTextColor(217, 119, 6);
        pdf.roundedRect(pageWidth - 70, yPosition + 3, 20, 5, 1, 1, 'F');
        pdf.text('HOJE', pageWidth - 60, yPosition + 6.5, { align: 'center' });
      }

      // Valor
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.text(formatarMoeda(conta.valor), pageWidth - 20, yPosition + 12, { align: 'right' });

      yPosition += 22;
    }

    // Rodapé
    const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Gerado em ${dataGeracao}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Salvar PDF
    const nomeArquivo = `contas-${format(mesAtual, 'MM-yyyy')}.pdf`;
    pdf.save(nomeArquivo);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-[#6200EE] text-white px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMesAtual(prev => subMonths(prev, 1))}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h1 className="text-lg font-bold capitalize">
                {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
              </h1>
            </div>
            <button 
              onClick={() => setMesAtual(prev => addMonths(prev, 1))}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="px-4 py-6">
        {telaAtiva === 'home' && (
          <div className="space-y-6">
            {/* Botões de Alternância */}
            <div className="flex gap-2 bg-white rounded-full p-1 shadow-sm">
              <button
                onClick={() => setModoVisualizacao('quantidade')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                  modoVisualizacao === 'quantidade'
                    ? 'bg-[#6200EE] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Quantidade
              </button>
              <button
                onClick={() => setModoVisualizacao('moeda')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                  modoVisualizacao === 'moeda'
                    ? 'bg-[#6200EE] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Moeda
              </button>
            </div>

            {/* Gráfico de Rosca */}
            <Card className="shadow-md">
              <CardContent className="pt-6">
                <div className="relative">
                  {dadosGrafico.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={dadosGrafico}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {dadosGrafico.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-gray-900">
                            {modoVisualizacao === 'quantidade' 
                              ? totalContas 
                              : formatarMoeda(totalValor)}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {modoVisualizacao === 'quantidade' ? 'Contas' : 'Total'}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma conta no mês</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cards de Status */}
            <div className="space-y-3">
              {/* Total Geral */}
              <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">Total Geral</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {modoVisualizacao === 'quantidade' 
                          ? `${totalGeral.total.quantidade} contas`
                          : formatarMoeda(totalGeral.total.valor)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pagas */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="font-medium text-gray-900">Pagas</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {modoVisualizacao === 'quantidade' 
                          ? contasPagas.length 
                          : formatarMoeda(resumo.totalPago)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pendentes */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">Pendentes</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {modoVisualizacao === 'quantidade' 
                          ? contasPendentes.length 
                          : formatarMoeda(resumo.totalAPagar)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vencidas */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <span className="font-medium text-gray-900">Vencidas</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {modoVisualizacao === 'quantidade' 
                          ? contasVencidas.length 
                          : formatarMoeda(resumo.totalVencido)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {telaAtiva === 'lista' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Contas do Mês ({contasMesAtual.length})
              </h2>
              <Button
                onClick={exportarPDF}
                className="bg-[#6200EE] hover:bg-[#5000CC] flex items-center gap-2"
                disabled={contasMesAtual.length === 0}
              >
                <Download className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>

            {/* Card de Totais */}
            <Card className="shadow-md border-l-4 border-[#6200EE] mb-4">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Resumo do Mês</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Total Geral</p>
                    <p className="text-sm font-bold text-blue-600">{totalGeral.total.quantidade} contas</p>
                    <p className="text-xs font-semibold text-blue-700">{formatarMoeda(totalGeral.total.valor)}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Pagas</p>
                    <p className="text-sm font-bold text-green-600">{totalGeral.pagas.quantidade} contas</p>
                    <p className="text-xs font-semibold text-green-700">{formatarMoeda(totalGeral.pagas.valor)}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Pendentes</p>
                    <p className="text-sm font-bold text-blue-600">{totalGeral.pendentes.quantidade} contas</p>
                    <p className="text-xs font-semibold text-blue-700">{formatarMoeda(totalGeral.pendentes.valor)}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Vencidas</p>
                    <p className="text-sm font-bold text-red-600">{totalGeral.vencidas.quantidade} contas</p>
                    <p className="text-xs font-semibold text-red-700">{formatarMoeda(totalGeral.vencidas.valor)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {contasMesAtual.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="p-12 text-center text-gray-400">
                  <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Nenhuma conta cadastrada</p>
                  <p className="text-sm mt-2">Adicione uma nova conta usando o botão +</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {contasMesAtual
                  .sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime())
                  .map(conta => (
                    <Card 
                      key={conta.id} 
                      className={`shadow-sm hover:shadow-md transition-all border-l-4 ${
                        conta.status === 'atrasado' ? 'border-red-500' :
                        conta.status === 'vence-hoje' ? 'border-yellow-500' :
                        conta.pago ? 'border-green-500' :
                        'border-blue-500'
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          {/* Ícone de Calendário e Data */}
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <CalendarIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-600 font-medium">
                              {format(conta.dataVencimento, 'dd/MM/yy')}
                            </span>
                          </div>

                          {/* Descrição e Categoria */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-gray-900 truncate">
                              {conta.descricao}
                            </h3>
                            <p className="text-xs text-gray-500 capitalize truncate">
                              {conta.categoria}
                            </p>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2">
                            {conta.pago && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Pago
                              </span>
                            )}
                            {conta.status === 'atrasado' && !conta.pago && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Vencido
                              </span>
                            )}
                            {conta.status === 'vence-hoje' && !conta.pago && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Hoje
                              </span>
                            )}
                          </div>

                          {/* Valor */}
                          <div className="text-right min-w-[80px]">
                            <p className="text-sm font-bold text-gray-900">
                              {formatarMoeda(conta.valor)}
                            </p>
                          </div>

                          {/* Menu de Ações */}
                          <div className="flex items-center gap-1">
                            {!conta.pago ? (
                              <button
                                onClick={() => marcarComoPago(conta.id)}
                                className="p-1.5 hover:bg-green-50 rounded-full transition-colors"
                                title="Marcar como pago"
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </button>
                            ) : (
                              <button
                                onClick={() => desmarcarPagamento(conta.id)}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                                title="Desfazer pagamento"
                              >
                                <X className="w-4 h-4 text-gray-600" />
                              </button>
                            )}
                            <button
                              onClick={() => excluirConta(conta.id)}
                              className="p-1.5 hover:bg-red-50 rounded-full transition-colors"
                              title="Excluir conta"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        )}

        {telaAtiva === 'relatorios' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Relatórios</h2>
              <Button
                onClick={exportarPDF}
                className="bg-[#6200EE] hover:bg-[#5000CC] flex items-center gap-2"
                disabled={contasMesAtual.length === 0}
              >
                <Download className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>
            
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Resumo do Mês</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-700">Total de Contas</span>
                    <span className="font-bold text-blue-600">{contasMesAtual.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-gray-700">Valor Total</span>
                    <span className="font-bold text-blue-600">{formatarMoeda(totalValor)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-gray-700">Total Pago</span>
                    <span className="font-bold text-green-600">{formatarMoeda(resumo.totalPago)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                    <span className="text-gray-700">Total Pendente</span>
                    <span className="font-bold text-yellow-600">{formatarMoeda(resumo.totalAPagar)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="text-gray-700">Total Vencido</span>
                    <span className="font-bold text-red-600">{formatarMoeda(resumo.totalVencido)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Botão Flutuante */}
      <button
        onClick={() => setDialogAberto(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#6200EE] text-white rounded-full shadow-lg hover:bg-[#5000CC] transition-all hover:scale-110 flex items-center justify-center z-20"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Barra de Navegação Inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
        <div className="flex items-center justify-around py-3">
          <button
            onClick={() => setTelaAtiva('home')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              telaAtiva === 'home' 
                ? 'text-[#6200EE]' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Início</span>
          </button>
          
          <button
            onClick={() => setTelaAtiva('lista')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              telaAtiva === 'lista' 
                ? 'text-[#6200EE]' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <CalendarIcon className="w-6 h-6" />
            <span className="text-xs font-medium">Contas</span>
          </button>
          
          <button
            onClick={() => setTelaAtiva('relatorios')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              telaAtiva === 'relatorios' 
                ? 'text-[#6200EE]' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-xs font-medium">Relatórios</span>
          </button>
        </div>
      </nav>

      {/* Dialog de Nova Conta */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta</DialogTitle>
            <DialogDescription>
              Cadastre uma nova conta a pagar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                placeholder="Ex: Fornecedor ABC"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as ContaCategoria)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vencimento">Data de Vencimento *</Label>
              <Input
                id="vencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Informações adicionais..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setDialogAberto(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 bg-[#6200EE] hover:bg-[#5000CC]"
              onClick={adicionarConta}
              disabled={!descricao || !valor || !dataVencimento}
            >
              Cadastrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
