'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [exportando, setExportando] = useState(false);
  const relatorioRef = useRef<HTMLDivElement>(null);

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

  // Calcular totais gerais (todas as contas)
  const totalGeralContas = contas.length;
  const totalGeralValor = contas.reduce((sum, c) => sum + c.valor, 0);
  const totalGeralPagas = contas.filter(c => c.pago).length;
  const totalGeralPendentes = contas.filter(c => !c.pago && c.status === 'em-dia').length;
  const totalGeralVencidas = contas.filter(c => c.status === 'atrasado').length;
  const totalGeralValorPago = contas.filter(c => c.pago).reduce((sum, c) => sum + c.valor, 0);
  const totalGeralValorPendente = contas.filter(c => !c.pago && c.status === 'em-dia').reduce((sum, c) => sum + c.valor, 0);
  const totalGeralValorVencido = contas.filter(c => c.status === 'atrasado').reduce((sum, c) => sum + c.valor, 0);

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

  // Função para exportar PDF
  const exportarPDF = async () => {
    if (!relatorioRef.current) return;
    
    setExportando(true);
    
    try {
      const canvas = await html2canvas(relatorioRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`relatorio-contas-${format(mesAtual, 'MM-yyyy')}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    } finally {
      setExportando(false);
    }
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Contas do Mês ({contasMesAtual.length})
            </h2>
            
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
                      className={`shadow-sm hover:shadow-md transition-all ${
                        conta.status === 'atrasado' ? 'border-l-4 border-red-500' :
                        conta.status === 'vence-hoje' ? 'border-l-4 border-yellow-500' :
                        conta.pago ? 'border-l-4 border-green-500' :
                        'border-l-4 border-blue-500'
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs text-gray-600">
                                {format(conta.dataVencimento, 'dd/MM/yyyy')}
                              </span>
                              {conta.pago && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                  Pago
                                </span>
                              )}
                              {conta.status === 'atrasado' && !conta.pago && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                  Vencido
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-gray-900 text-sm mb-0.5">
                              {conta.descricao}
                            </h3>
                            <p className="text-xs text-gray-500 capitalize">
                              {conta.categoria}
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-base font-bold text-gray-900">
                              {formatarMoeda(conta.valor)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-2">
                          {!conta.pago ? (
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"
                              onClick={() => marcarComoPago(conta.id)}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Pagar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-8 text-xs"
                              onClick={() => desmarcarPagamento(conta.id)}
                            >
                              Desfazer
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 px-3"
                            onClick={() => excluirConta(conta.id)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
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
                disabled={exportando}
                className="bg-[#6200EE] hover:bg-[#5000CC]"
              >
                <Download className="w-4 h-4 mr-2" />
                {exportando ? 'Exportando...' : 'Exportar PDF'}
              </Button>
            </div>
            
            <div ref={relatorioRef} className="space-y-4 bg-white p-6 rounded-lg">
              {/* Cabeçalho do Relatório */}
              <div className="text-center mb-6 pb-4 border-b-2 border-[#6200EE]">
                <h1 className="text-2xl font-bold text-[#6200EE] mb-2">
                  Relatório de Contas
                </h1>
                <p className="text-gray-600 capitalize">
                  {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
                </p>
              </div>

              {/* Resumo do Mês Atual */}
              <Card className="shadow-sm border-2 border-[#6200EE]">
                <CardContent className="p-6">
                  <h3 className="font-bold text-[#6200EE] mb-4 text-lg">Resumo do Mês Atual</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                      <span className="text-gray-700 font-medium">Total de Contas</span>
                      <span className="font-bold text-blue-600">{contasMesAtual.length}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                      <span className="text-gray-700 font-medium">Total Pago</span>
                      <span className="font-bold text-green-600">{formatarMoeda(resumo.totalPago)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                      <span className="text-gray-700 font-medium">Total Pendente</span>
                      <span className="font-bold text-yellow-600">{formatarMoeda(resumo.totalAPagar)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                      <span className="text-gray-700 font-medium">Total Vencido</span>
                      <span className="font-bold text-red-600">{formatarMoeda(resumo.totalVencido)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Geral (Todas as Contas) */}
              <Card className="shadow-sm border-2 border-purple-500">
                <CardContent className="p-6">
                  <h3 className="font-bold text-purple-600 mb-4 text-lg">Total Geral (Todas as Contas)</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                      <span className="text-gray-700 font-medium">Total de Contas</span>
                      <span className="font-bold text-purple-600">{totalGeralContas}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                      <span className="text-gray-700 font-medium">Valor Total</span>
                      <span className="font-bold text-purple-600">{formatarMoeda(totalGeralValor)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg border-2 border-green-500">
                        <div className="text-2xl font-bold text-green-600">{totalGeralPagas}</div>
                        <div className="text-xs text-gray-600 mt-1">Pagas</div>
                        <div className="text-sm font-semibold text-green-600 mt-1">
                          {formatarMoeda(totalGeralValorPago)}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg border-2 border-blue-500">
                        <div className="text-2xl font-bold text-blue-600">{totalGeralPendentes}</div>
                        <div className="text-xs text-gray-600 mt-1">Pendentes</div>
                        <div className="text-sm font-semibold text-blue-600 mt-1">
                          {formatarMoeda(totalGeralValorPendente)}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg border-2 border-red-500">
                        <div className="text-2xl font-bold text-red-600">{totalGeralVencidas}</div>
                        <div className="text-xs text-gray-600 mt-1">Vencidas</div>
                        <div className="text-sm font-semibold text-red-600 mt-1">
                          {formatarMoeda(totalGeralValorVencido)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Contas do Mês */}
              {contasMesAtual.length > 0 && (
                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-gray-900 mb-4 text-lg">Detalhamento das Contas</h3>
                    <div className="space-y-2">
                      {contasMesAtual
                        .sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime())
                        .map((conta, index) => (
                          <div 
                            key={conta.id}
                            className={`p-3 rounded-lg border-l-4 ${
                              conta.pago ? 'bg-green-50 border-green-500' :
                              conta.status === 'atrasado' ? 'bg-red-50 border-red-500' :
                              'bg-blue-50 border-blue-500'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">{conta.descricao}</div>
                                <div className="text-sm text-gray-600 capitalize">{conta.categoria}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Vencimento: {format(conta.dataVencimento, 'dd/MM/yyyy')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-gray-900">{formatarMoeda(conta.valor)}</div>
                                <div className={`text-xs mt-1 px-2 py-1 rounded-full inline-block ${
                                  conta.pago ? 'bg-green-200 text-green-800' :
                                  conta.status === 'atrasado' ? 'bg-red-200 text-red-800' :
                                  'bg-blue-200 text-blue-800'
                                }`}>
                                  {conta.pago ? 'Pago' : conta.status === 'atrasado' ? 'Vencido' : 'Pendente'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rodapé do Relatório */}
              <div className="text-center text-sm text-gray-500 mt-6 pt-4 border-t">
                <p>Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
            </div>
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
