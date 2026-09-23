<!-- A leitura de SUPERVISOR de uma sessão do Paciente Vivo — números, causa
     e nome técnico. NUNCA renderizar isto para um cliente de aluno: é
     exatamente o par oposto de AvatarPaciente/`corpo`, que só mostra sinal
     bruto. Ver o aviso no topo de nucleo/sena_servico/api.py (FichaSaida) —
     esta tela só chega até aqui porque o gate do piloto (só instrutor)
     já filtrou quem pode ver.

     Reaproveitado em PacienteVivoView.vue para dois casos: a ficha da
     sessão que acabou de rodar, e a ficha de qualquer sessão antiga do
     histórico — mesmo formato (`FichaSaida` da API) nos dois. -->

<template>
  <div class="ficha-card">
    <div class="ficha-header">
      <span class="ficha-titulo">Leitura de supervisor — sessão {{ numeroSessao }}</span>
      <span class="ficha-badges">
        <span v-if="ficha.houve_sobrecarga" class="badge badge-erro">sobrecarga</span>
        <span v-if="ficha.piorou" class="badge badge-erro">piorou</span>
        <span v-if="!ficha.houve_sobrecarga && !ficha.piorou" class="badge badge-ok">semana estável</span>
      </span>
    </div>

    <div class="ficha-resumo">
      {{ ficha.dias_cumpridos }}/7 dias cumpridos · adesão {{ (ficha.taxa_de_adesao * 100).toFixed(0) }}%
    </div>

    <div class="ficha-barras">
      <div v-for="d in dimensoes" :key="d.chave" class="ficha-barra-linha">
        <div class="ficha-barra-label">
          {{ d.label }}
          <span v-if="d.delta !== null" :class="['ficha-delta', d.bom ? 'delta-bom' : 'delta-ruim']">
            {{ d.delta > 0 ? '+' : '' }}{{ (d.delta * 100).toFixed(0) }}%
          </span>
        </div>
        <div class="ficha-barra-trilho">
          <div class="ficha-barra-fill" :style="{ width: (d.valor * 100) + '%' }"></div>
        </div>
      </div>
    </div>

    <template v-if="ficha.leitura.length">
      <div class="mini-title">Leitura</div>
      <p v-for="(linha, i) in ficha.leitura" :key="i" class="ficha-texto">{{ linha }}</p>
    </template>

    <template v-if="ficha.alertas.length">
      <div class="mini-title alerta-title">Alertas</div>
      <p v-for="(linha, i) in ficha.alertas" :key="i" class="ficha-alerta">{{ linha }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  numeroSessao: { type: [Number, String], required: true },
  // Forma de FichaSaida (nucleo/sena_servico/api.py): perfil, dias_cumpridos,
  // taxa_de_adesao, houve_sobrecarga, piorou, estado_final, variacoes,
  // leitura, alertas.
  ficha: { type: Object, required: true },
})

// Mesma ordem e mesmos rótulos de sena_nucleo/estado.py (DIMENSOES) — só
// traduzidos para o que um instrutor lê, não o nome da variável Python.
const ROTULOS = {
  alianca: 'Aliança terapêutica',
  sofrimento: 'Sofrimento',
  abertura: 'Abertura',
  esperanca: 'Esperança',
  adesao: 'Adesão (traço do paciente)',
  risco: 'Risco',
  energia: 'Energia',
}
const ORDEM = ['alianca', 'sofrimento', 'abertura', 'esperanca', 'adesao', 'risco', 'energia']
// Nestas duas, valor ALTO é ruim — o mesmo DIMENSOES_INVERTIDAS de
// sena_nucleo/estado.py. Decide só a cor do delta (verde/vermelho), nunca
// o que é exibido: a barra sempre mostra o valor bruto, não uma "leitura".
const INVERTIDAS = new Set(['sofrimento', 'risco'])

const dimensoes = computed(() =>
  ORDEM.map((chave) => {
    const valor = props.ficha.estado_final[chave] ?? 0
    const delta = props.ficha.variacoes && chave in props.ficha.variacoes
      ? props.ficha.variacoes[chave]
      : null
    const bom = delta === null ? null : (INVERTIDAS.has(chave) ? delta < 0 : delta > 0)
    return { chave, label: ROTULOS[chave] || chave, valor, delta, bom }
  })
)
</script>

<style scoped>
.ficha-card {
  background: rgba(35, 32, 26, 0.02);
  border: 1px solid rgba(35, 32, 26, 0.08);
  border-radius: 16px;
  padding: 18px;
  margin-top: 16px;
}
.ficha-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.ficha-titulo {
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #23201a);
}
.ficha-badges { display: flex; gap: 6px; }
.badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
}
.badge-erro { background: rgba(173, 59, 38, 0.15); color: var(--danger, #ad3b26); }
.badge-ok { background: rgba(47, 122, 61, 0.12); color: var(--success, #2f7a3d); }
.ficha-resumo {
  font-size: 12px;
  color: var(--text-faint, #786f5e);
  margin-bottom: 14px;
}
.ficha-barras { display: grid; gap: 10px; margin-bottom: 14px; }
.ficha-barra-linha { display: grid; gap: 4px; }
.ficha-barra-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-soft, #5c5647);
}
.ficha-delta { font-family: 'JetBrains Mono', monospace; font-weight: 700; }
.delta-bom { color: var(--success, #2f7a3d); }
.delta-ruim { color: var(--danger, #ad3b26); }
.ficha-barra-trilho {
  height: 6px;
  border-radius: 999px;
  background: rgba(35, 32, 26, 0.08);
  overflow: hidden;
}
.ficha-barra-fill {
  height: 100%;
  background: var(--cyan, #0e7a6f);
  border-radius: 999px;
  transition: width 400ms ease;
}
.mini-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-faint, #786f5e);
  margin: 12px 0 6px;
}
.alerta-title { color: var(--danger, #ad3b26); }
.ficha-texto {
  font-size: 12px;
  color: var(--text-soft, #5c5647);
  line-height: 1.65;
  margin-bottom: 6px;
}
.ficha-alerta {
  font-size: 12px;
  color: var(--danger, #ad3b26);
  line-height: 1.65;
  margin-bottom: 6px;
}
</style>
