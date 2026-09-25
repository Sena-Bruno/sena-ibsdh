// =============================================================================
// AUTORIZAÇÃO POR COMPRA — cole como um NOVO arquivo no editor do Apps Script
// (Arquivo → + → Script, nomeie "AutorizacaoCompra").
//
// Por que existe: o OTP (autenticacao.gs) prova IDENTIDADE — "este e-mail é
// seu mesmo" — de propósito, ele aceita pedir um código para qualquer
// endereço, porque quem compra ainda não tinha logado antes. Quem decide se
// esse e-mail pode USAR o sistema é `verificarAcessoAluno` (já existe no
// Codigo.gs, alimentada pelo webhook da Hotmart na aba Alunos_Hotmart) — mas
// hoje ela só é chamada por UMA ação (`verificar_acesso`), que só o
// DashboardView.vue chama, voluntariamente, como gate de tela.
//
// Isso significa que a autorização de compra é hoje só uma checagem de UI:
// qualquer cliente que fale HTTP direto com o Apps Script (curl, Postman, um
// site clonado) pode pedir um código para um e-mail que nunca comprou nada,
// confirmar esse código, e usar esse token para chamar `avaliar`, `progresso`,
// `emitir_certificado`, etc. diretamente — todas essas ações já checam
// IDENTIDADE (emailAutenticado), nenhuma checa COMPRA. Na prática, qualquer
// pessoa consegue simular aulas e até emitir certificado profissional em
// nome de um e-mail que nunca pagou, só pulando a tela do Dashboard.
//
// O que este arquivo adiciona: uma função que combina as duas checagens que
// já existem — identidade (emailAutenticado) e compra (verificarAcessoAluno)
// — num único ponto, para ser usada em TODA ação que expõe dado ou serviço
// pago, não só na tela de login. Não inventa uma terceira fonte de verdade:
// se `verificarAcessoAluno` já libera certo para o Dashboard, libera certo
// aqui também, porque é a MESMA função.
//
// PASSO FINAL — depois de colar este arquivo, troque `emailAutenticado(...)`
// por `emailAutenticadoEAutorizado(...)` nos pontos listados no fim deste
// arquivo (Codigo.gs e plantao.gs). NÃO mexa em `emailAutenticado` em si —
// ele continua sendo só identidade, usado por `verificar_acesso` (que já
// checa compra separadamente) e por qualquer ação futura que precise saber
// quem é o aluno sem que compra seja relevante.
// =============================================================================

/**
 * Identidade + autorização de compra, num só lugar.
 *
 * Devolve o e-mail autenticado SE, e só se, o token for válido E o e-mail
 * estiver liberado em `verificarAcessoAluno` (aba Alunos_Hotmart, alimentada
 * pelo webhook da Hotmart no doPost). Lança erro nos dois casos de recusa —
 * quem chama não precisa distinguir "sessão ruim" de "não comprou": as duas
 * coisas significam a mesma coisa para o cliente, "não pode usar isto agora".
 *
 * `payload` é o mesmo objeto que já ia para `emailAutenticado` — em
 * `avaliar`/`tutor`/`plantao_avaliar` isso é `payload.dados` (não `payload`),
 * porque é ali que `curso` e `token` estão; nos demais casos é `payload`
 * mesmo. Funciona nos dois porque só olha `.token` e `.curso` do objeto que
 * recebe, os MESMOS campos que cada chamador já passava para
 * `emailAutenticado`.
 */
function emailAutenticadoEAutorizado(payload) {
  const email = emailAutenticado(payload);
  const curso = normalizarTexto(payload && payload.curso);
  const acesso = verificarAcessoAluno(email, curso);
  if (!acesso.liberado) {
    throw new Error(acesso.mensagem || 'Acesso não autorizado. Verifique se sua compra foi aprovada.');
  }
  return email;
}

// =============================================================================
// PASSO FINAL — troque `emailAutenticado` por `emailAutenticadoEAutorizado`
// nestes pontos. É sempre a MESMA troca: o nome da função, nada mais — os
// argumentos continuam idênticos.
//
// Em Codigo.gs, dentro do switch do doPost:
//
//   avaliar               payload.dados.email = emailAutenticado(payload.dados)
//   tutor                 payload.dados.email = emailAutenticado(payload.dados)
//   progresso              emailAutenticado(payload)
//   submeter_mentor        emailAutenticado(payload)
//   buscar_mentor          emailAutenticado(payload)
//   boas_vindas             emailAutenticado(payload)
//   prontuario              emailAutenticado(payload)
//   relatorio_evolucao      emailAutenticado(payload)
//   salvar_diario           emailAutenticado(payload)
//   analise_diario          emailAutenticado(payload)
//   buscar_diario           emailAutenticado(payload)
//   comparacao_anonima      emailAutenticado(payload)
//   historico               emailAutenticado(payload)
//   consultar_certificado   emailAutenticado(payload)
//   emitir_certificado      emailAutenticado(payload)
//   reenviar_certificado    emailAutenticado(payload)
//   posicao_ranking         emailAutenticado(payload)
//   evolucao_perfis         emailAutenticado(payload)
//   tentativa_anterior      emailAutenticado(payload)
//
// Em plantao.gs:
//
//   avaliarPlantao(dados)   const email = emailAutenticado(dados).toLowerCase();
//   buscarHistoricoPlantao  chamada no case 'plantao_historico' do doPost:
//                           emailAutenticado(payload) → emailAutenticadoEAutorizado(payload)
//
// NÃO mexa em:
//   - `verificar_acesso` (já chama verificarAcessoAluno separadamente — é
//     onde essa checagem nasceu; trocar aqui não muda nada, só duplicaria)
//   - `solicitar_codigo` / `confirmar_codigo` (não podem exigir compra: é
//     assim que um comprador de verdade, ainda sem sessão, consegue logar
//     pela primeira vez)
//   - `plantao_gerar`, `base_aula`, `ranking_perfis`, `desafio_semanal`,
//     `gerar_desafio`, `estrutura_curso`, `replay`, `conversar`, `titulos`
//     (não identificam um aluno específico — ver appscript/README.md)
// =============================================================================
